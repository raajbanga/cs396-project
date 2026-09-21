import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/** Page-level metrics use StatTile variant="card"; in-dialog strips use variant="default". */
export function KpiStrip({
  children,
  columns = 5,
  className,
  gapClassName = "gap-2 sm:gap-2.5",
}: {
  children: ReactNode;
  columns?: 4 | 5;
  className?: string;
  gapClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 text-xs",
        gapClassName,
        columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
