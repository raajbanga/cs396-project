import * as React from "react";
import { getCarbonIntensityTier } from "~/lib/plant-narrative";
import { cn } from "~/lib/utils";

export interface CarbonIntensityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  intensity: number | null | undefined;
  showValue?: boolean;
}

export function CarbonIntensityBadge({
  intensity,
  showValue = false,
  className,
  ...props
}: CarbonIntensityBadgeProps) {
  if (intensity === null || intensity === undefined) {
    return <span className="text-fg-muted font-mono text-xs">—</span>;
  }

  if (intensity === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded border border-emerald-300/60 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 select-none dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
          className,
        )}
        title="Zero direct stack CO₂ emissions per MWh generated"
        {...props}
      >
        {showValue && (
          <span className="font-mono font-semibold">0 lbs/MWh</span>
        )}
        <span>Zero-Carbon</span>
      </span>
    );
  }

  const tier = getCarbonIntensityTier(intensity);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors select-none",
        tier.badgeClass,
        className,
      )}
      title={tier.description}
      {...props}
    >
      {showValue && (
        <span className="font-mono font-semibold">
          {Math.round(intensity).toLocaleString()} lbs/MWh
        </span>
      )}
      <span>{tier.label}</span>
    </span>
  );
}
