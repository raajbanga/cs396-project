import * as React from "react";
import { cn } from "~/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantStyles = {
      default:
        "bg-fg text-canvas shadow-xs hover:bg-fg/90 active:scale-[0.98]",
      secondary:
        "bg-surface-2 text-fg hover:bg-surface-2/80 border border-edge active:scale-[0.98]",
      outline:
        "border border-edge bg-transparent hover:bg-surface-2 hover:text-fg text-fg-2 active:scale-[0.98]",
      ghost: "hover:bg-surface-2 hover:text-fg text-fg-muted",
      destructive:
        "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-[0.98]",
    }[variant];

    const sizeStyles = {
      default: "h-9 px-4 py-2 text-sm",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-10 rounded-md px-5 text-sm",
      icon: "h-8 w-8 p-0 shrink-0",
    }[size];

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium transition-all focus-visible:ring-1 focus-visible:ring-zinc-400 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 select-none",
          variantStyles,
          sizeStyles,
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
