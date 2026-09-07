import * as React from "react";
import { cn } from "~/lib/utils";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  title?: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  subtext?: React.ReactNode;
  valueClassName?: string;
  variant?: "default" | "card";
}

export function StatTile({
  label,
  title,
  value,
  icon,
  subtext,
  valueClassName,
  variant = "default",
  className,
  ...props
}: StatTileProps) {
  const displayTitle = title ?? label;

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border transition-colors",
        variant === "card"
          ? "border-edge/80 bg-surface/30 p-3 sm:p-4"
          : "border-edge bg-canvas p-3",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-1 text-xs font-medium tracking-wider text-fg-muted uppercase">
        <span className="truncate">{displayTitle}</span>
        {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      </div>
      <div
        className={cn(
          variant === "card"
            ? "mt-1.5 text-2xl font-semibold tracking-tight text-fg sm:text-3xl"
            : "mt-1.5 font-mono text-base font-semibold text-fg sm:text-lg",
          valueClassName,
        )}
      >
        {value}
      </div>
      {subtext && (
        <div
          className={cn(
            "mt-1 truncate text-fg-muted",
            variant === "card" ? "text-sm" : "text-xs",
          )}
          title={typeof subtext === "string" ? subtext : undefined}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}
