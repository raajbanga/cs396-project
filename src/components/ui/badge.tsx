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
    default: "bg-zinc-800/90 text-zinc-100 border-zinc-700/50",
    secondary: "bg-zinc-900/90 text-zinc-400 border-zinc-800",
    outline: "text-zinc-300 border-zinc-800 bg-transparent",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    destructive: "bg-red-500/10 text-red-400 border-red-500/20",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  }[variant];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight transition-colors",
        variantStyles,
        className,
      )}
      {...props}
    />
  );
}
