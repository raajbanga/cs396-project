import * as React from "react";
import { cn } from "~/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "border-edge bg-canvas text-fg placeholder:text-fg-muted focus-visible:border-edge flex h-9 w-full rounded-lg border px-3 py-1.5 text-sm shadow-xs transition-colors focus-visible:ring-1 focus-visible:ring-emerald-500/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
