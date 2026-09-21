import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function DataPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-edge bg-canvas overflow-hidden rounded-xl border",
        className,
      )}
    >
      {children}
    </div>
  );
}
