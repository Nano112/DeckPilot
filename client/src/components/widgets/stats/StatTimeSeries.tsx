import { useRef } from "react";
import type { SystemStatsData, WidgetConfig } from "shared";
import { extractMetric, type MetricKey } from "./extractMetric";

interface StatTimeSeriesProps {
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

const MAX_POINTS = 60; // ~3 minutes at 3s poll

export function StatTimeSeries({ widget, data }: StatTimeSeriesProps) {
  const stats = isSystemStatsData(data) ? data : null;
  const metric = (widget.widgetProps?.metric as MetricKey) ?? "cpu";
  const bufferRef = useRef<number[]>([]);

  if (stats) {
    const m = extractMetric(stats, metric);
    const buf = bufferRef.current;
    buf.push(m.pct);
    if (buf.length > MAX_POINTS) buf.shift();
  }

  const buffer = bufferRef.current;
  const m = stats ? extractMetric(stats, metric) : null;
  const color = widget.color ?? m?.color ?? "#3b82f6";
  const currentPct = m ? Math.round(m.pct) : 0;

  // SVG dimensions
  const svgW = 200;
  const svgH = 80;
  const padX = 4;
  const padTop = 4;
  const padBot = 4;
  const chartW = svgW - padX * 2;
  const chartH = svgH - padTop - padBot;

  // Build polyline points
  const points =
    buffer.length > 1
      ? buffer
          .map((val, i) => {
            const x = padX + (i / (MAX_POINTS - 1)) * chartW;
            const y = padTop + chartH - (Math.min(val, 100) / 100) * chartH;
            return `${x},${y}`;
          })
          .join(" ")
      : "";

  // Build filled polygon for gradient area
  const areaPoints = points
    ? `${padX},${padTop + chartH} ${points} ${padX + ((buffer.length - 1) / (MAX_POINTS - 1)) * chartW},${padTop + chartH}`
    : "";

  const gradientId = `tsg-${widget.id}`;

  return (
    <div
      className="flex flex-col h-full w-full rounded-xl overflow-hidden p-2"
      style={{ backgroundColor: `${color}12` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-1">
        <span className="text-xs font-medium text-[var(--text-secondary)] leading-none">
          {m?.label ?? metric.toUpperCase()}
        </span>
        <span
          className="text-sm font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {currentPct}%
        </span>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[25, 50, 75].map((pct) => {
            const y = padTop + chartH - (pct / 100) * chartH;
            return (
              <line
                key={pct}
                x1={padX}
                y1={y}
                x2={padX + chartW}
                y2={y}
                stroke="var(--bg-button)"
                strokeWidth={0.5}
              />
            );
          })}

          {/* Area fill */}
          {areaPoints && (
            <polygon
              points={areaPoints}
              fill={`url(#${gradientId})`}
            />
          )}

          {/* Line */}
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
