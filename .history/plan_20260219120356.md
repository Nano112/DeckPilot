# DeckPilot Server Performance Optimization

## Context
The server spawns too many processes and broadcasts too much data. Key offenders: `top -l 2` every 3s (blocks for 2+ seconds), Spotify osascript every 1s, Claude hooks walking the process tree 25x per tool use, and redundant WS broadcasts when data hasn't changed. Goal: reduce host machine load and simplify installation.

---

## Changes (ordered by impact)

### 1. Replace `top -l 2` with `ps -A -o %cpu`
**File:** `server/src/platform/macos.ts` — `getCpuUsage()`

`top -l 2` blocks for 2+ seconds per invocation. Replace with `ps -A -o %cpu` which returns instantly — sum per-process CPU values and divide by core count.

### 2. Add change detection to LiveDataManager
**File:** `server/src/services/liveData.ts`

Cache last broadcast JSON string per source. Skip `ws.send()` if data is identical to last broadcast. Eliminates redundant messages for Spotify (same track for minutes), system stats, soundboard status.

### 3. Reduce polling intervals
| Source | File | Before | After |
|--------|------|--------|-------|
| Audio FFT | `sources/audio-fft.ts` | 50ms | 100ms |
| Spotify | `sources/spotify.ts` | 1000ms | 3000ms |
| System Stats | `sources/systemStats.ts` | 3000ms | 5000ms |
| Soundboard | `services/soundboard.ts` | 500ms | 2000ms |

### 4. Cache parent app in Claude hook script
**File:** `~/.claude/deckpilot-hook.py`

Parent app doesn't change during a session. First call walks the tree and writes to `/tmp/deckpilot-hook-cache/parent-app-{PPID}`. All subsequent calls read the file (0 `ps` spawns). Also update `server/src/services/claude-hooks-setup.ts` to deploy the new script.

### 5. Gate Claude session logging behind debug flag
**File:** `server/src/services/sources/claude-sessions.ts`

Wrap per-event `console.log` calls with `process.env.DECKPILOT_DEBUG_HOOKS === "1"`. Keep `SessionEnd` log unconditional.

### 6. Add Spotify null-result cooldown
**File:** `server/src/services/sources/spotify.ts`

If Spotify returned null (not running), skip osascript for 15s before checking again.

### 7. Create setup script with Swift pre-compilation
**New file:** `scripts/setup.ts` + add `"setup"` script to root `package.json`

Single `bun run setup` that: checks prerequisites, pre-compiles Swift binaries (audio-capture, soundboard-player) so they don't compile on first use, creates config directory.

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| `top` spawns/hour | 1,200 | 0 |
| `ps` per Claude hook | ~25 | 0 (cached) |
| Spotify osascript/hour | 3,600 | ~240 |
| WS broadcasts/sec | ~23 | ~1-3 (on changes only) |
| Audio FFT poll rate | 20/sec | 10/sec |

## Verification
1. `bun run build` passes
2. Start server, confirm no `top` in `ps aux`
3. Widgets still update correctly (Spotify, stats, audio, Claude sessions)
4. WS messages only sent on data changes (Network tab)
5. Claude hook cache file appears at `/tmp/deckpilot-hook-cache/`
6. `bun run setup` compiles Swift binaries
