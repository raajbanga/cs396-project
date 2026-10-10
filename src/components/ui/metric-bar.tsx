import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/** Share of `max` as a whole percentage in [0, 100]. */
export const percentOf = (value: number, max: number) =>
  max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

export function ProgressBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-2 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full",
        className,
      )}
    >
      <div
        className="bg-fg-2/70 h-full rounded-full"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function MetricBar({
  value,
  percent,
  leaderLabel,
}: {
  value: ReactNode;
  percent: number;
  /** Shown beside the value when this plant leads the metric. */
  leaderLabel?: string | false;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-fg text-sm tabular-nums">{value}</div>
        {leaderLabel && (
          <span className="text-primary shrink-0 text-xs">{leaderLabel}</span>
        )}
      </div>
      <ProgressBar percent={percent} />
    </div>
  );
}
