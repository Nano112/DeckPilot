import type { Action, ActionType } from "shared";
import type { PlatformActions } from "../platform/types";
import type { DiscordSource } from "../services/sources/discord";
import type { NowPlayingSource } from "../services/sources/now-playing";
import type { SoundboardManager } from "../services/soundboard";
import { execShell, execAppleScript } from "./exec";
import { createMediaHandlers } from "./media";
import { createAudioHandlers } from "./audio";
import { createSystemHandlers } from "./system";
import { createInputHandlers } from "./input";
import { createDiscordHandlers } from "./discord";
import { createSoundboardHandlers } from "./soundboard";

type ActionHandler = (params: Record<string, unknown>) => Promise<void>;

export interface RegistryOptions {
  platform: PlatformActions;
  discordSource?: DiscordSource;
  nowPlayingSource?: NowPlayingSource;
  soundboard?: SoundboardManager;
}

export function createRegistry(opts: RegistryOptions): Map<ActionType, ActionHandler> {
  const { platform, discordSource, nowPlayingSource, soundboard: soundboardManager } = opts;
  const media = createMediaHandlers(platform, nowPlayingSource);
  const audio = createAudioHandlers(platform);
  const system = createSystemHandlers(platform);
  const input = createInputHandlers(platform);

  const registry = new Map<ActionType, ActionHandler>();

  registry.set("exec.shell", (p) => execShell(p as Action<"exec.shell">["params"]));
  registry.set("exec.applescript", (p) => execAppleScript(p as Action<"exec.applescript">["params"]));
  registry.set("media.play_pause", () => media.playPause());
  registry.set("media.next", () => media.next());
  registry.set("media.previous", () => media.previous());
  registry.set("media.seek", (p) => media.seek(p as { position: number }));
  registry.set("audio.volume_up", (p) => audio.volumeUp(p as Action<"audio.volume_up">["params"]));
  registry.set("audio.volume_down", (p) => audio.volumeDown(p as Action<"audio.volume_down">["params"]));
  registry.set("audio.volume_set", (p) => audio.volumeSet(p as Action<"audio.volume_set">["params"]));
  registry.set("audio.mute", () => audio.mute());
  registry.set("system.open_url", (p) => system.openUrl(p as Action<"system.open_url">["params"]));
  registry.set("system.launch_app", (p) => system.launchApp(p as Action<"system.launch_app">["params"]));
  registry.set("input.hotkey", (p) => input.hotkey(p as Action<"input.hotkey">["params"]));

  // Spotify
  registry.set("spotify.play_pause", () => platform.spotifyPlayPause());
  registry.set("spotify.next", () => platform.spotifyNext());
  registry.set("spotify.previous", () => platform.spotifyPrevious());

  // Discord
  if (discordSource) {
    const discord = createDiscordHandlers(discordSource);
    registry.set("discord.toggle_mute", () => discord.toggleMute());
    registry.set("discord.toggle_deafen", () => discord.toggleDeafen());
    registry.set("discord.disconnect", () => discord.disconnect());
  }

  // Soundboard
  if (soundboardManager) {
    const soundboard = createSoundboardHandlers(soundboardManager);
    registry.set("soundboard.play", (p) => soundboard.play(p as { soundId?: string }));
    registry.set("soundboard.stop", (p) => soundboard.stop(p as { soundId?: string }));
    registry.set("soundboard.set_volume", (p) => soundboard.setVolume(p as { target: string; level: number }));
  }

  return registry;
}
