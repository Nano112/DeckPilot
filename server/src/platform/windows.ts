import type { PlatformActions } from "./types";

const NOT_IMPLEMENTED = "Windows support not yet implemented";

export class WindowsPlatform implements PlatformActions {
  async getVolume(): Promise<number> { throw new Error(NOT_IMPLEMENTED); }
  async setVolume(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async getMuted(): Promise<boolean> { throw new Error(NOT_IMPLEMENTED); }
  async setMuted(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async mediaPlayPause(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async mediaNext(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async mediaPrevious(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async mediaStop(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async openUrl(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async launchApp(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async lockScreen(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async sleep(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async pressKey(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async typeText(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async focusWindow(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async closeWindow(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async minimizeWindow(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async getClipboard(): Promise<string> { throw new Error(NOT_IMPLEMENTED); }
  async setClipboard(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async spotifyGetNowPlaying() { throw new Error(NOT_IMPLEMENTED); return null as never; }
  async spotifyPlayPause(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async spotifyNext(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async spotifyPrevious(): Promise<void> { throw new Error(NOT_IMPLEMENTED); }
  async getCpuUsage(): Promise<number> { throw new Error(NOT_IMPLEMENTED); }
  async getMemoryUsage(): Promise<{ used: number; total: number; pct: number }> { throw new Error(NOT_IMPLEMENTED); }
  async getBatteryInfo(): Promise<{ pct: number; charging: boolean } | null> { throw new Error(NOT_IMPLEMENTED); }
  async getDiskUsage(): Promise<{ used: string; total: string; pct: number }> { throw new Error(NOT_IMPLEMENTED); }
  async screenshot(): Promise<Buffer> { throw new Error(NOT_IMPLEMENTED); }
}
