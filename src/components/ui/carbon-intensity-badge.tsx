import * as React from "react";
import { getCarbonIntensityTier } from "~/lib/plant-narrative";
import { cn } from "~/lib/utils";

export interface CarbonIntensityBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  intensity: number | null | undefined;
  showValue?: boolean;
}

export function CarbonIntensityBadge({
  intensity,
  showValue = false,
  className,
  ...props
}: CarbonIntensityBadgeProps) {
  if (intensity === null || intensity === undefined || intensity === 0) {
    return <span className="font-mono text-xs text-fg-muted">—</span>;
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
