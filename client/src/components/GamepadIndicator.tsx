import { useEffect, useState } from "react";
import { GAMEPAD_LABELS } from "../lib/gamepad";
import type { GamepadBinding } from "shared";

interface GamepadIndicatorProps {
  lastButton: number | null;
  bindings?: GamepadBinding[];
}

export function GamepadIndicator({ lastButton, bindings }: GamepadIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState<{ label: string; actionLabel: string; isClient: boolean } | null>(null);

  useEffect(() => {
    if (lastButton === null) {
      setVisible(false);
      return;
    }

    const label = GAMEPAD_LABELS[lastButton] ?? `Btn ${lastButton}`;
    const binding = bindings?.find((b) => b.button === lastButton);

    const actionLabel = binding
      ? binding.kind === "client"
        ? binding.label ?? binding.clientAction ?? "client"
        : binding.label ?? binding.action?.type ?? "server"
      : "unbound";

    const isClient = binding?.kind === "client";

    setDisplay({ label, actionLabel, isClient: isClient ?? false });
    setVisible(true);
  }, [lastButton, bindings]);

  if (!display || !visible) return null;

  return (
    <div className="absolute top-12 inset-x-0 flex justify-center pointer-events-none">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-sm gamepad-toast">
        <span
          className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: display.isClient ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.3)",
            color: display.isClient ? "#4ade80" : "#60a5fa",
          }}
        >
          {display.label}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">{"\u2192"}</span>
        <span className="text-xs text-[var(--text-primary)]">{display.actionLabel}</span>
      </div>
    </div>
  );
}
