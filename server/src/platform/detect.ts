import type { PlatformActions } from "./types";
import { MacOSPlatform } from "./macos";

export function detectPlatform(): PlatformActions {
  switch (process.platform) {
    case "darwin":
      return new MacOSPlatform();
    case "win32": {
      // Lazy import to avoid loading stubs unless needed
      const { WindowsPlatform } = require("./windows");
      return new WindowsPlatform();
    }
    case "linux": {
      const { LinuxPlatform } = require("./linux");
      return new LinuxPlatform();
    }
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}
