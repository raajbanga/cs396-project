import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

const BAR_COLORS = {
  amber: "bg-amber-500 dark:bg-amber-400",
  emerald: "bg-emerald-600 dark:bg-emerald-400",
  sky: "bg-sky-500 dark:bg-sky-400",
  rose: "bg-rose-500 dark:bg-rose-400",
};
export type BarColor = keyof typeof BAR_COLORS;

/** Share of `max` as a whole percentage in [0, 100]. */
export const percentOf = (value: number, max: number) =>
  max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;

export function ProgressBar({
  percent,
  color = "emerald",
  className,
}: {
  percent: number;
  color?: BarColor;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface-2 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full 2xl:max-w-[240px]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          BAR_COLORS[color],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function MetricBar({
  value,
  percent,
  color,
  leaderLabel,
}: {
  value: ReactNode;
  percent: number;
  color?: BarColor;
  /** Shown as a pill when this plant leads the metric. */
  leaderLabel?: string | false;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-fg font-mono text-sm font-semibold">{value}</div>
        {leaderLabel && (
          <span className="inline-flex shrink-0 items-center rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
            {leaderLabel}
          </span>
        )}
      </div>
      <ProgressBar percent={percent} color={color} />
    </div>
  );
}
