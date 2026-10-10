import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

/**
 * Page body for the §9 pages (Retrieve, Upload, Download): title block, sections, and an
 * optional action bar after them.
 */
export function PageView({
  header,
  footer,
  children,
  className,
}: {
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-8", className)}>
      <header className="space-y-2">{header}</header>
      {children}
      {footer && (
        <div className="border-edge flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Page title (h1) with an optional one-paragraph lead. */
export function PageTitle({
  children,
  lead,
  className,
}: {
  children: ReactNode;
  lead?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <h1 className="text-fg text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
        {children}
      </h1>
      {lead && <p className="text-fg-2 max-w-[68ch] text-sm">{lead}</p>}
    </div>
  );
}
