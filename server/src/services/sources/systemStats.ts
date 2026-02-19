import type { PlatformActions } from "../../platform/types";
import type { SystemStatsData } from "shared";
import type { DataSourceProvider } from "./types";

export class SystemStatsSource implements DataSourceProvider {
  readonly name = "system_stats";
  readonly intervalMs = 3000;

  constructor(private platform: PlatformActions) {}

  async fetch(): Promise<SystemStatsData | null> {
    const [cpuResult, memResult, battResult, diskResult] = await Promise.allSettled([
      this.platform.getCpuUsage(),
      this.platform.getMemoryUsage(),
      this.platform.getBatteryInfo(),
      this.platform.getDiskUsage(),
    ]);

    return {
      cpu: cpuResult.status === "fulfilled" ? cpuResult.value : 0,
      memory: memResult.status === "fulfilled" ? memResult.value : { used: 0, total: 0, pct: 0 },
      battery: battResult.status === "fulfilled" ? battResult.value : null,
      disk: diskResult.status === "fulfilled" ? diskResult.value : { used: "0", total: "0", pct: 0 },
    };
  }
}
