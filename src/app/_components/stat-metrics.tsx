import { Activity, AlertTriangle, Building2, Globe, Zap } from "lucide-react";
import { MetricCard } from "~/components/ui/metric-card";

interface StatMetricsProps {
  stats?: {
    totalFacilities: number;
    totalUnits: number;
    totalStates: number;
    totalNercRegions: number;
    totalCapacityMW: number;
    totalCo2Tons: number;
    totalGenerationMWh: number;
    totalAnomalies: number;
  };
  isLoading: boolean;
}

export function StatMetrics({ stats, isLoading }: StatMetricsProps) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      <MetricCard
        title="Total Facilities"
        icon={<Building2 className="h-4 w-4 text-fg-muted" />}
        value={
          isLoading ? "..." : (stats?.totalFacilities.toLocaleString() ?? "0")
        }
        subtext={`${stats?.totalStates ?? 52} states & territories`}
      />

      <MetricCard
        title="Tracked Capacity"
        icon={<Zap className="h-4 w-4 text-amber-400" />}
        value={
          isLoading
            ? "..."
            : stats?.totalCapacityMW
              ? `${(stats.totalCapacityMW / 1000).toFixed(1)} GW`
              : "0 GW"
        }
        subtext={
          stats?.totalUnits
            ? `${stats.totalUnits.toLocaleString()} generators`
            : "Active units"
        }
      />

      <MetricCard
        title="Reliability Grids"
        icon={<Globe className="h-4 w-4 text-sky-400" />}
        value={isLoading ? "..." : `${stats?.totalNercRegions ?? 0} Regions`}
        subtext="ERCOT, SERC, WECC, etc."
      />

      <MetricCard
        title="Annual CO₂"
        icon={<Activity className="h-4 w-4 text-emerald-400" />}
        value={
          isLoading
            ? "..."
            : stats?.totalCo2Tons && stats.totalCo2Tons > 0
              ? `${(stats.totalCo2Tons / 1_000_000).toFixed(1)}M t`
              : "—"
        }
        valueClassName="font-mono text-emerald-400"
        subtext="Monitored stack mass"
      />

      <MetricCard
        title="Audit Flags"
        icon={<AlertTriangle className="h-4 w-4 text-amber-400" />}
        value={isLoading ? "..." : (stats?.totalAnomalies ?? 0)}
        valueClassName="font-mono text-amber-400"
        subtext="Sanity violations"
        className="col-span-2 sm:col-span-1"
      />
    </section>
  );
}
