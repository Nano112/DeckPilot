import { useEffect, useRef, useState } from "react";
import type { GamepadBinding, ClientActionType, Action } from "shared";
import { GAMEPAD_LABELS } from "../../lib/gamepad";
import { BottomSheet } from "./BottomSheet";
import { ActionPicker } from "./ActionPicker";

interface GamepadBindingEditorProps {
  open: boolean;
  bindings: GamepadBinding[];
  onClose: () => void;
  onUpdate: (index: number, binding: GamepadBinding) => void;
  onAdd: (binding: GamepadBinding) => void;
  onDelete: (index: number) => void;
}

const CLIENT_ACTIONS: { value: ClientActionType; label: string }[] = [
  { value: "nav.page.next", label: "Next Page" },
  { value: "nav.page.previous", label: "Previous Page" },
];

export function GamepadBindingEditor({
  open,
  bindings,
  onClose,
  onUpdate,
  onAdd,
  onDelete,
}: GamepadBindingEditorProps) {
  const [capturing, setCapturing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <BottomSheet open={open} onClose={onClose} title="Gamepad Bindings">
      <div className="flex flex-col gap-3">
        {bindings.map((binding, index) => (
          <BindingRow
            key={index}
            binding={binding}
            expanded={editingIndex === index}
            onToggle={() =>
              setEditingIndex(editingIndex === index ? null : index)
            }
            onChange={(b) => onUpdate(index, b)}
            onDelete={() => {
              onDelete(index);
              if (editingIndex === index) setEditingIndex(null);
            }}
          />
        ))}

        {bindings.length === 0 && (
          <div className="text-center py-6 text-sm text-[var(--text-secondary)]">
            No gamepad bindings configured
          </div>
        )}

        {capturing ? (
          <CaptureOverlay
            onCapture={(button) => {
              onAdd({
                button,
                kind: "server",
                action: { type: "media.play_pause", params: {} },
                label: GAMEPAD_LABELS[button] ?? `Button ${button}`,
              });
              setCapturing(false);
              setEditingIndex(bindings.length);
            }}
            onCancel={() => setCapturing(false)}
          />
        ) : (
          <button
            onClick={() => setCapturing(true)}
            className="w-full py-2.5 rounded-xl text-sm font-medium border-2 border-dashed border-[var(--bg-button)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            + Add Binding
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

function BindingRow({
  binding,
  expanded,
  onToggle,
  onChange,
  onDelete,
}: {
  binding: GamepadBinding;
  expanded: boolean;
  onToggle: () => void;
  onChange: (binding: GamepadBinding) => void;
  onDelete: () => void;
}) {
  const buttonLabel = GAMEPAD_LABELS[binding.button] ?? `Btn ${binding.button}`;
  const actionLabel = binding.kind === "client"
    ? CLIENT_ACTIONS.find((a) => a.value === binding.clientAction)?.label ?? binding.clientAction
    : binding.action?.type ?? "None";

  return (
    <div className="rounded-xl bg-[var(--bg-primary)] overflow-hidden">
      {/* Summary row */}
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={onToggle}
      >
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--bg-button)] text-[var(--text-primary)]">
          {buttonLabel}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">→</span>
        <span className="flex-1 text-sm text-[var(--text-primary)] truncate">
          {binding.label || actionLabel}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor:
              binding.kind === "client"
                ? "rgba(34, 197, 94, 0.2)"
                : "rgba(59, 130, 246, 0.2)",
            color: binding.kind === "client" ? "#22c55e" : "#3b82f6",
          }}
        >
          {binding.kind === "client" ? "local" : "server"}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="var(--text-secondary)"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 150ms",
          }}
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-3 border-t border-[var(--bg-button)]">
          <div className="pt-3" />

          {/* Label */}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-secondary)] shrink-0">Label:</span>
            <input
              type="text"
              value={binding.label ?? ""}
              onChange={(e) =>
                onChange({ ...binding, label: e.target.value || undefined })
              }
              className="flex-1 px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
            />
          </label>

          {/* Kind toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-secondary)]">Type:</span>
            <div className="flex rounded-lg overflow-hidden border border-[var(--bg-button)]">
              <button
                onClick={() =>
                  onChange({
                    ...binding,
                    kind: "client",
                    clientAction: "nav.page.next",
                    action: undefined,
                  })
                }
                className="px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    binding.kind === "client" ? "var(--accent)" : "transparent",
                  color: binding.kind === "client" ? "#fff" : "var(--text-secondary)",
                }}
              >
                Client
              </button>
              <button
                onClick={() =>
                  onChange({
                    ...binding,
                    kind: "server",
                    action: { type: "media.play_pause", params: {} },
                    clientAction: undefined,
                  })
                }
                className="px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    binding.kind === "server" ? "var(--accent)" : "transparent",
                  color: binding.kind === "server" ? "#fff" : "var(--text-secondary)",
                }}
              >
                Server
              </button>
            </div>
          </div>

          {/* Action config */}
          {binding.kind === "client" ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-secondary)]">Action:</span>
              <div className="flex gap-1.5">
                {CLIENT_ACTIONS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() =>
                      onChange({ ...binding, clientAction: a.value })
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        binding.clientAction === a.value
                          ? "var(--accent)"
                          : "var(--bg-button)",
                      color:
                        binding.clientAction === a.value
                          ? "#fff"
                          : "var(--text-secondary)",
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-secondary)]">Action:</span>
              <ActionPicker
                value={binding.action}
                onChange={(action: Action) => onChange({ ...binding, action })}
              />
            </div>
          )}

          {/* Delete */}
          <button
            onClick={onDelete}
            className="self-start px-3 py-1 rounded-lg text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
          >
            Delete Binding
          </button>
        </div>
      )}
    </div>
  );
}

function CaptureOverlay({
  onCapture,
  onCancel,
}: {
  onCapture: (button: number) => void;
  onCancel: () => void;
}) {
  const prevPressed = useRef<Set<number>>(new Set());

  useEffect(() => {
    let rafId: number;

    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;
        for (let i = 0; i < gp.buttons.length; i++) {
          const btn = gp.buttons[i];
          if (btn && (btn.pressed || btn.value > 0.5)) {
            if (!prevPressed.current.has(i)) {
              onCapture(i);
              return;
            }
          }
        }
        const nowPressed = new Set<number>();
        for (let i = 0; i < gp.buttons.length; i++) {
          const btn = gp.buttons[i];
          if (btn && (btn.pressed || btn.value > 0.5)) {
            nowPressed.add(i);
          }
        }
        prevPressed.current = nowPressed;
      }
      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [onCapture]);

  return (
    <div className="flex flex-col items-center gap-3 py-6 rounded-xl bg-[var(--bg-primary)] border-2 border-dashed border-[var(--accent)]">
      <div className="w-8 h-8 rounded-full bg-[var(--accent)] animate-pulse" />
      <span className="text-sm font-medium text-[var(--text-primary)]">
        Press a button on your gamepad...
      </span>
      <button
        onClick={onCancel}
        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        Cancel
      </button>
    </div>
  );
}
