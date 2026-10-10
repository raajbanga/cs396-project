import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

const VARIANTS = {
  default: "bg-fg text-canvas hover:bg-fg/85",
  secondary: "bg-surface text-fg hover:bg-surface-2 border border-edge",
  outline:
    "border border-edge bg-surface hover:bg-surface-2 hover:text-fg text-fg-2",
  ghost: "hover:bg-surface-2 hover:text-fg text-fg-2",
};

const SIZES = {
  default: "h-9 px-4 text-sm",
  sm: "h-8 px-3 text-sm",
  icon: "h-8 w-8 p-0 shrink-0",
};

/** Button classes, also for links styled as buttons (e.g. CSV downloads). */
export const buttonClass = ({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  className?: string;
} = {}) =>
  cn(
    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <button
      type="button"
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}
