"use client";

import { useState, type ReactNode } from "react";
import { DataPanel } from "~/components/ui/data-panel";
import {
  localSortProps,
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { SortDirection } from "~/lib/facility-filters";
import { cn, isNumericValue, sortRows, type SortValue } from "~/lib/utils";

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

/**
 * Compact monospace table for validation reports, histories, and record lists. With `sortable`,
 * headers sort ↑/↓ on click: text and number cells sort by their own value, other cells (badges,
 * links) by `sortKeys[row][column]`, and a column with no value at all stays fixed. Numeric columns
 * start highest-first.
 */
export function ReportTable({
  head,
  rows,
  sortable = false,
  sortKeys,
}: {
  head: string[];
  rows: ReactNode[][];
  sortable?: boolean;
  sortKeys?: SortValue[][];
}) {
  const [sort, setSort] = useState({
    sortBy: "",
    sortDir: "asc" as SortDirection,
  });
  const keyOf = (i: number, j: number): SortValue => {
    const cell = rows[i]?.[j];
    return (
      sortKeys?.[i]?.[j] ??
      (typeof cell === "string" || typeof cell === "number" ? cell : undefined)
    );
  };
  const column = (j: number) => rows.map((_, i) => keyOf(i, j));
  const canSort = (j: number) =>
    sortable && column(j).some((v) => v !== undefined);
  const numeric = (j: number) => column(j).some(isNumericValue);
  const order =
    sortable && sort.sortBy
      ? sortRows(
          rows.map((_, i) => i),
          (i) => keyOf(i, Number(sort.sortBy)),
          sort.sortDir,
        )
      : rows.map((_, i) => i);
  return (
    <DataPanel>
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            {head.map((h, j) =>
              canSort(j) ? (
                <SortableTableHead
                  key={j}
                  label={h}
                  sort={String(j)}
                  {...localSortProps(sort, setSort, (f) => numeric(Number(f)))}
                  className="whitespace-nowrap"
                />
              ) : (
                <TableHead key={j} className="whitespace-nowrap">
                  {h}
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.map((i) => (
            <TableRow key={i}>
              {rows[i]!.map((cell, j) => (
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
