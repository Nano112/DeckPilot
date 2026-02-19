import { isTauri } from "./platform";

/** Trigger haptic feedback on the gamepad controller.
 *  No-op in browser mode. */
export async function triggerHaptic(strength = 0.2, durationMs = 40): Promise<void> {
  if (!isTauri()) return;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("trigger_haptic", { strength, durationMs });
  } catch {
    // ignore — no controller connected or not in Tauri
  }
}
