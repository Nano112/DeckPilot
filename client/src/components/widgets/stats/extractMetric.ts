import type { SystemStatsData } from "shared";

export type MetricKey = "cpu" | "memory" | "battery" | "disk";

export interface MetricValue {
  pct: number;
  label: string;
  detail: string;
  color: string;
}

export function extractMetric(
  data: SystemStatsData,
  metric: MetricKey,
): MetricValue {
  switch (metric) {
    case "cpu":
      return {
        pct: data.cpu,
        label: "CPU",
        detail: `${Math.round(data.cpu)}% usage`,
        color: "#3b82f6",
      };
    case "memory":
      return {
        pct: data.memory.pct,
        label: "Memory",
        detail: `${data.memory.used}/${data.memory.total} GB`,
        color: "#22c55e",
      };
    case "battery":
      if (!data.battery)
        return { pct: 0, label: "Battery", detail: "N/A", color: "#f59e0b" };
      return {
        pct: data.battery.pct,
        label: data.battery.charging ? "Charging" : "Battery",
        detail: `${Math.round(data.battery.pct)}%`,
        color: data.battery.pct < 20 ? "#ef4444" : "#f59e0b",
      };
    case "disk":
      return {
        pct: data.disk.pct,
        label: "Disk",
        detail: `${data.disk.used}/${data.disk.total}`,
        color: "#a855f7",
      };
  }
}
