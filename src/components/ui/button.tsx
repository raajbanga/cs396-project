import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

const VARIANTS = {
  default: "bg-fg text-canvas shadow-xs hover:bg-fg/90 active:scale-[0.98]",
  secondary:
    "bg-surface-2 text-fg hover:bg-surface-2/80 border border-edge active:scale-[0.98]",
  outline:
    "border border-edge bg-transparent hover:bg-surface-2 hover:text-fg text-fg-2 active:scale-[0.98]",
  ghost: "hover:bg-surface-2 hover:text-fg text-fg-muted",
};

const SIZES = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 rounded-md px-3 text-xs",
  icon: "h-8 w-8 p-0 shrink-0",
};

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition-all select-none focus-visible:ring-1 focus-visible:ring-emerald-500/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
