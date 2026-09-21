import * as React from "react";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="animate-in fade-in bg-canvas/80 fixed inset-0 z-[9999] flex items-end justify-center p-0 backdrop-blur-xs duration-150 sm:items-center sm:p-4"
      onClick={() => onOpenChange(false)}
    >
      {children}
    </div>
  );
}

export type DialogContentSize = "default" | "inspect" | "compare";

const DIALOG_CONTENT_SIZE_CLASS: Record<DialogContentSize, string> = {
  default: "max-w-4xl",
  inspect: "max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl",
  compare: "max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[min(96vw,90rem)]",
};

export type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: DialogContentSize;
};

export function DialogContent({
  className,
  children,
  size = "default",
  ...props
}: DialogContentProps) {
  return (
    <div
      className={cn(
        "animate-in zoom-in-95 border-edge bg-surface relative flex h-[90dvh] max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border p-3.5 shadow-2xl backdrop-blur-md duration-150 sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:p-6",
        DIALOG_CONTENT_SIZE_CLASS[size],
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-edge flex shrink-0 items-start justify-between border-b pb-3",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-fg text-xl font-bold tracking-tight sm:text-2xl",
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-edge mt-auto flex shrink-0 items-center justify-end gap-2 border-t pt-3",
        className,
      )}
      {...props}
    />
  );
}

export function DialogClose({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        "text-fg-muted hover:bg-surface-2 hover:text-fg absolute top-3.5 right-3.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors sm:top-5 sm:right-5",
        className,
      )}
      aria-label="Close dialog"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
