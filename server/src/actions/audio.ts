import type { ActionParamsMap } from "shared";
import type { PlatformActions } from "../platform/types";

export function createAudioHandlers(platform: PlatformActions) {
  return {
    async volumeUp(params: ActionParamsMap["audio.volume_up"]): Promise<void> {
      const step = params.step ?? 10;
      const current = await platform.getVolume();
      await platform.setVolume(Math.min(100, current + step));
    },
    async volumeDown(params: ActionParamsMap["audio.volume_down"]): Promise<void> {
      const step = params.step ?? 10;
      const current = await platform.getVolume();
      await platform.setVolume(Math.max(0, current - step));
    },
    async volumeSet(params: ActionParamsMap["audio.volume_set"]): Promise<void> {
      await platform.setVolume(params.level);
    },
    async mute(): Promise<void> {
      const muted = await platform.getMuted();
      await platform.setMuted(!muted);
    },
  };
}
