import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { DeckPilotConfig } from "shared";
import { configSchema } from "./schema";
import { defaultConfig } from "./defaults";

function getConfigDir(): string {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", "deckpilot");
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "deckpilot");
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "deckpilot");
  }
}

const configDir = getConfigDir();
const configPath = join(configDir, "config.json");

let currentConfig: DeckPilotConfig = defaultConfig;

function migrateConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const version = (raw.version as number) ?? 1;

  if (version < 2) {
    // Migrate v1 (buttons) → v2 (widgets)
    const profiles = raw.profiles as Array<Record<string, unknown>> | undefined;
    if (profiles) {
      for (const profile of profiles) {
        const pages = profile.pages as Array<Record<string, unknown>> | undefined;
        if (pages) {
          for (const page of pages) {
            if (page.buttons && !page.widgets) {
              // Convert buttons to widgets with type: "button"
              const buttons = page.buttons as Array<Record<string, unknown>>;
              page.widgets = buttons.map((btn) => ({
                ...btn,
                type: btn.type ?? "button",
              }));
              delete page.buttons;
            }
          }
        }
      }
    }
    raw.version = 2;
  }

  if (version < 3) {
    // Existing bindings become server-side
    raw.gamepadBindings = (
      (raw.gamepadBindings as Array<Record<string, unknown>>) || []
    ).map((b) => ({
      ...b,
      kind: "server",
      label: b.label ?? undefined,
    }));
    // Add default page nav bindings (replace any existing L1/R1 server bindings)
    const existing = raw.gamepadBindings as Array<Record<string, unknown>>;
    const hasBtn4 = existing.some((b) => b.button === 4);
    const hasBtn5 = existing.some((b) => b.button === 5);
    if (hasBtn4) {
      const idx = existing.findIndex((b) => b.button === 4);
      existing[idx] = { button: 4, kind: "client", clientAction: "nav.page.previous", label: "Previous Page" };
    } else {
      existing.push({ button: 4, kind: "client", clientAction: "nav.page.previous", label: "Previous Page" });
    }
    if (hasBtn5) {
      const idx = existing.findIndex((b) => b.button === 5);
      existing[idx] = { button: 5, kind: "client", clientAction: "nav.page.next", label: "Next Page" };
    } else {
      existing.push({ button: 5, kind: "client", clientAction: "nav.page.next", label: "Next Page" });
    }
    raw.version = 3;
  }

  if (version < 4) {
    // Add Setup page with clipboard copy buttons for Steam Deck configuration
    const profiles = raw.profiles as Array<Record<string, unknown>> | undefined;
    if (profiles) {
      for (const profile of profiles) {
        const pages = profile.pages as Array<Record<string, unknown>> | undefined;
        if (pages && !pages.some((p) => p.id === "setup")) {
          pages.push({
            id: "setup",
            name: "Setup",
            widgets: [
              {
                id: "setup-title",
                type: "spacer",
                label: "",
                position: { row: 0, col: 0, colspan: 5 },
              },
              {
                id: "copy-udev",
                type: "button",
                label: "Fix Gamepad (udev)",
                icon: "clipboard",
                color: "#22c55e",
                action: {
                  type: "clipboard.copy",
                  params: {
                    text: "flatpak --user override --filesystem=/run/udev:ro com.google.Chrome",
                  },
                },
                position: { row: 1, col: 0, colspan: 3 },
              },
              {
                id: "copy-kiosk",
                type: "button",
                label: "Kiosk Launch Opts",
                icon: "clipboard",
                color: "#3b82f6",
                action: {
                  type: "clipboard.copy",
                  params: {
                    text: '--window-size=1280,800 --force-device-scale-factor=1.25 --device-scale-factor=1.25 --kiosk "http://localhost:9900"',
                  },
                },
                position: { row: 1, col: 3, colspan: 2 },
              },
              {
                id: "copy-url",
                type: "button",
                label: "Server URL",
                icon: "clipboard",
                color: "#6366f1",
                action: {
                  type: "clipboard.copy",
                  params: { text: "http://localhost:9900" },
                },
                position: { row: 2, col: 0, colspan: 2 },
              },
              {
                id: "copy-steam-input",
                type: "button",
                label: "Steam Input: Gamepad w/ Mouse Trackpad",
                icon: "clipboard",
                color: "#f59e0b",
                action: {
                  type: "clipboard.copy",
                  params: { text: "Set Steam Input to: Gamepad with Mouse Trackpad" },
                },
                position: { row: 2, col: 2, colspan: 3 },
              },
            ],
          });
        }
      }
    }
    raw.version = 4;
  }

  if (version < 5) {
    // Add System stats page
    const profiles = raw.profiles as Array<Record<string, unknown>> | undefined;
    if (profiles) {
      for (const profile of profiles) {
        const pages = profile.pages as Array<Record<string, unknown>> | undefined;
        if (pages && !pages.some((p) => p.id === "system")) {
          // Insert before setup page if it exists, otherwise at end
          const setupIdx = pages.findIndex((p) => p.id === "setup");
          const systemPage = {
            id: "system",
            name: "System",
            widgets: [
              {
                id: "sys-stats",
                type: "now_playing",
                label: "System Stats",
                color: "#6366f1",
                position: { row: 0, col: 0, colspan: 5, rowspan: 3 },
                dataSource: "system_stats",
              },
            ],
          };
          if (setupIdx >= 0) {
            pages.splice(setupIdx, 0, systemPage);
          } else {
            pages.push(systemPage);
          }
        }
      }
    }
    raw.version = 5;
  }

  if (version < 6) {
    // Replace single full-grid system stats widget with individual metric widgets
    const profiles = raw.profiles as Array<Record<string, unknown>> | undefined;
    if (profiles) {
      for (const profile of profiles) {
        const pages = profile.pages as Array<Record<string, unknown>> | undefined;
        if (pages) {
          const systemPage = pages.find((p) => p.id === "system");
          if (systemPage) {
            systemPage.widgets = [
              {
                id: "sys-cpu-gauge",
                type: "now_playing",
                label: "CPU",
                color: "#3b82f6",
                position: { row: 0, col: 0 },
                dataSource: "system_stats",
                variant: "gauge",
                widgetProps: { metric: "cpu" },
              },
              {
                id: "sys-mem-gauge",
                type: "now_playing",
                label: "Memory",
                color: "#22c55e",
                position: { row: 0, col: 1 },
                dataSource: "system_stats",
                variant: "gauge",
                widgetProps: { metric: "memory" },
              },
              {
                id: "sys-bat-gauge",
                type: "now_playing",
                label: "Battery",
                color: "#f59e0b",
                position: { row: 0, col: 2 },
                dataSource: "system_stats",
                variant: "gauge",
                widgetProps: { metric: "battery" },
              },
              {
                id: "sys-disk-gauge",
                type: "now_playing",
                label: "Disk",
                color: "#a855f7",
                position: { row: 0, col: 3, colspan: 2 },
                dataSource: "system_stats",
                variant: "bar",
                widgetProps: { metric: "disk" },
              },
              {
                id: "sys-cpu-ts",
                type: "now_playing",
                label: "CPU History",
                color: "#3b82f6",
                position: { row: 1, col: 0, colspan: 3, rowspan: 2 },
                dataSource: "system_stats",
                variant: "timeseries",
                widgetProps: { metric: "cpu" },
              },
              {
                id: "sys-mem-bar",
                type: "now_playing",
                label: "Memory",
                color: "#22c55e",
                position: { row: 1, col: 3, colspan: 2 },
                dataSource: "system_stats",
                variant: "bar",
                widgetProps: { metric: "memory" },
              },
              {
                id: "sys-discord",
                type: "now_playing",
                label: "Discord",
                color: "#5865F2",
                position: { row: 2, col: 3, colspan: 2 },
                dataSource: "discord",
              },
            ];
          }
        }
      }
    }
    raw.version = 6;
  }

  if (version < 7) {
    // Add Sounds (soundboard) page
    const profiles = raw.profiles as Array<Record<string, unknown>> | undefined;
    if (profiles) {
      for (const profile of profiles) {
        const pages = profile.pages as Array<Record<string, unknown>> | undefined;
        if (pages && !pages.some((p) => p.id === "sounds")) {
          // Insert before setup page if it exists, otherwise at end
          const setupIdx = pages.findIndex((p) => p.id === "setup");
          const soundsPage = {
            id: "sounds",
            name: "Sounds",
            widgets: [
              {
                id: "soundboard",
                type: "soundboard",
                label: "Soundboard",
                color: "#f59e0b",
                position: { row: 0, col: 0, colspan: 5, rowspan: 3 },
                dataSource: "soundboard",
              },
            ],
          };
          if (setupIdx >= 0) {
            pages.splice(setupIdx, 0, soundsPage);
          } else {
            pages.push(soundsPage);
          }
        }
      }
    }
    raw.version = 7;
  }

  if (version < 8) {
    // Add gridPosition to pages and pageGridSize to profiles
    const profiles = raw.profiles as Array<Record<string, unknown>> | undefined;
    if (profiles) {
      for (const profile of profiles) {
        const pages = profile.pages as Array<Record<string, unknown>> | undefined;
        if (pages) {
          pages.forEach((page, i) => {
            if (!page.gridPosition) {
              page.gridPosition = { row: 0, col: i };
            }
          });
          profile.pageGridSize = { rows: 1, cols: pages.length };
        }
      }
    }
    raw.version = 8;
  }

  return raw;
}

export function loadConfig(): DeckPilotConfig {
  if (!existsSync(configPath)) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    currentConfig = defaultConfig;
    return currentConfig;
  }

  let raw = JSON.parse(readFileSync(configPath, "utf-8"));
  raw = migrateConfig(raw);
  const parsed = configSchema.parse(raw);
  currentConfig = parsed as DeckPilotConfig;

  // Write back if migrated
  if (raw.version !== JSON.parse(readFileSync(configPath, "utf-8")).version) {
    writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
  }

  return currentConfig;
}

export function getConfig(): DeckPilotConfig {
  return currentConfig;
}

export function saveConfig(config: DeckPilotConfig): void {
  configSchema.parse(config);
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  currentConfig = config;
}
