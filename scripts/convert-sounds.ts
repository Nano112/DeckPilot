#!/usr/bin/env bun
/**
 * Auto-convert audio files to WAV format for the DeckPilot soundboard.
 *
 * Usage:
 *   bun scripts/convert-sounds.ts [source-dir] [dest-dir]
 *
 * Defaults:
 *   source-dir: ./sounds
 *   dest-dir:   ~/Library/Application Support/deckpilot/sounds
 *
 * Converts any non-WAV audio file (mp3, ogg, m4a, flac, aac, opus, wma, webm)
 * to 16-bit 44.1kHz mono WAV using ffmpeg. Existing WAV files are copied as-is.
 * Already-converted files are skipped (based on filename).
 */

import { existsSync, mkdirSync, readdirSync } from "fs";
import { basename, extname, join } from "path";
import { homedir } from "os";

const SUPPORTED_EXTENSIONS = new Set([
  ".mp3",
  ".ogg",
  ".m4a",
  ".flac",
  ".aac",
  ".opus",
  ".wma",
  ".webm",
  ".wav",
]);

const DEFAULT_SOURCE = join(import.meta.dir, "..", "sounds");
const DEFAULT_DEST = join(
  homedir(),
  "Library",
  "Application Support",
  "deckpilot",
  "sounds"
);

export interface ConvertResult {
  file: string;
  status: "converted" | "copied" | "skipped" | "error";
  message?: string;
}

/** Check if ffmpeg is available */
async function hasFfmpeg(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["ffmpeg", "-version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/** Convert a single audio file to WAV */
export async function convertToWav(
  inputPath: string,
  outputPath: string
): Promise<ConvertResult> {
  const name = basename(inputPath);
  const ext = extname(inputPath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { file: name, status: "skipped", message: `unsupported format: ${ext}` };
  }

  // WAV files just get copied
  if (ext === ".wav") {
    try {
      await Bun.write(outputPath, Bun.file(inputPath));
      return { file: name, status: "copied" };
    } catch (e) {
      return { file: name, status: "error", message: String(e) };
    }
  }

  // Convert to 16-bit 44.1kHz mono WAV
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-i",
      inputPath,
      "-ar",
      "44100",
      "-ac",
      "1",
      "-sample_fmt",
      "s16",
      "-f",
      "wav",
      outputPath,
    ],
    { stdout: "pipe", stderr: "pipe" }
  );

  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    return {
      file: name,
      status: "error",
      message: stderr.split("\n").pop() || "ffmpeg failed",
    };
  }

  return { file: name, status: "converted" };
}

/** Convert all audio files in a directory to WAV in the destination directory */
export async function convertAll(
  sourceDir: string,
  destDir: string
): Promise<ConvertResult[]> {
  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory not found: ${sourceDir}`);
  }

  mkdirSync(destDir, { recursive: true });

  const files = readdirSync(sourceDir).filter((f) => {
    const ext = extname(f).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  });

  if (files.length === 0) {
    console.log("No audio files found in", sourceDir);
    return [];
  }

  const results: ConvertResult[] = [];

  for (const file of files) {
    const inputPath = join(sourceDir, file);
    const wavName = basename(file, extname(file)) + ".wav";
    const outputPath = join(destDir, wavName);

    // Skip if already exists in dest
    if (existsSync(outputPath)) {
      results.push({ file, status: "skipped", message: "already exists" });
      continue;
    }

    const result = await convertToWav(inputPath, outputPath);
    results.push(result);
  }

  return results;
}

// --- CLI entry point ---
if (import.meta.main) {
  const args = process.argv.slice(2);
  const sourceDir = args[0] || DEFAULT_SOURCE;
  const destDir = args[1] || DEFAULT_DEST;

  if (!(await hasFfmpeg())) {
    console.error("Error: ffmpeg not found. Install it with: brew install ffmpeg");
    process.exit(1);
  }

  console.log(`Converting sounds:`);
  console.log(`  from: ${sourceDir}`);
  console.log(`  to:   ${destDir}\n`);

  const results = await convertAll(sourceDir, destDir);

  for (const r of results) {
    const icon =
      r.status === "converted"
        ? "+"
        : r.status === "copied"
          ? "="
          : r.status === "skipped"
            ? "-"
            : "!";
    const msg = r.message ? ` (${r.message})` : "";
    console.log(`  [${icon}] ${r.file}${msg}`);
  }

  const converted = results.filter((r) => r.status === "converted").length;
  const copied = results.filter((r) => r.status === "copied").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  console.log(
    `\nDone: ${converted} converted, ${copied} copied, ${skipped} skipped, ${errors} errors`
  );

  if (errors > 0) process.exit(1);
}
