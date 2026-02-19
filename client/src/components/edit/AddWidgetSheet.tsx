import { useCallback, useState } from "react";
import type { WidgetConfig, WidgetType, Action } from "shared";
import { BottomSheet } from "./BottomSheet";
import { ActionPicker } from "./ActionPicker";

interface AddWidgetSheetProps {
  open: boolean;
  position: { row: number; col: number } | null;
  onClose: () => void;
  onAdd: (widget: WidgetConfig) => void;
}

const WIDGET_TYPES: { value: WidgetType; label: string; description: string }[] = [
  { value: "button", label: "Button", description: "Tap to trigger an action" },
  { value: "slider", label: "Slider", description: "Drag to set a value" },
  { value: "now_playing", label: "Live Data", description: "Spotify, System Stats, Discord..." },
  { value: "spacer", label: "Spacer", description: "Empty space" },
];

const LIVE_DATA_SOURCES: { value: string; label: string; description: string; color: string }[] = [
  { value: "spotify", label: "Spotify", description: "Now playing music", color: "#1db954" },
  { value: "system_stats", label: "System Stats", description: "CPU, Memory, Battery, Disk", color: "#6366f1" },
  { value: "discord", label: "Discord", description: "Activity & voice status", color: "#5865F2" },
  { value: "claude_sessions", label: "Claude Sessions", description: "Monitor active Claude Code instances", color: "#f59e0b" },
];

export function AddWidgetSheet({
  open,
  position,
  onClose,
  onAdd,
}: AddWidgetSheetProps) {
  const [step, setStep] = useState<"type" | "action" | "datasource">("type");
  const [selectedType, setSelectedType] = useState<WidgetType>("button");
  const [action, setAction] = useState<Action | undefined>(undefined);

  const reset = useCallback(() => {
    setStep("type");
    setSelectedType("button");
    setAction(undefined);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSelectType = useCallback(
    (type: WidgetType) => {
      setSelectedType(type);
      if (type === "button") {
        setStep("action");
      } else if (type === "now_playing") {
        setStep("datasource");
      } else {
        // For non-button types, create immediately
        if (!position) return;
        const widget = buildWidget(type, position, undefined);
        onAdd(widget);
        handleClose();
      }
    },
    [position, onAdd, handleClose]
  );

  const handleSelectDataSource = useCallback(
    (dataSource: string, color: string) => {
      if (!position) return;
      const widget = buildWidget("now_playing", position, undefined, dataSource, color);
      onAdd(widget);
      handleClose();
    },
    [position, onAdd, handleClose]
  );

  const handleConfirmAction = useCallback(() => {
    if (!position) return;
    const widget = buildWidget(selectedType, position, action);
    onAdd(widget);
    handleClose();
  }, [position, selectedType, action, onAdd, handleClose]);

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={step === "type" ? "Add Widget" : step === "datasource" ? "Choose Data Source" : "Choose Action"}
    >
      {step === "type" && (
        <div className="flex flex-col gap-2">
          {WIDGET_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => handleSelectType(t.value)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left hover:bg-[var(--bg-button)] transition-colors"
            >
              <WidgetIcon type={t.value} />
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {t.label}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {t.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "datasource" && (
        <div className="flex flex-col gap-2">
          {LIVE_DATA_SOURCES.map((ds) => (
            <button
              key={ds.value}
              onClick={() => handleSelectDataSource(ds.value, ds.color)}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left hover:bg-[var(--bg-button)] transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: ds.color }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {ds.label}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {ds.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "action" && (
        <div className="flex flex-col gap-3">
          <ActionPicker value={action} onChange={setAction} />
          <button
            onClick={handleConfirmAction}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white mt-2"
            style={{ backgroundColor: "var(--accent)" }}
          >
            Add Widget
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

function buildWidget(
  type: WidgetType,
  position: { row: number; col: number },
  action: Action | undefined,
  dataSource?: string,
  color?: string
): WidgetConfig {
  const id = `widget-${Date.now()}`;

  const base: WidgetConfig = {
    id,
    type,
    label: getLabelForType(type, action),
    color: "#3b82f6",
    position: { row: position.row, col: position.col },
  };

  switch (type) {
    case "button":
      return { ...base, action };
    case "slider":
      return {
        ...base,
        sliderAction: { type: "audio.volume_set", params: { level: 0 } },
        min: 0,
        max: 100,
        step: 1,
      };
    case "now_playing":
      return {
        ...base,
        color: color ?? "#1db954",
        position: { ...position, colspan: 3, rowspan: 2 },
        dataSource: dataSource ?? "spotify",
      };
    case "spacer":
      return base;
    default:
      return base;
  }
}

function getLabelForType(type: WidgetType, action?: Action): string {
  if (type === "slider") return "Slider";
  if (type === "now_playing") return "Now Playing";
  if (type === "spacer") return "";
  if (!action) return "Button";

  const labels: Partial<Record<string, string>> = {
    "media.play_pause": "Play/Pause",
    "media.next": "Next",
    "media.previous": "Previous",
    "audio.volume_up": "Vol+",
    "audio.volume_down": "Vol-",
    "audio.volume_set": "Volume",
    "audio.mute": "Mute",
    "spotify.play_pause": "Spotify Play",
    "spotify.next": "Spotify Next",
    "spotify.previous": "Spotify Prev",
    "system.launch_app": (action.params as { app?: string }).app || "Launch App",
    "system.open_url": "Open URL",
    "input.hotkey": "Hotkey",
    "exec.shell": "Shell",
    "exec.applescript": "Script",
    "clipboard.copy": "Copy",
  };

  return labels[action.type] ?? "Button";
}

function WidgetIcon({ type }: { type: WidgetType }) {
  const cls = "w-8 h-8 rounded-lg flex items-center justify-center shrink-0";
  switch (type) {
    case "button":
      return (
        <div className={cls} style={{ backgroundColor: "var(--accent)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
          </svg>
        </div>
      );
    case "slider":
      return (
        <div className={cls} style={{ backgroundColor: "#22c55e" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
          </svg>
        </div>
      );
    case "now_playing":
      return (
        <div className={cls} style={{ backgroundColor: "#1db954" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
      );
    case "spacer":
      return (
        <div className={cls} style={{ backgroundColor: "var(--bg-button)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--text-secondary)">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        </div>
      );
  }
}
