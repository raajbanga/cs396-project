"use client";

import type { ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "~/lib/utils";

const TRIGGER_SIZES = {
  sm: "h-8 px-2.5 text-sm",
  toolbar: "h-9 shrink-0 px-3 text-sm",
  drawer: "h-9 w-full px-3 text-sm",
};

const SCROLL_BUTTON =
  "text-fg-muted flex cursor-default items-center justify-center py-1";

interface SelectOption {
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
  // A value set elsewhere (a shared URL, a parsed description) still shows when it isn't a listed option.
  const shown =
    value && !options.some((o) => o.value === value)
      ? [...options, { value, label: value }]
      : options;
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "border-edge bg-surface text-fg hover:bg-surface-2 focus-visible:border-primary flex w-full cursor-pointer items-center justify-between rounded-md border text-left transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
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
          className="border-edge bg-surface text-fg relative z-[10001] max-h-72 min-w-[8rem] overflow-hidden rounded-md border shadow-lg shadow-black/10 data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1"
        >
          <SelectPrimitive.ScrollUpButton className={SCROLL_BUTTON}>
            <ChevronUp className="h-4 w-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] p-1">
            {shown.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="text-fg focus:bg-surface-2 relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none"
              >
                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="text-primary h-3.5 w-3.5" />
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
