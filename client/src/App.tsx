import { useCallback, useEffect, useState } from "react";
import { isTauri } from "./lib/platform";
import { getServerUrl, setServerUrl } from "./lib/serverUrl";
import { setApiBase } from "./lib/api";
import { checkForUpdates } from "./lib/updater";
import { ConnectionScreen } from "./components/ConnectionScreen";
import { AppMain } from "./AppMain";

export default function App() {
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for updates on mount (Tauri only, no-op in browser)
  useEffect(() => {
    checkForUpdates();
  }, []);

  useEffect(() => {
    getServerUrl().then((url) => {
      if (url) {
        // In browser mode, API base stays "" (same-origin via proxy)
        // In Tauri mode, set the full server URL as base
        if (isTauri()) {
          setApiBase(url);
        }
        setServerUrlState(url);
      }
      setLoading(false);
    });
  }, []);

  const handleConnect = useCallback(async (url: string) => {
    await setServerUrl(url);
    setApiBase(url);
    setServerUrlState(url);
  }, []);

  if (loading) return null;

  // In Tauri, show connection screen if no server URL configured
  if (isTauri() && !serverUrl) {
    return <ConnectionScreen onConnect={handleConnect} />;
  }

  // Pass serverUrl only in Tauri mode (browser uses same-origin)
  return <AppMain serverUrl={isTauri() ? serverUrl ?? undefined : undefined} />;
}
