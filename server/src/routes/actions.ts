import { Hono } from "hono";
import type { ActionType } from "shared";

const actionsRouter = new Hono();

const availableActions: { type: ActionType; description: string }[] = [
  { type: "exec.shell", description: "Execute a shell command" },
  { type: "exec.applescript", description: "Execute an AppleScript" },
  { type: "media.play_pause", description: "Toggle media play/pause" },
  { type: "media.next", description: "Next track" },
  { type: "media.previous", description: "Previous track" },
  { type: "audio.volume_up", description: "Increase volume" },
  { type: "audio.volume_down", description: "Decrease volume" },
  { type: "audio.volume_set", description: "Set volume to specific level" },
  { type: "audio.mute", description: "Toggle mute" },
  { type: "system.open_url", description: "Open a URL in default browser" },
  { type: "system.launch_app", description: "Launch an application" },
  { type: "input.hotkey", description: "Send a keyboard shortcut" },
];

actionsRouter.get("/", (c) => {
  return c.json(availableActions);
});

export { actionsRouter };
