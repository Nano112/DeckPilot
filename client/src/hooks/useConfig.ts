import { useEffect, useState } from "react";
import type { DeckPilotConfig, ServerMessage } from "shared";
import { apiUrl } from "../lib/api";

export function useConfig(lastMessage: ServerMessage | null) {
  const [config, setConfig] = useState<DeckPilotConfig | null>(null);

  // Fetch config from REST API on mount (reliable, not subject to WS race conditions)
  useEffect(() => {
    fetch(apiUrl("/api/config"))
      .then((r) => r.json())
      .then((c: DeckPilotConfig) => setConfig(c))
      .catch(() => {});
  }, []);

  // Also update from WS config pushes (for live config changes)
  useEffect(() => {
    if (lastMessage?.type === "config" || lastMessage?.type === "config_updated") {
      setConfig(lastMessage.payload);
    }
  }, [lastMessage]);

  const activeProfile = config?.profiles.find((p) => p.id === config.activeProfile);
  const pages = activeProfile?.pages ?? [];
  const grid = activeProfile?.grid ?? { columns: 5, rows: 3 };
  const pageGridSize = activeProfile?.pageGridSize;

  return {
    config,
    setConfig,
    grid,
    pages,
    pageGridSize,
  };
}
