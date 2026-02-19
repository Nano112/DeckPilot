import type { SystemStatsData, WidgetConfig } from "shared";
import { extractMetric, type MetricKey } from "./extractMetric";

interface StatGaugeProps {
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

export function StatGauge({ widget, data }: StatGaugeProps) {
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

  // Adaptive sizing based on widget dimensions
  const colspan = widget.position.colspan ?? 1;
  const rowspan = widget.position.rowspan ?? 1;
  const isLarge = colspan >= 2 && rowspan >= 2;
  const size = isLarge ? 100 : colspan >= 2 || rowspan >= 2 ? 80 : 64;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(m.pct, 100) / 100) * circumference;

  return (
    <div
      className="flex flex-col items-center justify-center h-full w-full rounded-xl gap-1 p-2"
      style={{ backgroundColor: `${color}12` }}
    >
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-button)"
            strokeWidth={5}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 500ms ease" }}
          />
        </svg>
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{ width: size, height: size }}
        >
          <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums leading-none">
            {Math.round(m.pct)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-[var(--text-secondary)] leading-none">
        {m.label}
      </span>
      {isLarge && (
        <span className="text-xs text-[var(--text-secondary)] opacity-60 leading-none">
          {m.detail}
        </span>
      )}
    </div>
  );
}
