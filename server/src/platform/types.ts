export interface PlatformActions {
  // Audio
  getVolume(): Promise<number>;
  setVolume(level: number): Promise<void>;
  getMuted(): Promise<boolean>;
  setMuted(muted: boolean): Promise<void>;

  // Media
  mediaPlayPause(): Promise<void>;
  mediaNext(): Promise<void>;
  mediaPrevious(): Promise<void>;
  mediaStop(): Promise<void>;

  // System
  openUrl(url: string): Promise<void>;
  launchApp(app: string): Promise<void>;
  lockScreen(): Promise<void>;
  sleep(): Promise<void>;

  // Input
  pressKey(keys: string[]): Promise<void>;
  typeText(text: string): Promise<void>;

  // Window management
  focusWindow(app: string): Promise<void>;
  closeWindow(): Promise<void>;
  minimizeWindow(): Promise<void>;

  // Clipboard
  getClipboard(): Promise<string>;
  setClipboard(text: string): Promise<void>;

  // Spotify
  spotifyGetNowPlaying(): Promise<import("shared").SpotifyNowPlayingData | null>;
  spotifyPlayPause(): Promise<void>;
  spotifyNext(): Promise<void>;
  spotifyPrevious(): Promise<void>;

  // System info
  getCpuUsage(): Promise<number>;
  getMemoryUsage(): Promise<{ used: number; total: number; pct: number }>;
  getBatteryInfo(): Promise<{ pct: number; charging: boolean } | null>;
  getDiskUsage(): Promise<{ used: string; total: string; pct: number }>;
  screenshot(): Promise<Buffer>;
}
