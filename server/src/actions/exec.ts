import type { ActionParamsMap } from "shared";

export async function execShell(params: ActionParamsMap["exec.shell"]): Promise<void> {
  const proc = Bun.spawn(["sh", "-c", params.command], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Command failed (exit ${exitCode}): ${stderr.trim()}`);
  }
}

export async function execAppleScript(params: ActionParamsMap["exec.applescript"]): Promise<void> {
  const proc = Bun.spawn(["osascript", "-e", params.script], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`AppleScript failed (exit ${exitCode}): ${stderr.trim()}`);
  }
}
