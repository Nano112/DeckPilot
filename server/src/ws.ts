import type { ServerWebSocket } from "bun";
import type { Action, ClientMessage, ServerMessage, WidgetConfig } from "shared";
import { getConfig } from "./config/store";
import { ActionEngine } from "./actions/engine";

const clients = new Set<ServerWebSocket<unknown>>();

function broadcast(msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    ws.send(data);
  }
}

function send(ws: ServerWebSocket<unknown>, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function findWidget(pageId: string, widgetId: string): WidgetConfig | undefined {
  const config = getConfig();
  const profile = config.profiles.find((p) => p.id === config.activeProfile);
  if (!profile) return undefined;
  const page = profile.pages.find((p) => p.id === pageId);
  if (!page) return undefined;
  return page.widgets.find((w) => w.id === widgetId);
}

export function createWebSocketHandler(engine: ActionEngine) {
  return {
    open(ws: ServerWebSocket<unknown>) {
      clients.add(ws);
      send(ws, { type: "config", payload: getConfig() });
      send(ws, { type: "state_update", payload: { connected: true } });
    },

    async message(ws: ServerWebSocket<unknown>, raw: string | Buffer) {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        case "ping": {
          send(ws, { type: "pong" });
          break;
        }

        case "request_config": {
          send(ws, { type: "config", payload: getConfig() });
          break;
        }

        case "button_press":
        case "button_long_press": {
          // Handle inline controls (e.g. "spotify-np:play_pause", "sys-discord:toggle_mute", "sb:play:horn.wav")
          if (msg.actionId.includes(":")) {
            const parts = msg.actionId.split(":");
            const actionSuffix = parts[1];

            // Soundboard: "widgetId:play:filename.wav" or "widgetId:stop"
            if (actionSuffix === "play" && parts[2]) {
              const result = await engine.execute({
                type: "soundboard.play",
                params: { soundId: parts.slice(2).join(":") },
              });
              send(ws, { type: "action_result", payload: result });
              break;
            }
            if (actionSuffix === "stop_sound" && parts[2]) {
              const result = await engine.execute({
                type: "soundboard.stop",
                params: { soundId: parts.slice(2).join(":") },
              });
              send(ws, { type: "action_result", payload: result });
              break;
            }
            if (actionSuffix === "stop") {
              const result = await engine.execute({
                type: "soundboard.stop",
                params: {},
              });
              send(ws, { type: "action_result", payload: result });
              break;
            }
            if (actionSuffix === "set_volume" && parts[2] && parts[3]) {
              const level = parseFloat(parts[3]);
              if (!isNaN(level)) {
                const result = await engine.execute({
                  type: "soundboard.set_volume",
                  params: { target: parts[2] as "local" | "discord", level },
                });
                send(ws, { type: "action_result", payload: result });
              }
              break;
            }

            // Seek: "widgetId:seek:seconds"
            if (actionSuffix === "seek" && parts[2]) {
              const position = parseFloat(parts[2]);
              if (!isNaN(position)) {
                const result = await engine.execute({
                  type: "media.seek",
                  params: { position },
                });
                send(ws, { type: "action_result", payload: result });
              }
              break;
            }

            const inlineActions: Record<string, Action> = {
              play_pause: { type: "media.play_pause", params: {} },
              next: { type: "media.next", params: {} },
              previous: { type: "media.previous", params: {} },
              toggle_mute: { type: "discord.toggle_mute", params: {} },
              toggle_deafen: { type: "discord.toggle_deafen", params: {} },
              disconnect: { type: "discord.disconnect", params: {} },
            };
            const inlineAction = inlineActions[actionSuffix!];
            if (inlineAction) {
              const result = await engine.execute(inlineAction);
              send(ws, { type: "action_result", payload: result });
            }
            break;
          }

          const widget = findWidget(msg.page, msg.actionId);
          if (!widget?.action) break;

          const action =
            msg.type === "button_long_press" && widget.longPressAction
              ? widget.longPressAction
              : widget.action;

          const result = await engine.execute(action);
          send(ws, { type: "action_result", payload: result });
          break;
        }

        case "slider_change": {
          const widget = findWidget(msg.page, msg.widgetId);
          if (!widget?.sliderAction) break;

          // Inject the slider value into the action params
          const action = {
            ...widget.sliderAction,
            params: { ...widget.sliderAction.params, level: msg.value },
          };

          const result = await engine.execute(action);
          send(ws, { type: "action_result", payload: result });
          break;
        }

        case "gamepad_button": {
          const config = getConfig();
          const binding = config.gamepadBindings.find((b) => b.button === msg.button);
          if (!binding) break;

          // Skip client-side bindings — those are handled on the client
          if (binding.kind === "client") break;

          // Server-side bindings (or legacy bindings without kind)
          if (binding.action) {
            const result = await engine.execute(binding.action);
            send(ws, { type: "action_result", payload: result });
          }
          break;
        }
      }
    },

    close(ws: ServerWebSocket<unknown>) {
      clients.delete(ws);
    },
  };
}

// Config change callback for live data poller refresh
let onConfigChanged: (() => void) | null = null;
function setOnConfigChanged(cb: () => void): void {
  onConfigChanged = cb;
}
function notifyConfigChanged(): void {
  onConfigChanged?.();
}

export { broadcast, clients, setOnConfigChanged, notifyConfigChanged };
