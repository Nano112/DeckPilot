import type { ServerWebSocket } from "bun";
import type { ServerMessage, DeckPilotConfig } from "shared";
import type { DataSourceProvider } from "./sources/types";

type DataPoller = {
  interval: ReturnType<typeof setInterval>;
  source: string;
};

export class LiveDataManager {
  private providers: Map<string, DataSourceProvider>;
  private clients: Set<ServerWebSocket<unknown>>;
  private pollers: Map<string, DataPoller> = new Map();
  private getConfig: () => DeckPilotConfig;

  constructor(
    providers: DataSourceProvider[],
    clients: Set<ServerWebSocket<unknown>>,
    getConfig: () => DeckPilotConfig
  ) {
    this.providers = new Map(providers.map((p) => [p.name, p]));
    this.clients = clients;
    this.getConfig = getConfig;
  }

  refreshPollers(): void {
    const needed = this.getNeededSources();

    // Stop pollers for sources no longer needed
    for (const [source, poller] of this.pollers) {
      if (!needed.has(source)) {
        clearInterval(poller.interval);
        this.pollers.delete(source);
      }
    }

    // Start pollers for new sources
    for (const source of needed) {
      if (!this.pollers.has(source)) {
        this.startPoller(source);
      }
    }
  }

  stop(): void {
    for (const [, poller] of this.pollers) {
      clearInterval(poller.interval);
    }
    this.pollers.clear();
  }

  private getNeededSources(): Set<string> {
    if (this.clients.size === 0) return new Set();

    const sources = new Set<string>();
    const config = this.getConfig();
    const profile = config.profiles.find((p) => p.id === config.activeProfile);
    if (!profile) return sources;

    for (const page of profile.pages) {
      for (const widget of page.widgets) {
        if (widget.dataSource) {
          sources.add(widget.dataSource);
        }
      }
    }
    return sources;
  }

  private startPoller(source: string): void {
    const provider = this.providers.get(source);
    if (!provider) return;

    const poll = async () => {
      if (this.clients.size === 0) return;

      try {
        const data = await provider.fetch();
        if (data !== null) {
          this.broadcast({ type: "live_data", source, data });
        }
      } catch {
        // Silently skip failed polls
      }
    };

    // Poll immediately, then on the provider's interval
    poll();
    const interval = setInterval(poll, provider.intervalMs);
    this.pollers.set(source, { interval, source });
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients) {
      ws.send(data);
    }
  }
}
