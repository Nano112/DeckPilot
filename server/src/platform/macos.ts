import type { SpotifyNowPlayingData } from "shared";
import type { PlatformActions } from "./types";

async function osascript(script: string): Promise<string> {
  const proc = Bun.spawn(["osascript", "-e", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  return output.trim();
}

export class MacOSPlatform implements PlatformActions {
  // ── Audio ──

  async getVolume(): Promise<number> {
    const result = await osascript("output volume of (get volume settings)");
    return parseInt(result, 10);
  }

  async setVolume(level: number): Promise<void> {
    const clamped = Math.max(0, Math.min(100, Math.round(level)));
    await osascript(`set volume output volume ${clamped}`);
  }

  async getMuted(): Promise<boolean> {
    const result = await osascript("output muted of (get volume settings)");
    return result === "true";
  }

  async setMuted(muted: boolean): Promise<void> {
    await osascript(`set volume output muted ${muted}`);
  }

  // ── Media ──

  async mediaPlayPause(): Promise<void> {
    await this.pressKey(["media_play_pause"]);
  }

  async mediaNext(): Promise<void> {
    await this.pressKey(["media_next"]);
  }

  async mediaPrevious(): Promise<void> {
    await this.pressKey(["media_previous"]);
  }

  async mediaStop(): Promise<void> {
    throw new Error("Not implemented yet");
  }

  // ── System ──

  async openUrl(url: string): Promise<void> {
    Bun.spawn(["open", url]);
  }

  async launchApp(app: string): Promise<void> {
    Bun.spawn(["open", "-a", app]);
  }

  async lockScreen(): Promise<void> {
    await osascript(`
      tell application "System Events" to key code 12 using {control down, command down}
    `);
  }

  async sleep(): Promise<void> {
    Bun.spawn(["pmset", "sleepnow"]);
  }

  // ── Input ──

  async pressKey(keys: string[]): Promise<void> {
    // Handle special media keys via NX events
    if (keys.length === 1) {
      const mediaKeyMap: Record<string, number> = {
        media_play_pause: 16,
        media_next: 17,
        media_previous: 18,
        media_stop: 15,
      };
      const nxKey = mediaKeyMap[keys[0]!];
      if (nxKey !== undefined) {
        // Use CoreGraphics via osascript for media keys
        const script = `
          use framework "AppKit"
          set keyEvent to current application's NSEvent's otherEventWithType:14 location:{0, 0} modifierFlags:0 timestamp:0 windowNumber:0 context:(missing value) subtype:8 data1:(${nxKey} * 65536 + 2560) data2:-1
          current application's CGEventPost(0, keyEvent's CGEvent())
          delay 0.05
          set keyEvent to current application's NSEvent's otherEventWithType:14 location:{0, 0} modifierFlags:0 timestamp:0 windowNumber:0 context:(missing value) subtype:8 data1:(${nxKey} * 65536 + 2816) data2:-1
          current application's CGEventPost(0, keyEvent's CGEvent())
        `;
        const proc = Bun.spawn(["osascript", "-l", "AppleScript", "-e", script], {
          stdout: "pipe",
          stderr: "pipe",
        });
        await proc.exited;
        return;
      }
    }

    // Build osascript for keyboard shortcuts
    const modifiers: string[] = [];
    const regularKeys: string[] = [];

    for (const key of keys) {
      const lower = key.toLowerCase();
      if (lower === "cmd" || lower === "command") modifiers.push("command down");
      else if (lower === "ctrl" || lower === "control") modifiers.push("control down");
      else if (lower === "alt" || lower === "option") modifiers.push("option down");
      else if (lower === "shift") modifiers.push("shift down");
      else regularKeys.push(lower);
    }

    const keyChar = regularKeys[0] ?? "";
    const modStr = modifiers.length > 0 ? ` using {${modifiers.join(", ")}}` : "";

    await osascript(
      `tell application "System Events" to keystroke "${keyChar}"${modStr}`
    );
  }

  async typeText(text: string): Promise<void> {
    await osascript(
      `tell application "System Events" to keystroke "${text.replace(/"/g, '\\"')}"`
    );
  }

  // ── Window management ──

  async focusWindow(app: string): Promise<void> {
    await osascript(`tell application "${app}" to activate`);
  }

  async closeWindow(): Promise<void> {
    await this.pressKey(["cmd", "w"]);
  }

  async minimizeWindow(): Promise<void> {
    await this.pressKey(["cmd", "m"]);
  }

  // ── Clipboard ──

  async getClipboard(): Promise<string> {
    const proc = Bun.spawn(["pbpaste"], { stdout: "pipe" });
    return new Response(proc.stdout).text();
  }

  async setClipboard(text: string): Promise<void> {
    const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" });
    proc.stdin.write(text);
    proc.stdin.end();
    await proc.exited;
  }

  // ── Spotify ──

  async spotifyGetNowPlaying(): Promise<SpotifyNowPlayingData | null> {
    try {
      const script = `
        if application "Spotify" is running then
          tell application "Spotify"
            if player state is stopped then
              return "STOPPED"
            end if
            set trackName to name of current track
            set artistName to artist of current track
            set albumName to album of current track
            set artUrl to artwork url of current track
            set trackDuration to duration of current track
            set playerPos to player position
            set playerState to player state
            return trackName & "|||" & artistName & "|||" & albumName & "|||" & artUrl & "|||" & (trackDuration as text) & "|||" & (playerPos as text) & "|||" & (playerState as text)
          end tell
        else
          return "NOT_RUNNING"
        end if
      `;
      const result = await osascript(script);
      if (result === "NOT_RUNNING" || result === "STOPPED") return null;

      const parts = result.split("|||");
      if (parts.length < 7) return null;

      const [track, artist, album, albumArt, rawDuration, rawProgress, state] = parts;
      // AppleScript uses locale decimal separator (comma on many systems)
      const parseNum = (s: string) => Number(s.replace(",", "."));
      return {
        track: track!,
        artist: artist!,
        album: album!,
        albumArt: albumArt!,
        duration: Math.round(parseNum(rawDuration!) / 1000), // ms → seconds
        progress: Math.round(parseNum(rawProgress!)),
        isPlaying: state === "playing",
      };
    } catch {
      return null;
    }
  }

  async spotifyPlayPause(): Promise<void> {
    await osascript('tell application "Spotify" to playpause');
  }

  async spotifyNext(): Promise<void> {
    await osascript('tell application "Spotify" to next track');
  }

  async spotifyPrevious(): Promise<void> {
    await osascript('tell application "Spotify" to previous track');
  }

  // ── System info ──

  async getCpuUsage(): Promise<number> {
    try {
      // Use top with 2 samples to get a delta reading (first sample is since boot)
      const proc = Bun.spawn(["top", "-l", "2", "-n", "0", "-stats", "cpu"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(proc.stdout).text();
      // Parse the last "CPU usage" line: "CPU usage: 12.5% user, 8.3% sys, 79.1% idle"
      const lines = output.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const match = lines[i]!.match(/CPU usage:\s+([\d.]+)%\s+user,\s+([\d.]+)%\s+sys/);
        if (match) {
          return parseFloat(match[1]!) + parseFloat(match[2]!);
        }
      }
      return 0;
    } catch {
      return 0;
    }
  }

  async getMemoryUsage(): Promise<{ used: number; total: number; pct: number }> {
    try {
      const [vmProc, memProc] = [
        Bun.spawn(["vm_stat"], { stdout: "pipe", stderr: "pipe" }),
        Bun.spawn(["sysctl", "-n", "hw.memsize"], { stdout: "pipe", stderr: "pipe" }),
      ];
      const [vmOutput, memOutput] = await Promise.all([
        new Response(vmProc.stdout).text(),
        new Response(memProc.stdout).text(),
      ]);

      const totalBytes = parseInt(memOutput.trim(), 10);
      const totalGB = totalBytes / (1024 ** 3);

      // Parse vm_stat page size and counts
      const pageSizeMatch = vmOutput.match(/page size of (\d+) bytes/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1]!, 10) : 4096;

      const getPages = (label: string): number => {
        const re = new RegExp(`${label}:\\s+(\\d+)`);
        const m = vmOutput.match(re);
        return m ? parseInt(m[1]!, 10) : 0;
      };

      const active = getPages("Pages active");
      const wired = getPages("Pages wired down");
      const compressed = getPages("Pages occupied by compressor");
      const usedBytes = (active + wired + compressed) * pageSize;
      const usedGB = usedBytes / (1024 ** 3);

      return {
        used: Math.round(usedGB * 10) / 10,
        total: Math.round(totalGB * 10) / 10,
        pct: Math.round((usedBytes / totalBytes) * 100),
      };
    } catch {
      return { used: 0, total: 0, pct: 0 };
    }
  }

  async getBatteryInfo(): Promise<{ pct: number; charging: boolean } | null> {
    try {
      const proc = Bun.spawn(["pmset", "-g", "batt"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(proc.stdout).text();
      // Example: " -InternalBattery-0 (id=...)	85%; charging; ..."
      const match = output.match(/(\d+)%;\s*(charging|discharging|charged)/);
      if (!match) return null; // No battery (desktop Mac)
      return {
        pct: parseInt(match[1]!, 10),
        charging: match[2] !== "discharging",
      };
    } catch {
      return null;
    }
  }

  async getDiskUsage(): Promise<{ used: string; total: string; pct: number }> {
    try {
      const proc = Bun.spawn(["df", "-H", "/"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = await new Response(proc.stdout).text();
      // Parse: "Filesystem Size Used Avail Capacity ..."
      const lines = output.trim().split("\n");
      if (lines.length < 2) return { used: "0", total: "0", pct: 0 };
      const parts = lines[1]!.split(/\s+/);
      // parts[1]=Size, parts[2]=Used, parts[4]=Capacity(%)
      const total = parts[1] ?? "0";
      const used = parts[2] ?? "0";
      const pctStr = (parts[4] ?? "0%").replace("%", "");
      return { used, total, pct: parseInt(pctStr, 10) };
    } catch {
      return { used: "0", total: "0", pct: 0 };
    }
  }

  async screenshot(): Promise<Buffer> {
    throw new Error("Not implemented yet");
  }
}
