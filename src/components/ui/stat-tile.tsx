import * as React from "react";
import { cn } from "~/lib/utils";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  subtext?: React.ReactNode;
  valueClassName?: string;
}

export function StatTile({
  label,
  value,
  icon,
  subtext,
  valueClassName,
  className,
  ...props
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border border-edge bg-canvas p-3 transition-colors",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-1 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
        <span className="truncate">{label}</span>
        {icon && <span className="shrink-0">{icon}</span>}
      </div>
      <div
        className={cn(
          "mt-1.5 font-mono text-base font-bold text-fg sm:text-lg",
          valueClassName,
        )}
      >
        {value}
      </div>
      {subtext && (
        <div className="mt-1 truncate text-xs text-fg-muted">
          {subtext}
        </div>
      )}
    </div>
  );
}
