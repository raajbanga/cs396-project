import type { ReactNode } from "react";
import { DataPanel } from "~/components/ui/data-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

/** Small uppercase caption above a form control or group of controls. */
export const FIELD_LABEL =
  "text-fg-muted text-[11px] font-medium tracking-wider uppercase";

/** A form control with its caption. */
export function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("space-y-1", className)}>
      <span className={cn(FIELD_LABEL, "block")}>{label}</span>
      {children}
    </label>
  );
}

/** Titled block inside a dialog, with an optional one-line note. */
export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-fg text-xs font-semibold tracking-wider uppercase">
        {title}
      </h4>
      {note && <p className="text-fg-muted text-xs">{note}</p>}
      {children}
    </div>
  );
}

/** Compact monospace table for validation reports, histories, and record lists. */
export function ReportTable({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <DataPanel>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            {head.map((h, i) => (
              <TableHead key={i} className="whitespace-nowrap">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cells, i) => (
            <TableRow key={i}>
              {cells.map((cell, j) => (
                <TableCell key={j} className="max-w-56 truncate font-mono">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

/** Red banner for a failed request or invalid input. */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 sm:text-sm">
      {children}
    </div>
  );
}
