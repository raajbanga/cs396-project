import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/** Page-level metrics use variant="card"; in-dialog strips use variant="default". */
export function StatTile({
  label,
  value,
  icon,
  subtext,
  valueClassName,
  variant = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  subtext?: ReactNode;
  valueClassName?: string;
  variant?: "default" | "card";
  className?: string;
}) {
  const card = variant === "card";
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border transition-colors",
        card
          ? "border-edge/80 bg-surface/30 p-3 sm:p-4"
          : "border-edge bg-canvas p-3",
        className,
      )}
    >
      <div className="text-fg-muted flex items-center justify-between gap-1 text-xs font-medium tracking-wider uppercase">
        <span className="truncate">{label}</span>
        {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      </div>
      <div
        className={cn(
          "text-fg mt-1.5 font-semibold",
          card
            ? "text-2xl tracking-tight sm:text-3xl"
            : "font-mono text-base sm:text-lg",
          valueClassName,
        )}
      >
        {value}
      </div>
      {subtext && (
        <div
          className={cn(
            "text-fg-muted mt-1 truncate",
            card ? "text-sm" : "text-xs",
          )}
          title={typeof subtext === "string" ? subtext : undefined}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

export function KpiStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 text-xs sm:grid-cols-5 sm:gap-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}
