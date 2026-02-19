import type { ClaudeSession, ClaudeSessionsData } from "shared";
import type { DataSourceProvider } from "./types";

export interface ClaudeHookPayload {
  session_id: string;
  hook_event_name: string;
  tool_name?: string;
  cwd?: string;
  parent_app?: string; // injected by hook command from TERM_PROGRAM
}

const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Map detected app names to macOS app names (for osascript activate)
// Keys: what the process tree walker or TERM_PROGRAM might return
const APP_NAME_MAP: Record<string, string> = {
  // From process tree (.app bundle names)
  "Visual Studio Code": "Visual Studio Code",
  "Code": "Visual Studio Code",
  "Cursor": "Cursor",
  "RustRover": "RustRover",
  "IntelliJ IDEA": "IntelliJ IDEA",
  "WebStorm": "WebStorm",
  "PyCharm": "PyCharm",
  "GoLand": "GoLand",
  "CLion": "CLion",
  "iTerm2": "iTerm2",
  "iTerm": "iTerm2",
  "Terminal": "Terminal",
  "Warp": "Warp",
  "Alacritty": "Alacritty",
  "kitty": "kitty",
  // From TERM_PROGRAM env var
  vscode: "Visual Studio Code",
  "Apple_Terminal": "Terminal",
  "iTerm.app": "iTerm2",
  WarpTerminal: "Warp",
  JetBrains: "JetBrains",
  tmux: "Terminal",
};

function resolveParentApp(raw?: string): string {
  if (!raw) return "Terminal";
  return APP_NAME_MAP[raw] ?? raw;
}

export class ClaudeSessionsSource implements DataSourceProvider {
  readonly name = "claude_sessions";
  readonly intervalMs = 1000;

  private sessions = new Map<string, ClaudeSession>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanupStale(), 30_000);
  }

  async fetch(): Promise<ClaudeSessionsData> {
    return {
      sessions: Array.from(this.sessions.values()).sort(
        (a, b) => b.lastActivity - a.lastActivity
      ),
    };
  }

  getSession(sessionId: string): ClaudeSession | undefined {
    return this.sessions.get(sessionId);
  }

  handleHook(payload: ClaudeHookPayload): void {
    const { session_id, hook_event_name, tool_name, cwd, parent_app } = payload;
    const now = Date.now();

    console.log(`[Claude] ${hook_event_name} session=${session_id?.slice(0, 8)} tool=${tool_name ?? "-"} cwd=${cwd ?? "-"} app=${parent_app ?? "-"} sessions=${this.sessions.size}`);

    if (!session_id || !hook_event_name) {
      console.log("[Claude] Ignoring payload with missing session_id or hook_event_name");
      return;
    }

    switch (hook_event_name) {
      case "SessionStart": {
        this.sessions.set(session_id, {
          id: session_id,
          status: "idle",
          project: cwd ? basename(cwd) : "unknown",
          cwd: cwd ?? "",
          parentApp: resolveParentApp(parent_app),
          lastActivity: now,
        });
        break;
      }

      case "UserPromptSubmit": {
        const session = this.sessions.get(session_id);
        if (session) {
          session.status = "working";
          session.lastActivity = now;
          session.toolName = undefined;
          if (cwd) {
            session.cwd = cwd;
            session.project = basename(cwd);
          }
          if (parent_app) session.parentApp = resolveParentApp(parent_app);
        } else {
          this.sessions.set(session_id, {
            id: session_id,
            status: "working",
            project: cwd ? basename(cwd) : "unknown",
            cwd: cwd ?? "",
            parentApp: resolveParentApp(parent_app),
            lastActivity: now,
          });
        }
        break;
      }

      case "PreToolUse": {
        const session = this.sessions.get(session_id);
        if (session) {
          if (tool_name === "AskUserQuestion") {
            session.status = "waiting_for_input";
          } else {
            session.status = "working";
          }
          session.toolName = tool_name;
          session.lastActivity = now;
        } else {
          // Create session if we haven't seen it (e.g. started before server)
          this.sessions.set(session_id, {
            id: session_id,
            status: "working",
            project: cwd ? basename(cwd) : "unknown",
            cwd: cwd ?? "",
            parentApp: resolveParentApp(parent_app),
            lastActivity: now,
            toolName: tool_name,
          });
        }
        break;
      }

      case "Stop": {
        const session = this.sessions.get(session_id);
        if (session) {
          // Don't override waiting_for_input if it was set very recently
          if (
            session.status === "waiting_for_input" &&
            now - session.lastActivity < 500
          ) {
            // keep waiting_for_input
          } else {
            session.status = "idle";
            session.toolName = undefined;
          }
          session.lastActivity = now;
        } else if (cwd) {
          // Session unknown (e.g. server restarted) — register it as idle
          this.sessions.set(session_id, {
            id: session_id,
            status: "idle",
            project: basename(cwd),
            cwd,
            parentApp: resolveParentApp(parent_app),
            lastActivity: now,
          });
        }
        break;
      }

      case "SessionEnd": {
        console.log(`[Claude] Removing session ${session_id.slice(0, 8)}`);
        this.sessions.delete(session_id);
        break;
      }
    }

    console.log(`[Claude] After: ${this.sessions.size} sessions: ${[...this.sessions.values()].map(s => `${s.project}(${s.status})`).join(", ")}`);
  }

  stop(): void {
    clearInterval(this.cleanupTimer);
  }

  private cleanupStale(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > STALE_TIMEOUT_MS) {
        console.log(`[Claude] Cleaning stale session ${id.slice(0, 8)} (${session.project})`);
        this.sessions.delete(id);
      }
    }
  }
}

function basename(path: string): string {
  const parts = path.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || path;
}
