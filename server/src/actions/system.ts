import type { ActionParamsMap } from "shared";
import type { PlatformActions } from "../platform/types";

export function createSystemHandlers(platform: PlatformActions) {
  return {
    async openUrl(params: ActionParamsMap["system.open_url"]): Promise<void> {
      await platform.openUrl(params.url);
    },
    async launchApp(params: ActionParamsMap["system.launch_app"]): Promise<void> {
      await platform.launchApp(params.app);
    },
  };
}
