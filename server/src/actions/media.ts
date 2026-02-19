import type { PlatformActions } from "../platform/types";
import type { NowPlayingSource } from "../services/sources/now-playing";

export function createMediaHandlers(
  platform: PlatformActions,
  nowPlayingSource?: NowPlayingSource,
) {
  return {
    async playPause(): Promise<void> {
      await platform.mediaPlayPause();
    },
    async next(): Promise<void> {
      await platform.mediaNext();
    },
    async previous(): Promise<void> {
      await platform.mediaPrevious();
    },
    async seek(params: { position: number }): Promise<void> {
      nowPlayingSource?.seek(params.position);
    },
  };
}
