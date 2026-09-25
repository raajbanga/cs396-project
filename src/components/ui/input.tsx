import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "border-edge bg-canvas text-fg placeholder:text-fg-muted flex h-9 w-full rounded-lg border px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:ring-emerald-500/50 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
