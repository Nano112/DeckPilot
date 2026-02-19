import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "shared";

const RECONNECT_DELAY = 2000;

export function useWebSocket(serverUrl?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    let url: string;
    if (serverUrl) {
      // Build WS URL from explicit server URL (Tauri mode)
      const parsed = new URL(serverUrl);
      const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
      url = `${wsProtocol}//${parsed.host}/ws`;
    } else {
      // Derive from current page (browser mode)
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      url = `${protocol}//${window.location.host}/ws`;
    }

    const ws = new WebSocket(url);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        setLastMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [serverUrl]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, lastMessage, send };
}
