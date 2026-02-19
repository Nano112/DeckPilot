import { useState, useEffect, useRef, useCallback } from "react";
import type { WidgetConfig, WidgetType, Action } from "shared";
import { BottomSheet } from "./BottomSheet";
import { ActionPicker } from "./ActionPicker";
import { renderIcon, getAvailableIcons } from "../../lib/icons";
import { apiUrl } from "../../lib/api";

interface WidgetPropertiesSheetProps {
  open: boolean;
  widget: WidgetConfig | null;
  onClose: () => void;
  onSave: (widget: WidgetConfig) => void;
}

const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: "button", label: "Button" },
  { value: "slider", label: "Slider" },
  { value: "now_playing", label: "Now Playing" },
  { value: "soundboard", label: "Soundboard" },
  { value: "spacer", label: "Spacer" },
];

const DATA_SOURCES = [
  { value: "spotify", label: "Spotify" },
  { value: "system_stats", label: "System Stats" },
  { value: "discord", label: "Discord" },
  { value: "audio_fft", label: "Audio Visualizer" },
  { value: "soundboard", label: "Soundboard" },
  { value: "claude_sessions", label: "Claude Sessions" },
];

const VARIANT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  system_stats: [
    { value: "default", label: "Overview" },
    { value: "gauge", label: "Gauge" },
    { value: "timeseries", label: "Time Series" },
    { value: "bar", label: "Bar" },
  ],
};

const METRIC_OPTIONS = [
  { value: "cpu", label: "CPU" },
  { value: "memory", label: "Memory" },
  { value: "battery", label: "Battery" },
  { value: "disk", label: "Disk" },
];

const COLOR_SWATCHES = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#6366f1",
  "#a855f7", "#06b6d4", "#ec4899", "#1db954", "#f97316",
];

export function WidgetPropertiesSheet({
  open,
  widget,
  onClose,
  onSave,
}: WidgetPropertiesSheetProps) {
  const [draft, setDraft] = useState<WidgetConfig | null>(null);

  useEffect(() => {
    if (widget) setDraft(structuredClone(widget));
    else setDraft(null);
  }, [widget]);

  if (!draft) return null;

  const update = (patch: Partial<WidgetConfig>) =>
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <BottomSheet open={open} onClose={onClose} title="Widget Properties">
      <div className="flex flex-col gap-4">
        {/* Type */}
        <Field label="Type">
          <div className="flex gap-1.5 flex-wrap">
            {WIDGET_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => update({ type: t.value })}
                className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    draft.type === t.value ? "var(--accent)" : "var(--bg-button)",
                  color: draft.type === t.value ? "#fff" : "var(--text-secondary)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Label */}
        <Field label="Label">
          <input
            type="text"
            value={draft.label}
            onChange={(e) => update({ label: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
          />
        </Field>

        {/* Color */}
        <Field label="Color">
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                className="w-7 h-7 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: draft.color === c ? "#fff" : "transparent",
                  transform: draft.color === c ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
            <input
              type="text"
              value={draft.color ?? ""}
              onChange={(e) => update({ color: e.target.value })}
              placeholder="#hex"
              className="w-20 px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs border border-[var(--bg-button)]"
            />
          </div>
        </Field>

        {/* Icon (for button type) */}
        {(draft.type === "button") && (
          <Field label="Icon">
            <IconPicker
              value={draft.icon}
              onChange={(icon) => update({ icon: icon || undefined })}
            />
          </Field>
        )}

        {/* Position */}
        <Field label="Position">
          <div className="grid grid-cols-4 gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--text-secondary)]">Row</span>
              <input
                type="number"
                min={0}
                value={draft.position.row}
                onChange={(e) =>
                  update({
                    position: { ...draft.position, row: Number(e.target.value) },
                  })
                }
                className="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--text-secondary)]">Col</span>
              <input
                type="number"
                min={0}
                value={draft.position.col}
                onChange={(e) =>
                  update({
                    position: { ...draft.position, col: Number(e.target.value) },
                  })
                }
                className="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--text-secondary)]">Colspan</span>
              <input
                type="number"
                min={1}
                value={draft.position.colspan ?? 1}
                onChange={(e) =>
                  update({
                    position: {
                      ...draft.position,
                      colspan: Number(e.target.value),
                    },
                  })
                }
                className="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-xs text-[var(--text-secondary)]">Rowspan</span>
              <input
                type="number"
                min={1}
                value={draft.position.rowspan ?? 1}
                onChange={(e) =>
                  update({
                    position: {
                      ...draft.position,
                      rowspan: Number(e.target.value),
                    },
                  })
                }
                className="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
              />
            </label>
          </div>
        </Field>

        {/* Action (button) */}
        {draft.type === "button" && (
          <Field label="Action">
            <ActionPicker
              value={draft.action}
              onChange={(action: Action) => update({ action })}
            />
          </Field>
        )}

        {/* Slider config */}
        {draft.type === "slider" && (
          <>
            <Field label="Slider Action">
              <ActionPicker
                value={draft.sliderAction}
                onChange={(action: Action) => update({ sliderAction: action })}
              />
            </Field>
            <Field label="Range">
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--text-secondary)]">Min</span>
                  <input
                    type="number"
                    value={draft.min ?? 0}
                    onChange={(e) => update({ min: Number(e.target.value) })}
                    className="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--text-secondary)]">Max</span>
                  <input
                    type="number"
                    value={draft.max ?? 100}
                    onChange={(e) => update({ max: Number(e.target.value) })}
                    className="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--text-secondary)]">Step</span>
                  <input
                    type="number"
                    value={draft.step ?? 1}
                    onChange={(e) => update({ step: Number(e.target.value) })}
                    className="px-2 py-1 rounded bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
                  />
                </label>
              </div>
            </Field>
          </>
        )}

        {/* Now Playing / Live Data config */}
        {draft.type === "now_playing" && (
          <>
            <Field label="Data Source">
              <div className="flex gap-1.5 flex-wrap">
                {DATA_SOURCES.map((ds) => (
                  <button
                    key={ds.value}
                    onClick={() => update({ dataSource: ds.value })}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    style={{
                      backgroundColor:
                        (draft.dataSource ?? "spotify") === ds.value
                          ? "var(--accent)"
                          : "var(--bg-button)",
                      color:
                        (draft.dataSource ?? "spotify") === ds.value
                          ? "#fff"
                          : "var(--text-secondary)",
                    }}
                  >
                    {ds.label}
                  </button>
                ))}
              </div>
            </Field>
            {VARIANT_OPTIONS[draft.dataSource ?? "spotify"] && (
              <Field label="Style">
                <div className="flex gap-1.5 flex-wrap">
                  {VARIANT_OPTIONS[draft.dataSource ?? "spotify"]!.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => update({ variant: v.value })}
                      className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                      style={{
                        backgroundColor:
                          (draft.variant ?? "default") === v.value
                            ? "var(--accent)"
                            : "var(--bg-button)",
                        color:
                          (draft.variant ?? "default") === v.value
                            ? "#fff"
                            : "var(--text-secondary)",
                      }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {/* Metric picker for per-metric system_stats variants */}
            {draft.dataSource === "system_stats" &&
              draft.variant &&
              draft.variant !== "default" && (
                <Field label="Metric">
                  <div className="flex gap-1.5 flex-wrap">
                    {METRIC_OPTIONS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() =>
                          update({
                            widgetProps: {
                              ...draft.widgetProps,
                              metric: m.value,
                            },
                          })
                        }
                        className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                        style={{
                          backgroundColor:
                            ((draft.widgetProps?.metric as string) ?? "cpu") ===
                            m.value
                              ? "var(--accent)"
                              : "var(--bg-button)",
                          color:
                            ((draft.widgetProps?.metric as string) ?? "cpu") ===
                            m.value
                              ? "#fff"
                              : "var(--text-secondary)",
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
          </>
        )}

        {/* Save button */}
        <button
          onClick={() => {
            onSave(draft);
            onClose();
          }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white mt-2"
          style={{ backgroundColor: "var(--accent)" }}
        >
          Apply Changes
        </button>
      </div>
    </BottomSheet>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (icon: string) => void;
}) {
  const [showGrid, setShowGrid] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/icons"), { method: "POST", body: form });
      if (res.ok) {
        const { filename } = await res.json();
        onChange(`custom:${filename}`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [onChange]);

  const icons = getAvailableIcons();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Preview */}
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--bg-primary)] border border-[var(--bg-button)] text-[var(--text-primary)] shrink-0">
          {renderIcon(value, 20) ?? (
            <span className="text-xs text-[var(--text-secondary)]">-</span>
          )}
        </div>
        {/* Text input */}
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. play, globe, or emoji"
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm border border-[var(--bg-button)]"
        />
        {/* Upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-2.5 py-1.5 rounded-lg bg-[var(--bg-button)] text-[var(--text-secondary)] text-xs font-medium hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          {uploading ? "..." : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
      {/* Toggle icon grid */}
      <button
        onClick={() => setShowGrid(!showGrid)}
        className="text-xs text-[var(--accent)] text-left hover:underline"
      >
        {showGrid ? "Hide icon grid" : "Browse icons"}
      </button>
      {showGrid && (
        <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--bg-button)]">
          {icons.map((name) => (
            <button
              key={name}
              onClick={() => {
                onChange(name);
                setShowGrid(false);
              }}
              className="flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--bg-button)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title={name}
              style={{
                backgroundColor: value === name ? "var(--accent)" : undefined,
                color: value === name ? "#fff" : undefined,
              }}
            >
              {renderIcon(name, 16)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  );
}
