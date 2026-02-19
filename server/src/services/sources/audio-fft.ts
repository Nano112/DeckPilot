import { existsSync } from "fs";
import { join } from "path";
import type { DataSourceProvider } from "./types";

export interface AudioFFTData {
  bins: number[];
  rms: number;
}

const BINARY_NAME = "audio-capture";
const SWIFT_SOURCE = "audio-capture.swift";

export class AudioFFTSource implements DataSourceProvider {
  readonly name = "audio_fft";
  readonly intervalMs = 50; // 20fps

  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private cached: AudioFFTData | null = null;
  private starting = false;
  private failedAt = 0;
  private partial = "";

  async fetch(): Promise<AudioFFTData | null> {
    if (!this.proc && !this.starting) {
      // Don't retry too fast after failure
      if (Date.now() - this.failedAt < 30000) return this.cached;
      await this.start();
    }
    return this.cached;
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
      console.log("[AudioFFT] Swift source not found at", srcPath);
      return null;
    }

    console.log("[AudioFFT] Compiling audio capture helper...");
    const compile = Bun.spawn([
      "swiftc", "-O",
      "-framework", "ScreenCaptureKit",
      "-framework", "CoreMedia",
      "-framework", "Accelerate",
      "-o", binPath,
      srcPath,
    ], { stdout: "pipe", stderr: "pipe" });

    const exitCode = await compile.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(compile.stderr).text();
      console.error("[AudioFFT] Compilation failed:", stderr);
      return null;
    }

    console.log("[AudioFFT] Compiled successfully");
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

      console.log("[AudioFFT] Starting audio capture...");
      this.proc = Bun.spawn([binPath], {
        stdout: "pipe",
        stderr: "pipe",
      });

      // Read stderr for diagnostics in background
      this.pipeStderr();

      // Read stdout for FFT data
      this.pipeStdout();

      // Monitor for exit
      this.proc.exited.then((code) => {
        if (code !== 0) {
          console.log("[AudioFFT] Process exited with code", code);
          if (code === 1) {
            console.log(
              "[AudioFFT] Screen Recording permission may be needed.",
            );
            console.log(
              "[AudioFFT] Go to System Settings > Privacy & Security > Screen & System Audio Recording",
            );
            console.log(
              "[AudioFFT] and enable your terminal app, then restart the server.",
            );
          }
        }
        this.proc = null;
        this.failedAt = Date.now();
      });
    } catch (err) {
      console.error("[AudioFFT] Failed to start:", err);
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
        if (text) console.log("[AudioFFT]", text);
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
            const data = JSON.parse(line) as AudioFFTData;
            if (data.bins && Array.isArray(data.bins)) {
              this.cached = data;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch {
      // Process ended
    }
  }
}
