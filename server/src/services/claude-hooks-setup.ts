import { homedir } from "os";
import { join } from "path";

const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "Stop",
  "SessionEnd",
] as const;

const MARKER = "deckpilot-hook";

function makeHookCommand(_port: number): string {
  return `/usr/bin/python3 ~/.claude/deckpilot-hook.py`;
}

function makeHookEntry(port: number) {
  return {
    hooks: [
      {
        type: "command" as const,
        command: makeHookCommand(port),
        async: true,
        statusMessage: MARKER,
      },
    ],
  };
}

function isDeckPilotHook(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  if (!Array.isArray(e.hooks)) return false;
  return e.hooks.some(
    (h: unknown) =>
      h &&
      typeof h === "object" &&
      (h as Record<string, unknown>).statusMessage === MARKER
  );
}

export async function setupClaudeHooks(port: number): Promise<void> {
  const settingsPath = join(homedir(), ".claude", "settings.json");
  const file = Bun.file(settingsPath);

  let settings: Record<string, unknown> = {};
  if (await file.exists()) {
    settings = await file.json();
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  let changed = false;

  for (const event of HOOK_EVENTS) {
    const existing = hooks[event];
    if (Array.isArray(existing) && existing.some(isDeckPilotHook)) {
      continue; // Already configured
    }

    if (!Array.isArray(existing)) {
      hooks[event] = [makeHookEntry(port)];
    } else {
      existing.push(makeHookEntry(port));
    }
    changed = true;
  }

  if (changed) {
    settings.hooks = hooks;
    await Bun.write(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log("Claude Code hooks configured for DeckPilot");
  } else {
    console.log("Claude Code hooks already configured");
  }
}
