"use client";

import {
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const SIZES = {
  inspect: "max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl",
  compare: "max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[min(96vw,90rem)]",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal shell: sticky header, scrolling body, footer with extra actions plus a close button.
 * Focus moves into the dialog on open, Tab cycles within it, and focus returns on close; with
 * stacked dialogs (compare → facility) only the topmost, last in DOM order, handles keys.
 */
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
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Callers pass inline callbacks; a ref keeps the effect (and focus) from re-running each render.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const returnFocus = document.activeElement as HTMLElement | null;
    panel?.focus();
    const isTopmost = () =>
      [...document.querySelectorAll('[aria-modal="true"]')].at(-1) === panel;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!panel || !isTopmost()) return;
      if (e.key === "Escape") onOpenChangeRef.current(false);
      if (e.key !== "Tab") return;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((el) => el.offsetParent !== null);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return e.preventDefault();
      const inside = panel.contains(document.activeElement);
      if (
        e.shiftKey &&
        (!inside ||
          document.activeElement === first ||
          document.activeElement === panel)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      // A dialog still open underneath keeps the page locked.
      if (!document.querySelector('[aria-modal="true"]')) {
        document.body.style.overflow = "unset";
      }
      window.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const close = () => onOpenChange(false);

  return (
    <div
      className="animate-in fade-in bg-canvas/80 fixed inset-0 z-[9999] flex items-end justify-center p-0 backdrop-blur-xs duration-150 sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "animate-in zoom-in-95 border-edge bg-surface relative flex h-[90dvh] max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border p-3.5 shadow-2xl backdrop-blur-md duration-150 outline-none sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:p-6",
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
        <div id={titleId} className="border-edge shrink-0 border-b pr-10 pb-3">
          {header}
        </div>
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
