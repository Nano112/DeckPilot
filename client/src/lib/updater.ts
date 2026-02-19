import { isTauri } from "./platform";

/** Check for updates and prompt user to install. No-op in browser mode. */
export async function checkForUpdates(): Promise<void> {
  if (!isTauri()) return;

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const { ask } = await import("@tauri-apps/plugin-dialog");
    const { relaunch } = await import("@tauri-apps/plugin-process");

    const update = await check();
    if (!update) return;

    const yes = await ask(
      `DeckPilot ${update.version} is available. Update now?`,
      { title: "Update Available", kind: "info", okLabel: "Update", cancelLabel: "Later" }
    );

    if (yes) {
      await update.downloadAndInstall();
      await relaunch();
    }
  } catch (e) {
    console.warn("[Updater] Check failed:", e);
  }
}
