// ── Action Types ──

export type ActionType =
  | "exec.shell"
  | "exec.applescript"
  | "media.play_pause"
  | "media.next"
  | "media.previous"
  | "audio.volume_up"
  | "audio.volume_down"
  | "audio.volume_set"
  | "audio.mute"
  | "system.open_url"
  | "system.launch_app"
  | "input.hotkey"
  | "spotify.play_pause"
  | "spotify.next"
  | "spotify.previous"
  | "clipboard.copy"
  | "discord.toggle_mute"
  | "discord.toggle_deafen"
  | "discord.disconnect"
  | "media.seek"
  | "soundboard.play"
  | "soundboard.stop"
  | "soundboard.set_volume";

export interface ActionParamsMap {
  "exec.shell": { command: string };
  "exec.applescript": { script: string };
  "media.play_pause": Record<string, never>;
  "media.next": Record<string, never>;
  "media.previous": Record<string, never>;
  "media.seek": { position: number };
  "audio.volume_up": { step?: number };
  "audio.volume_down": { step?: number };
  "audio.volume_set": { level: number };
  "audio.mute": Record<string, never>;
  "system.open_url": { url: string };
  "system.launch_app": { app: string };
  "input.hotkey": { keys: string[] };
  "spotify.play_pause": Record<string, never>;
  "spotify.next": Record<string, never>;
  "spotify.previous": Record<string, never>;
  "clipboard.copy": { text: string };
  "discord.toggle_mute": Record<string, never>;
  "discord.toggle_deafen": Record<string, never>;
  "discord.disconnect": Record<string, never>;
  "soundboard.play": { soundId: string };
  "soundboard.stop": Record<string, never>;
  "soundboard.set_volume": { target: "local" | "discord"; level: number };
}

export interface Action<T extends ActionType = ActionType> {
  type: T;
  params: T extends keyof ActionParamsMap ? ActionParamsMap[T] : Record<string, unknown>;
}

// ── Widget Types ──

export type WidgetType = "button" | "slider" | "now_playing" | "spacer" | "soundboard";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  label: string;
  icon?: string;
  color?: string;
  position: { row: number; col: number; colspan?: number; rowspan?: number };
  variant?: string;
  widgetProps?: Record<string, unknown>;

  // button-specific
  action?: Action;
  longPressAction?: Action;

  // slider-specific
  sliderAction?: Action;
  min?: number;
  max?: number;
  step?: number;

  // now_playing / live data
  dataSource?: string;
}

/** @deprecated Use WidgetConfig instead */
export type ButtonConfig = WidgetConfig;

export interface GridConfig {
  columns: number;
  rows: number;
}

export interface PageGridPosition {
  row: number;
  col: number;
}

export interface PageConfig {
  id: string;
  name: string;
  gridPosition: PageGridPosition;
  widgets: WidgetConfig[];
  /** @deprecated Use widgets instead */
  buttons?: WidgetConfig[];
}

export interface ProfileConfig {
  id: string;
  name: string;
  grid: GridConfig;
  pages: PageConfig[];
  pageGridSize?: { rows: number; cols: number };
}

// ── Client-Side Actions (no server round-trip) ──

export type ClientActionType = "nav.page.next" | "nav.page.previous" | "nav.page.up" | "nav.page.down" | "nav.page.overview";

export interface GamepadBinding {
  button: number;
  kind: "client" | "server";
  action?: Action;
  clientAction?: ClientActionType;
  label?: string;
}

export interface DeckPilotConfig {
  version: number;
  server: { port: number; host: string };
  activeProfile: string;
  profiles: ProfileConfig[];
  gamepadBindings: GamepadBinding[];
}

// ── Now Playing Data ──

export interface NowPlayingData {
  track: string;
  artist: string;
  album: string;
  artwork: string;
  progress: number;
  duration: number;
  isPlaying: boolean;
  app?: string;
  playbackRate?: number;
}

// ── Spotify Data ──

export interface SpotifyNowPlayingData {
  track: string;
  artist: string;
  album: string;
  albumArt: string;
  progress: number;
  duration: number;
  isPlaying: boolean;
}

// ── System Stats Data ──

export interface SystemStatsData {
  cpu: number;
  memory: { used: number; total: number; pct: number };
  battery: { pct: number; charging: boolean } | null;
  disk: { used: string; total: string; pct: number };
}

// ── Discord Presence Data ──

export interface DiscordVoiceMember {
  id: string;
  username: string;
  mute: boolean;
  deaf: boolean;
  selfMute: boolean;
  selfDeaf: boolean;
}

export interface DiscordPresenceData {
  user: string;
  activity: { name: string; details?: string; state?: string; largeImage?: string } | null;
  voiceChannel: { name: string; guild: string } | null;
  voiceSettings: { mute: boolean; deaf: boolean } | null;
  voiceMembers: DiscordVoiceMember[];
}

// ── Soundboard Data ──

export interface SoundboardStatusData {
  ready: boolean;
  playing: string[];
  blackholeAvailable: boolean;
  localVolume: number;
  discordVolume: number;
  error?: string;
}

// ── Audio FFT Data ──

export interface AudioFFTData {
  bins: number[];
  rms: number;
}

// ── Claude Sessions Data ──

export interface ClaudeSession {
  id: string;
  status: "idle" | "working" | "waiting_for_input";
  project: string;
  cwd: string;
  parentApp: string;
  lastActivity: number;
  toolName?: string;
}

export interface ClaudeSessionsData {
  sessions: ClaudeSession[];
}

// ── WebSocket Protocol ──

export type ClientMessage =
  | { type: "button_press"; actionId: string; page: string }
  | { type: "button_long_press"; actionId: string; page: string }
  | { type: "slider_change"; widgetId: string; page: string; value: number }
  | { type: "gamepad_button"; button: number }
  | { type: "request_config" }
  | { type: "ping" };

export type ServerMessage =
  | { type: "config"; payload: DeckPilotConfig }
  | { type: "config_updated"; payload: DeckPilotConfig }
  | { type: "action_result"; payload: ActionResult }
  | { type: "state_update"; payload: StateUpdate }
  | { type: "live_data"; source: string; data: unknown }
  | { type: "pong" };

export interface ActionResult {
  success: boolean;
  actionType: ActionType;
  error?: string;
}

export interface StateUpdate {
  volume?: number;
  muted?: boolean;
  connected: boolean;
}
