import React from "react";
import { cn } from "~/lib/utils";

export interface MetricBarProps {
  value: React.ReactNode;
  percentage?: number;
  color?: "amber" | "emerald" | "sky" | "rose" | "purple";
  isLeader?: boolean;
  leaderLabel?: string;
  className?: string;
  showBar?: boolean;
  barClassName?: string;
}

const COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-500 dark:bg-amber-400",
  emerald: "bg-emerald-600 dark:bg-emerald-400",
  sky: "bg-sky-500 dark:bg-sky-400",
  rose: "bg-rose-500 dark:bg-rose-400",
  purple: "bg-purple-500 dark:bg-purple-400",
};

export function MetricBar({
  value,
  percentage,
  color = "emerald",
  isLeader = false,
  leaderLabel = "Leader",
  className,
  showBar = true,
  barClassName,
}: MetricBarProps) {
  const safePercentage = Math.min(Math.max(percentage ?? 0, 0), 100);
  const barColor = COLOR_MAP[color] ?? COLOR_MAP.emerald;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-sm font-semibold text-fg">
          {value}
        </div>
        {isLeader && (
          <span className="inline-flex shrink-0 items-center rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium tracking-wide uppercase text-emerald-700 dark:text-emerald-400">
            {leaderLabel}
          </span>
        )}
      </div>

      {showBar && percentage !== undefined && (
        <div
          className={cn(
            "h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-2",
            barClassName,
          )}
        >
          <div
            className={cn("h-full rounded-full transition-all duration-300", barColor)}
            style={{ width: `${safePercentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
