import type { SystemStatsData, WidgetConfig } from "shared";
import { extractMetric, type MetricKey } from "./extractMetric";

interface StatBarProps {
  widget: WidgetConfig;
  data: unknown;
  onPress: (id: string) => void;
}

function isSystemStatsData(data: unknown): data is SystemStatsData {
  return (
    data !== null &&
    typeof data === "object" &&
    "cpu" in (data as Record<string, unknown>)
  );
}

export function StatBar({ widget, data }: StatBarProps) {
  const stats = isSystemStatsData(data) ? data : null;
  const metric = (widget.widgetProps?.metric as MetricKey) ?? "cpu";

  if (!stats) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-xl"
        style={{ backgroundColor: "var(--bg-button)" }}
      >
        <span className="text-xs text-[var(--text-secondary)]">Loading...</span>
      </div>
    );
  }

  const m = extractMetric(stats, metric);
  const color = widget.color ?? m.color;
  const pct = Math.min(m.pct, 100);

  return (
    <div
      className="flex flex-col h-full w-full rounded-xl overflow-hidden p-3 justify-center gap-2"
      style={{ backgroundColor: `${color}12` }}
    >
      {/* Label + value row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {m.label}
        </span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color }}
        >
          {Math.round(pct)}%
        </span>
      </div>

      {/* Bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{
          height: 10,
          backgroundColor: "var(--bg-button)",
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            transition: "width 500ms ease",
          }}
        />
      </div>

      {/* Detail text */}
      <span className="text-xs text-[var(--text-secondary)] opacity-60">
        {m.detail}
      </span>
    </div>
  );
}
