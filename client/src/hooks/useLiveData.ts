import { useEffect, useState } from "react";
import type { ServerMessage } from "shared";

export function useLiveData(lastMessage: ServerMessage | null) {
  const [liveData, setLiveData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (lastMessage?.type === "live_data") {
      setLiveData((prev) => ({
        ...prev,
        [lastMessage.source]: lastMessage.data,
      }));
    }
  }, [lastMessage]);

  return liveData;
}
