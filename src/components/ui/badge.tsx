import * as React from "react";
import { cn } from "~/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "destructive"
    | "sky";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: "bg-surface-2 text-fg border-edge",
    secondary: "bg-surface/90 text-fg-muted border-edge",
    outline: "text-fg-2 border-edge bg-transparent",
    success:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-500/20",
    warning:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-300/60 dark:border-amber-500/20",
    destructive:
      "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-500/20",
    sky: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-300/60 dark:border-sky-500/20",
  }[variant];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tracking-tight transition-colors",
        variantStyles,
        className,
      )}
      {...props}
    />
  );
}
