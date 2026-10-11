import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "border-edge bg-surface text-fg placeholder:text-fg-muted focus-visible:border-primary flex h-9 w-full rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
