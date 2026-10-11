import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
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
        // Tabs draw their baseline as an inset shadow under the active tab's border: a real border
        // plus a -1px tab margin overflows the box and shows a vertical scrollbar.
        tabs
          ? "flex overflow-x-auto text-sm shadow-[inset_0_-1px_0_var(--edge)]"
          : "border-edge bg-surface flex rounded-md border p-0.5 text-sm",
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
            "flex cursor-pointer items-center gap-1.5 font-medium whitespace-nowrap",
            tabs ? "border-b-2 px-3 py-2" : "rounded-sm px-2.5 py-1",
            value === option.value
              ? tabs
                ? "text-fg border-fg"
                : "bg-surface-2 text-fg"
              : tabs
                ? "text-fg-muted hover:text-fg border-transparent"
                : "text-fg-muted hover:text-fg",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
