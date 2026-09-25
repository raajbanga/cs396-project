"use client";

import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "~/lib/utils";

const TRIGGER_SIZES = {
  sm: "bg-canvas h-7 px-2.5 py-1 text-xs",
  toolbar: "bg-surface/60 h-9 shrink-0 px-2.5 text-xs sm:text-sm",
  drawer: "bg-surface/80 h-9 w-full px-2.5 text-xs sm:text-sm",
};

const SCROLL_BUTTON =
  "text-fg-muted flex cursor-default items-center justify-center py-1";

export interface SelectOption {
  value: string;
  label: ReactNode;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  size = "toolbar",
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  size?: keyof typeof TRIGGER_SIZES;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "border-edge text-fg hover:border-edge/70 flex w-full items-center justify-between rounded-lg border transition-colors focus:ring-1 focus:ring-emerald-500/50 focus:outline-none focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          TRIGGER_SIZES[size],
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="text-fg-muted ml-1.5 h-3.5 w-3.5 shrink-0 opacity-60" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 border-edge bg-surface text-fg relative z-[10001] max-h-72 min-w-[8rem] overflow-hidden rounded-lg border shadow-2xl backdrop-blur-md data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1"
        >
          <SelectPrimitive.ScrollUpButton className={SCROLL_BUTTON}>
            <ChevronUp className="h-4 w-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="text-fg focus:bg-surface-2 relative flex w-full cursor-pointer items-center rounded-md py-1.5 pr-8 pl-2 text-sm transition-colors outline-none select-none"
              >
                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className={SCROLL_BUTTON}>
            <ChevronDown className="h-4 w-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/** Wraps plain strings as `{ value, label }` options, with an optional leading "ALL" entry. */
export const toOptions = (
  values: readonly (string | number)[] | undefined,
  allLabel?: string,
): SelectOption[] => [
  ...(allLabel ? [{ value: "ALL", label: allLabel }] : []),
  ...(values ?? []).map((v) => ({ value: String(v), label: String(v) })),
];
