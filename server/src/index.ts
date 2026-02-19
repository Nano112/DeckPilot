import { app, registerStaticFallback } from "./app";
import { loadConfig, getConfig } from "./config/store";
import { detectPlatform } from "./platform/detect";
import { ActionEngine } from "./actions/engine";
import { createWebSocketHandler, clients, setOnConfigChanged } from "./ws";
import { LiveDataManager } from "./services/liveData";
import { SpotifySource } from "./services/sources/spotify";
import { SystemStatsSource } from "./services/sources/systemStats";
import { DiscordSource } from "./services/sources/discord";
import { AudioFFTSource } from "./services/sources/audio-fft";
import { NowPlayingSource } from "./services/sources/now-playing";
import { SoundboardManager } from "./services/soundboard";
import { createDiscordRouter } from "./routes/discord";
import { createSoundsRouter } from "./routes/sounds";
import { iconsRouter } from "./routes/icons";
import { ClaudeSessionsSource } from "./services/sources/claude-sessions";
import { createClaudeHooksRouter } from "./routes/claude-hooks";
import { setupClaudeHooks } from "./services/claude-hooks-setup";

// Initialize
const config = loadConfig();
const platform = detectPlatform();
const discordSource = new DiscordSource();
const nowPlayingSource = new NowPlayingSource();
const soundboard = new SoundboardManager();
const claudeSessionsSource = new ClaudeSessionsSource();
const engine = new ActionEngine({ platform, discordSource, nowPlayingSource, soundboard });
const wsHandler = createWebSocketHandler(engine);

// Discord OAuth routes
app.route("/api/discord", createDiscordRouter(discordSource));

// Claude Code hooks
app.route("/api/hooks/claude", createClaudeHooksRouter(claudeSessionsSource));

// Sounds API
app.route("/api/sounds", createSoundsRouter(soundboard));

// Icons API
app.route("/api/icons", iconsRouter);

// Static fallback MUST be registered last (after all API routes)
registerStaticFallback();

const providers = [
  new SpotifySource(platform),
  nowPlayingSource,
  new SystemStatsSource(platform),
  discordSource,
  new AudioFFTSource(),
  soundboard,
  claudeSessionsSource,
];
const liveData = new LiveDataManager(providers, clients, getConfig);

// Refresh pollers when config changes (e.g. new data sources added)
setOnConfigChanged(() => liveData.refreshPollers());

// Wrap WS handler to manage live data polling on connect/disconnect
const wrappedWsHandler = {
  ...wsHandler,
  open(ws: import("bun").ServerWebSocket<unknown>) {
    wsHandler.open(ws);
    liveData.refreshPollers();
  },
  close(ws: import("bun").ServerWebSocket<unknown>) {
    wsHandler.close(ws);
    liveData.refreshPollers();
  },
};

// Auto-configure Claude Code hooks (idempotent)
setupClaudeHooks(config.server.port).catch((err) =>
  console.warn("Failed to configure Claude Code hooks:", err)
);

console.log(`DeckPilot server starting on port ${config.server.port}`);

export default {
  port: config.server.port,
  hostname: config.server.host,

  fetch(req: Request, server: import("bun").Server<unknown>): Response | Promise<Response> {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, { data: {} });
      if (upgraded) return undefined as unknown as Response;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return app.fetch(req, { env: {} } as never);
  },

  websocket: wrappedWsHandler,
};
