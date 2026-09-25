"use client";

import { useEffect, type ComponentProps, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const SIZES = {
  inspect: "max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl",
  compare: "max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[min(96vw,90rem)]",
};

/** Modal shell: sticky header, scrolling body, footer with extra actions plus a close button. */
export function Dialog({
  open,
  onOpenChange,
  size,
  header,
  footer,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size: keyof typeof SIZES;
  header: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  const close = () => onOpenChange(false);

  return (
    <div
      className="animate-in fade-in bg-canvas/80 fixed inset-0 z-[9999] flex items-end justify-center p-0 backdrop-blur-xs duration-150 sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        className={cn(
          "animate-in zoom-in-95 border-edge bg-surface relative flex h-[90dvh] max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border p-3.5 shadow-2xl backdrop-blur-md duration-150 sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:p-6",
          SIZES[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="text-fg-muted hover:bg-surface-2 hover:text-fg absolute top-3.5 right-3.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors sm:top-5 sm:right-5"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="border-edge shrink-0 border-b pr-10 pb-3">{header}</div>
        <div className="-mr-1 min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
          {children}
        </div>
        <div className="border-edge mt-auto flex shrink-0 flex-col items-stretch gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-end">
          {footer}
          <Button variant="secondary" size="sm" onClick={close}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "text-fg mt-1 text-xl font-bold tracking-tight sm:text-2xl",
        className,
      )}
      {...props}
    />
  );
}
