import React from "react";
import { cn } from "~/lib/utils";

export interface MetricBarProps {
  value: React.ReactNode;
  percentage?: number;
  color?: "amber" | "emerald" | "sky" | "rose";
  isLeader?: boolean;
  leaderLabel?: string;
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  amber: "bg-amber-500 dark:bg-amber-400",
  emerald: "bg-emerald-600 dark:bg-emerald-400",
  sky: "bg-sky-500 dark:bg-sky-400",
  rose: "bg-rose-500 dark:bg-rose-400",
};

export function MetricBar({
  value,
  percentage,
  color = "emerald",
  isLeader = false,
  leaderLabel = "Leader",
  className,
}: MetricBarProps) {
  const safePercentage = Math.min(Math.max(percentage ?? 0, 0), 100);
  const barColor = COLOR_MAP[color] ?? COLOR_MAP.emerald;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-fg font-mono text-sm font-semibold">{value}</div>
        {isLeader && (
          <span className="inline-flex shrink-0 items-center rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
            {leaderLabel}
          </span>
        )}
      </div>

      {percentage !== undefined && (
        <div className="bg-surface-2 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              barColor,
            )}
            style={{ width: `${safePercentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
