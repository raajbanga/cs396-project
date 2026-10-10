"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Near-full-screen modal: one size for every view so a single facility gets the same room as a
 * comparison. Esc, the ✕, or a click outside closes it. Focus moves in on open, Tab cycles within
 * it, and focus returns on close.
 */
export function Dialog({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name, e.g. the facility name. */
  label: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass inline callbacks; a ref keeps the effect (and focus) from re-running each render.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const returnFocus = document.activeElement as HTMLElement | null;
    panel?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!panel) return;
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
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
      returnFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const close = () => onOpenChange(false);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/35 sm:items-center sm:p-[2vh]"
      onClick={close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="border-edge bg-canvas relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-lg border shadow-2xl shadow-black/25 outline-none sm:h-[92vh] sm:w-[min(96vw,112rem)] sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="text-fg-muted hover:bg-surface-2 hover:text-fg absolute top-3 right-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md sm:top-5 sm:right-5"
          aria-label="Close"
          title="Close (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Title block at the top of a dialog view: context line, h2, lead, and actions on the right. */
export function DialogHeader({
  context,
  title,
  lead,
  actions,
  className,
}: {
  context?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pr-10",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {context && <p className="text-fg-muted text-sm">{context}</p>}
        <h2 className="text-fg text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
          {title}
        </h2>
        {lead && <p className="text-fg-2 max-w-[75ch] text-sm">{lead}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
