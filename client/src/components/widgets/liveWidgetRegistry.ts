import type { WidgetConfig } from "shared";

export interface LiveWidgetProps {
  widget: WidgetConfig;
  data: unknown;
  onPress: (id: string) => void;
  onSliderChange?: (widgetId: string, value: number) => void;
}

export type LiveWidgetComponent = React.ComponentType<LiveWidgetProps>;

// Registry: dataSource → variant → Component
// Populated lazily to avoid circular imports
const registry: Record<string, Record<string, LiveWidgetComponent>> = {};

export function registerLiveWidget(
  dataSource: string,
  variant: string,
  component: LiveWidgetComponent
): void {
  if (!registry[dataSource]) registry[dataSource] = {};
  registry[dataSource][variant] = component;
}

export function getLiveWidget(
  dataSource: string,
  variant?: string
): LiveWidgetComponent | null {
  const sourceWidgets = registry[dataSource];
  if (!sourceWidgets) return null;
  return sourceWidgets[variant ?? "default"] ?? sourceWidgets["default"] ?? null;
}

// Register all live widgets
import { NowPlaying } from "./NowPlaying";
import { SystemStats } from "./SystemStats";
import { DiscordPresence } from "./DiscordPresence";
import { StatGauge } from "./stats/StatGauge";
import { StatTimeSeries } from "./stats/StatTimeSeries";
import { StatBar } from "./stats/StatBar";
import { AudioVisualizer } from "./AudioVisualizer";
import { SoundboardWidget } from "./SoundboardWidget";
import { ClaudeSessionsWidget } from "./ClaudeSessionsWidget";

registerLiveWidget("now_playing", "default", NowPlaying);
registerLiveWidget("spotify", "default", NowPlaying);
registerLiveWidget("audio_fft", "default", AudioVisualizer);
registerLiveWidget("system_stats", "default", SystemStats);
registerLiveWidget("system_stats", "gauge", StatGauge);
registerLiveWidget("system_stats", "timeseries", StatTimeSeries);
registerLiveWidget("system_stats", "bar", StatBar);
registerLiveWidget("discord", "default", DiscordPresence);
registerLiveWidget("soundboard", "default", SoundboardWidget);
registerLiveWidget("claude_sessions", "default", ClaudeSessionsWidget);
