import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { DataSourceProvider } from "./sources/types";
import type { SoundboardStatusData } from "shared";

const BINARY_NAME = "soundboard-player";
const SWIFT_SOURCE = "soundboard-player.swift";
const ALLOWED_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac", ".caf"]);

export class SoundboardManager implements DataSourceProvider {
  readonly name = "soundboard";
  readonly intervalMs = 500;

  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private starting = false;
  private failedAt = 0;
  private partial = "";
  private status: SoundboardStatusData = {
    ready: false,
    playing: [],
    blackholeAvailable: false,
    localVolume: 1,
    discordVolume: 1,
  };

  async fetch(): Promise<SoundboardStatusData> {
    return this.status;
  }

  getSoundsDir(): string {
    const dir = join(
      homedir(),
      "Library",
      "Application Support",
      "deckpilot",
      "sounds"
    );
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  listSounds(): { name: string; size: number }[] {
    const dir = this.getSoundsDir();
    try {
      return readdirSync(dir)
        .filter((f) => {
          const ext = f.substring(f.lastIndexOf(".")).toLowerCase();
          return ALLOWED_EXTENSIONS.has(ext);
        })
        .map((f) => ({
          name: f,
          size: statSync(join(dir, f)).size,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  deleteSound(name: string): boolean {
    const safeName = name.replace(/[/\\]/g, "");
    const filePath = join(this.getSoundsDir(), safeName);
    if (!existsSync(filePath)) return false;
    unlinkSync(filePath);
    return true;
  }

  getSoundPath(name: string): string | null {
    const safeName = name.replace(/[/\\]/g, "");
    const filePath = join(this.getSoundsDir(), safeName);
    if (!existsSync(filePath)) return null;
    return filePath;
  }

  async play(soundId: string): Promise<void> {
    await this.ensureRunning();
    const safeName = soundId.replace(/[/\\]/g, "");
    const filePath = join(this.getSoundsDir(), safeName);
    this.sendCommand({ cmd: "play", file: filePath });
  }

  async stopSound(soundId: string): Promise<void> {
    if (!this.proc) return;
    const safeName = soundId.replace(/[/\\]/g, "");
    const filePath = join(this.getSoundsDir(), safeName);
    this.sendCommand({ cmd: "stop_sound", file: filePath });
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    this.sendCommand({ cmd: "stop" });
  }

  async setVolume(target: string, level: number): Promise<void> {
    await this.ensureRunning();
    this.sendCommand({ cmd: "set_volume", target, value: Math.max(0, Math.min(1, level)) });
  }

  isPlaying(soundId: string): boolean {
    return this.status.playing.includes(soundId);
  }

  private sendCommand(cmd: Record<string, unknown>): void {
    const stdin = this.proc?.stdin;
    if (!stdin || typeof stdin === "number") return;
    (stdin as import("bun").FileSink).write(JSON.stringify(cmd) + "\n");
    (stdin as import("bun").FileSink).flush();
  }

  private async ensureRunning(): Promise<void> {
    if (this.proc || this.starting) return;
    if (Date.now() - this.failedAt < 10000) return;
    await this.start();
  }

  private getBinaryPath(): string {
    return join(import.meta.dir, "..", "platform", BINARY_NAME);
  }

  private getSourcePath(): string {
    return join(import.meta.dir, "..", "platform", SWIFT_SOURCE);
  }

  private async ensureBinary(): Promise<string | null> {
    const binPath = this.getBinaryPath();
    const srcPath = this.getSourcePath();
    if (existsSync(binPath) && existsSync(srcPath)) {
      const binMtime = statSync(binPath).mtimeMs;
      const srcMtime = statSync(srcPath).mtimeMs;
      if (binMtime >= srcMtime) return binPath;
      console.log("[Soundboard] Source newer than binary, recompiling...");
    } else if (existsSync(binPath)) {
      return binPath;
    }

    if (!existsSync(srcPath)) {
      console.log("[Soundboard] Swift source not found at", srcPath);
      return null;
    }

    console.log("[Soundboard] Compiling soundboard player...");
    const compile = Bun.spawn(
      [
        "swiftc",
        "-O",
        "-framework", "AVFoundation",
        "-framework", "CoreAudio",
        "-framework", "AudioToolbox",
        "-o", binPath,
        srcPath,
      ],
      { stdout: "pipe", stderr: "pipe" }
    );

    const exitCode = await compile.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(compile.stderr).text();
      console.error("[Soundboard] Compilation failed:", stderr);
      return null;
    }

    console.log("[Soundboard] Compiled successfully");
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

      console.log("[Soundboard] Starting soundboard player...");
      this.proc = Bun.spawn([binPath], {
        stdout: "pipe",
        stderr: "pipe",
        stdin: "pipe",
      });

      this.pipeStderr();
      this.pipeStdout();

      this.proc.exited.then((code) => {
        if (code !== 0) {
          console.log("[Soundboard] Process exited with code", code);
        }
        this.proc = null;
        this.failedAt = Date.now();
        this.status = { ready: false, playing: [], blackholeAvailable: false, localVolume: 1, discordVolume: 1 };
      });
    } catch (err) {
      console.error("[Soundboard] Failed to start:", err);
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
        if (text) console.log("[Soundboard]", text);
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
            const data = JSON.parse(line) as Record<string, unknown>;
            this.handleMessage(data);
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch {
      // Process ended
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.status) {
      case "ready":
        this.status = {
          ready: true,
          playing: this.status.playing,
          blackholeAvailable: (msg.blackhole as boolean) ?? false,
          localVolume: (msg.localVolume as number) ?? 1,
          discordVolume: (msg.discordVolume as number) ?? 1,
        };
        console.log(
          `[Soundboard] Ready (BlackHole: ${this.status.blackholeAvailable ? "available" : "not found"})`
        );
        break;
      case "playing":
        this.status = {
          ...this.status,
          playing: (msg.sounds as string[]) ?? [],
          localVolume: (msg.localVolume as number) ?? this.status.localVolume,
          discordVolume: (msg.discordVolume as number) ?? this.status.discordVolume,
        };
        if ((msg.sounds as string[])?.length) {
          console.log("[Soundboard] Playing:", (msg.sounds as string[]).join(", "));
        }
        break;
      case "error":
        this.status = {
          ...this.status,
          error: msg.message as string,
        };
        console.error("[Soundboard] Error:", msg.message);
        break;
    }
  }
}
