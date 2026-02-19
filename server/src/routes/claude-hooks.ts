import { Hono } from "hono";
import type { ClaudeSessionsSource } from "../services/sources/claude-sessions";

// Map app names to their System Events process names
const PROCESS_NAME_MAP: Record<string, string> = {
  "Visual Studio Code": "Electron",
  Cursor: "Cursor",
  RustRover: "rustrover",
};

// Electron apps: use their CLI for window focusing (handles full-screen spaces)
const APP_CLI_MAP: Record<string, string> = {
  "Visual Studio Code":
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
  Cursor: "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
};

function getProcessName(app: string): string {
  return PROCESS_NAME_MAP[app] ?? app;
}

export function createClaudeHooksRouter(
  sessionSource: ClaudeSessionsSource
): Hono {
  const router = new Hono();

  router.post("/", async (c) => {
    try {
      const payload = await c.req.json();
      sessionSource.handleHook(payload);
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 400);
    }
  });

  router.post("/focus", async (c) => {
    try {
      const { sessionId } = await c.req.json();
      const session = sessionSource.getSession(sessionId);
      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      const app = session.parentApp;
      const cli = APP_CLI_MAP[app];

      if (cli && session.cwd) {
        // Electron apps (VS Code, Cursor): use their CLI to focus the right window
        Bun.spawn([cli, "--reuse-window", session.cwd]);
      } else {
        // Native apps (RustRover, etc.): AXRaise + activate
        const processName = getProcessName(app);
        const project = session.project;

        const script = `
          tell application "System Events"
            tell process "${processName}"
              set windowList to every window
              repeat with w in windowList
                if name of w contains "${project}" then
                  perform action "AXRaise" of w
                  exit repeat
                end if
              end repeat
            end tell
          end tell
          tell application "${app}" to activate
        `;

        Bun.spawn(["osascript", "-e", script]);
      }

      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 500);
    }
  });

  return router;
}
