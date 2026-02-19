import type { ActionParamsMap } from "shared";
import type { PlatformActions } from "../platform/types";

export function createInputHandlers(platform: PlatformActions) {
  return {
    async hotkey(params: ActionParamsMap["input.hotkey"]): Promise<void> {
      await platform.pressKey(params.keys);
    },
  };
}
