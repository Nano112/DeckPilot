import { isTauri } from "./platform";

const STORE_KEY = "server_url";

/** Get the stored server URL (Tauri) or derive from window.location (browser) */
export async function getServerUrl(): Promise<string | null> {
  if (!isTauri()) {
    // Browser mode: server is same origin
    return window.location.origin;
  }

  // Tauri mode: load from persistent store
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json", { defaults: {}, autoSave: true });
    const url = await store.get<string>(STORE_KEY);
    return url ?? null;
  } catch {
    return null;
  }
}

/** Save the server URL in Tauri's persistent store */
export async function setServerUrl(url: string): Promise<void> {
  if (!isTauri()) return;

  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json", { defaults: {}, autoSave: true });
    await store.set(STORE_KEY, url);
    await store.save();
  } catch {
    // ignore
  }
}
