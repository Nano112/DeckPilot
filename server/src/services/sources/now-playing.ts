import { existsSync } from "fs";
import { join } from "path";
import type { NowPlayingData } from "shared";
import type { DataSourceProvider } from "./types";

const BINARY_NAME = "now-playing";
const SWIFT_SOURCE = "now-playing.swift";

// Known bundle ID → friendly app name
const APP_NAMES: Record<string, string> = {
  "com.spotify.client": "Spotify",
  "com.apple.Music": "Apple Music",
  "com.apple.Safari": "Safari",
  "com.google.Chrome": "Chrome",
  "org.mozilla.firefox": "Firefox",
  "com.microsoft.edgemac": "Edge",
  "com.brave.Browser": "Brave",
  "company.thebrowser.Browser": "Arc",
  "com.apple.TV": "Apple TV",
  "com.colliderli.iina": "IINA",
  "org.videolan.vlc": "VLC",
  "com.tidal.desktop": "Tidal",
  "com.amazon.music": "Amazon Music",
  "tv.plex.desktop": "Plex",
};

function appNameFromBundleId(bundleId: string): string {
  if (!bundleId) return "";
  if (APP_NAMES[bundleId]) return APP_NAMES[bundleId]!;
  // Fallback: last component of bundle ID, capitalized
  const parts = bundleId.split(".");
  const last = parts[parts.length - 1] ?? bundleId;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

interface SwiftOutput {
  title: string;
  artist: string;
  album: string;
  duration: number;
  elapsed: number;
  playbackRate: number;
  isPlaying: boolean;
  bundleId: string;
  artworkBase64?: string;
}

async function osascript(script: string): Promise<string> {
  const proc = Bun.spawn(["osascript", "-e", script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  return output.trim();
}

export class NowPlayingSource implements DataSourceProvider {
  readonly name = "now_playing";
  readonly intervalMs = 1000;

  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private cached: NowPlayingData | null = null;
  private starting = false;
  private failedAt = 0;
  private partial = "";
  private useFallback = false;
  private lastArtworkDataUrl: string | null = null;

  async fetch(): Promise<NowPlayingData | null> {
    if (this.useFallback) {
      return this.fetchFallback();
    }
    if (!this.proc && !this.starting) {
      if (Date.now() - this.failedAt < 30000) return this.cached;
      await this.start();
    }
    return this.cached;
  }

  /** Send seek command to the Swift subprocess */
  seek(position: number): void {
    const stdin = this.proc?.stdin;
    if (!stdin || typeof stdin === "number") return;
    const cmd = JSON.stringify({ command: "seek", position }) + "\n";
    try {
      (stdin as import("bun").FileSink).write(cmd);
      (stdin as import("bun").FileSink).flush();
    } catch {
      // Process may have ended
    }
  }

  private getBinaryPath(): string {
    return join(import.meta.dir, "..", "..", "platform", BINARY_NAME);
  }

  private getSourcePath(): string {
    return join(import.meta.dir, "..", "..", "platform", SWIFT_SOURCE);
  }

  private async ensureBinary(): Promise<string | null> {
    const binPath = this.getBinaryPath();
    if (existsSync(binPath)) return binPath;

    const srcPath = this.getSourcePath();
    if (!existsSync(srcPath)) {
      console.log("[NowPlaying] Swift source not found at", srcPath);
      return null;
    }

    console.log("[NowPlaying] Compiling now-playing helper...");
    const compile = Bun.spawn(
      ["swiftc", "-O", "-framework", "Foundation", "-o", binPath, srcPath],
      { stdout: "pipe", stderr: "pipe" },
    );

    const exitCode = await compile.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(compile.stderr).text();
      console.error("[NowPlaying] Compilation failed:", stderr);
      return null;
    }

    console.log("[NowPlaying] Compiled successfully");
    return binPath;
  }

  private async start(): Promise<void> {
    this.starting = true;

    try {
      const binPath = await this.ensureBinary();
      if (!binPath) {
        this.failedAt = Date.now();
        this.starting = false;
        return;
      }

      console.log("[NowPlaying] Starting now-playing helper...");
      this.proc = Bun.spawn([binPath], {
        stdout: "pipe",
        stderr: "pipe",
        stdin: "pipe",
      });

      this.pipeStderr();
      this.pipeStdout();

      this.proc.exited.then((code) => {
        if (code === 2) {
          console.log(
            "[NowPlaying] MediaRemote unavailable (entitlement restriction), switching to AppleScript fallback",
          );
          this.useFallback = true;
        } else if (code !== 0) {
          console.log("[NowPlaying] Process exited with code", code);
        }
        this.proc = null;
        this.failedAt = Date.now();
      });
    } catch (err) {
      console.error("[NowPlaying] Failed to start:", err);
      this.failedAt = Date.now();
    } finally {
      this.starting = false;
    }
  }

  private async pipeStderr(): Promise<void> {
    const stderr = this.proc?.stderr;
    if (!stderr || typeof stderr === "number") return;

    try {
      for await (const chunk of stderr) {
        const text = new TextDecoder().decode(chunk).trim();
        if (text) console.log("[NowPlaying]", text);
      }
    } catch {
      // Process ended
    }
  }

  private async pipeStdout(): Promise<void> {
    const stdout = this.proc?.stdout;
    if (!stdout || typeof stdout === "number") return;

    try {
      for await (const chunk of stdout) {
        this.partial += new TextDecoder().decode(chunk);
        const lines = this.partial.split("\n");
        this.partial = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const raw = JSON.parse(line) as SwiftOutput;
            this.cached = this.transform(raw);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch {
      // Process ended
    }
  }

  private transform(raw: SwiftOutput): NowPlayingData {
    // Cache artwork as data URL — only update when new artwork arrives
    if (raw.artworkBase64) {
      this.lastArtworkDataUrl = `data:image/jpeg;base64,${raw.artworkBase64}`;
    }

    return {
      track: raw.title,
      artist: raw.artist,
      album: raw.album,
      artwork: this.lastArtworkDataUrl ?? "",
      progress: Math.round(raw.elapsed),
      duration: Math.round(raw.duration),
      isPlaying: raw.isPlaying,
      app: appNameFromBundleId(raw.bundleId),
      playbackRate: raw.playbackRate,
    };
  }

  // ── AppleScript fallback ──

  private async fetchFallback(): Promise<NowPlayingData | null> {
    // Try Spotify first, then Apple Music
    const spotify = await this.fetchSpotifyAS();
    if (spotify) return spotify;
    return this.fetchMusicAS();
  }

  private async fetchSpotifyAS(): Promise<NowPlayingData | null> {
    try {
      const script = `
        if application "Spotify" is running then
          tell application "Spotify"
            if player state is stopped then return "STOPPED"
            set t to name of current track
            set a to artist of current track
            set al to album of current track
            set art to artwork url of current track
            set d to duration of current track
            set p to player position
            set s to player state
            return t & "|||" & a & "|||" & al & "|||" & art & "|||" & (d as text) & "|||" & (p as text) & "|||" & (s as text)
          end tell
        else
          return "NOT_RUNNING"
        end if
      `;
      const result = await osascript(script);
      if (result === "NOT_RUNNING" || result === "STOPPED") return null;
      const parts = result.split("|||");
      if (parts.length < 7) return null;
      const parseNum = (s: string) => Number(s.replace(",", "."));
      return {
        track: parts[0]!,
        artist: parts[1]!,
        album: parts[2]!,
        artwork: parts[3]!,
        duration: Math.round(parseNum(parts[4]!) / 1000),
        progress: Math.round(parseNum(parts[5]!)),
        isPlaying: parts[6] === "playing",
        app: "Spotify",
      };
    } catch {
      return null;
    }
  }

  private async fetchMusicAS(): Promise<NowPlayingData | null> {
    try {
      const script = `
        if application "Music" is running then
          tell application "Music"
            if player state is stopped then return "STOPPED"
            set t to name of current track
            set a to artist of current track
            set al to album of current track
            set d to duration of current track
            set p to player position
            set s to player state
            return t & "|||" & a & "|||" & al & "|||" & (d as text) & "|||" & (p as text) & "|||" & (s as text)
          end tell
        else
          return "NOT_RUNNING"
        end if
      `;
      const result = await osascript(script);
      if (result === "NOT_RUNNING" || result === "STOPPED") return null;
      const parts = result.split("|||");
      if (parts.length < 6) return null;
      const parseNum = (s: string) => Number(s.replace(",", "."));
      return {
        track: parts[0]!,
        artist: parts[1]!,
        album: parts[2]!,
        artwork: "",
        duration: Math.round(parseNum(parts[3]!)),
        progress: Math.round(parseNum(parts[4]!)),
        isPlaying: parts[5] === "playing",
        app: "Apple Music",
      };
    } catch {
      return null;
    }
  }
}
