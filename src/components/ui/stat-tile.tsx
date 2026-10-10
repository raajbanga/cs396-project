import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/** A labelled figure. Page-level figures use variant="card" (larger value); in-panel strips use "default". */
export function StatTile({
  label,
  value,
  subtext,
  valueClassName,
  variant = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  valueClassName?: string;
  variant?: "default" | "card";
  className?: string;
}) {
  const card = variant === "card";
  return (
    <div className={cn("border-edge min-w-0 border-l pl-3", className)}>
      <div className="text-fg-muted truncate text-xs">{label}</div>
      <div
        className={cn(
          "text-fg mt-0.5 truncate font-semibold tabular-nums",
          card ? "text-lg sm:text-2xl" : "text-base",
          valueClassName,
        )}
      >
        {value}
      </div>
      {subtext && (
        <div
          className="text-fg-muted mt-0.5 truncate text-xs"
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
        "grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
