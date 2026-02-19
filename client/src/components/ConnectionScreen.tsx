import { useState } from "react";

interface ConnectionScreenProps {
  onConnect: (url: string) => void;
}

export function ConnectionScreen({ onConnect }: ConnectionScreenProps) {
  const [url, setUrl] = useState("http://");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    const trimmed = url.replace(/\/$/, "");
    if (!trimmed || trimmed === "http://" || trimmed === "https://") {
      setError("Enter a server URL");
      return;
    }

    setTesting(true);
    setError(null);

    try {
      const resp = await fetch(`${trimmed}/api/config`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      onConnect(trimmed);
    } catch (e) {
      setError(
        `Can't reach server: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          DeckPilot
        </h1>
        <p className="text-sm text-[var(--text-secondary)] text-center">
          Enter the address of your DeckPilot server
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="http://192.168.1.100:9900"
          className="w-full px-4 py-3 rounded-xl bg-[var(--bg-button)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)] focus:border-[var(--accent)] outline-none"
          autoFocus
        />

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <button
          onClick={handleConnect}
          disabled={testing}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
          style={{
            backgroundColor: "var(--accent)",
            opacity: testing ? 0.6 : 1,
          }}
        >
          {testing ? "Connecting..." : "Connect"}
        </button>
      </div>

      <p className="text-xs text-[var(--text-secondary)] opacity-50 text-center mt-4">
        Make sure the DeckPilot server is running on your desktop
      </p>
    </div>
  );
}
