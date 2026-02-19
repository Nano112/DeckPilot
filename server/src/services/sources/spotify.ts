import type { PlatformActions } from "../../platform/types";
import type { DataSourceProvider } from "./types";

export class SpotifySource implements DataSourceProvider {
  readonly name = "spotify";
  readonly intervalMs = 1000;

  constructor(private platform: PlatformActions) {}

  async fetch(): Promise<unknown> {
    return this.platform.spotifyGetNowPlaying();
  }
}
