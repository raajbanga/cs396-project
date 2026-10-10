import { Database } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { sourceLabel } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

type Stats = RouterOutputs["facilities"]["getStats"];

/** Data sources and reporting-year coverage for the home page (from `getStats`). */
export function DataCoverage({
  coverage = [],
  sources = [],
}: Partial<Pick<Stats, "coverage" | "sources">>) {
  return (
    <div className="border-edge/80 bg-surface/30 flex flex-col gap-2.5 rounded-lg border p-3 sm:px-4 sm:py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="border-edge/50 bg-surface-2/50 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
          <Database className="h-3.5 w-3.5 text-sky-400" />
        </div>
        <span className="text-fg text-base font-medium">Data coverage</span>
        <span className="text-fg-muted text-xs">
          Sources: EPA Clean Air Markets Program Data (CAMPD) and validated
          CSV/Excel uploads. The explorer, detail views, and downloads read only
          the local SQLite database; Retrieve and the granular time series call
          the EPA API live.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-fg-muted w-full sm:w-auto">Reporting years:</span>
        {coverage.length === 0 ? (
          <span className="text-fg-muted italic">No annual records yet</span>
        ) : (
          coverage.map(({ year, records }) => (
            <Badge key={year} variant="outline" className="font-mono">
              {year} · {records.toLocaleString()}
            </Badge>
          ))
        )}
      </div>
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-fg-muted w-full sm:w-auto">Datasets:</span>
          {sources.map(({ source, datasets, superseded, lastImportedAt }) => (
            <Badge
              key={source}
              variant="secondary"
              title={
                superseded
                  ? `${superseded} earlier retrievals were replaced by re-syncs and kept as history`
                  : undefined
              }
            >
              {sourceLabel(source)} · {datasets} active
              {superseded > 0 && ` (+${superseded} superseded)`} · last{" "}
              {new Date(lastImportedAt).toLocaleDateString()}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
