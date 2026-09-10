import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  variant = "pill",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  variant?: "pill" | "tabs";
  className?: string;
}) {
  const tabs = variant === "tabs";
  return (
    <div
      className={cn(
        tabs
          ? "border-edge bg-surface/95 sticky top-0 z-10 flex border-b pt-1 text-xs font-medium backdrop-blur-md sm:text-sm"
          : "border-edge/80 bg-surface/60 flex rounded-md border p-0.5 text-xs",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex cursor-pointer items-center gap-1 font-medium transition-all",
            tabs ? "border-b-2 px-3.5 py-2" : "rounded px-2.5 py-1 text-xs",
            value === option.value
              ? tabs
                ? "text-fg border-emerald-400 font-semibold"
                : "bg-surface-2 text-fg shadow-xs"
              : tabs
                ? "text-fg-muted hover:text-fg border-transparent"
                : "text-fg-muted hover:text-fg",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
