import type { SystemStatsData, WidgetConfig } from "shared";

interface SystemStatsProps {
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

function GaugeRing({
  pct,
  label,
  detail,
  color,
  size = 80,
}: {
  pct: number;
  label: string;
  detail?: string;
  color: string;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(pct, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
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
          {Math.round(pct)}%
        </span>
      </div>
      <span className="text-xs font-medium text-[var(--text-secondary)] leading-none">
        {label}
      </span>
      {detail && (
        <span className="text-xs text-[var(--text-secondary)] opacity-60 leading-none">
          {detail}
        </span>
      )}
    </div>
  );
}

export function SystemStats({ widget, data }: SystemStatsProps) {
  const stats = isSystemStatsData(data) ? data : null;
  const accent = widget.color ?? "#6366f1";

  if (!stats) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-xl"
        style={{ backgroundColor: "var(--bg-button)" }}
      >
        <span className="text-sm text-[var(--text-secondary)]">
          Loading system stats...
        </span>
      </div>
    );
  }

  const gauges = [
    {
      pct: stats.cpu,
      label: "CPU",
      color: "#3b82f6",
    },
    {
      pct: stats.memory.pct,
      label: "Memory",
      detail: `${stats.memory.used}/${stats.memory.total} GB`,
      color: "#22c55e",
    },
    ...(stats.battery
      ? [
          {
            pct: stats.battery.pct,
            label: stats.battery.charging ? "Charging" : "Battery",
            color: stats.battery.pct < 20 ? "#ef4444" : "#f59e0b",
          },
        ]
      : []),
    {
      pct: stats.disk.pct,
      label: "Disk",
      detail: `${stats.disk.used}/${stats.disk.total}`,
      color: "#a855f7",
    },
  ];

  // Adaptive sizing based on widget dimensions
  const colspan = widget.position.colspan ?? 1;
  const rowspan = widget.position.rowspan ?? 1;
  const compact = colspan <= 2 && rowspan <= 1;
  const ringSize = compact ? 56 : colspan >= 4 ? 90 : 72;

  return (
    <div
      className="flex flex-col h-full w-full rounded-xl overflow-hidden p-3"
      style={{ backgroundColor: `${accent}12` }}
    >
      {!compact && (
        <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
          System
        </div>
      )}
      <div className="flex items-center justify-around flex-1 min-h-0">
        {gauges.map((g) => (
          <div key={g.label} className="relative flex flex-col items-center">
            <GaugeRing
              pct={g.pct}
              label={g.label}
              detail={compact ? undefined : g.detail}
              color={g.color}
              size={ringSize}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
