"use client";

import { isValidElement, useState, type ReactNode } from "react";
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
import { define } from "~/lib/glossary";
import { GLOSS_CLASS, GlossedText } from "~/components/ui/glossed-text";
import { cn, isNumericValue, sortRows, type SortValue } from "~/lib/utils";

/** Caption above a form control or group of controls. */
export const FIELD_LABEL = "text-fg-2 text-xs font-medium";

/**
 * A form control with its caption. `group` is for a set of buttons (a segmented control): a
 * <label> around buttons would forward a click on the caption to the first button.
 */
export function Field({
  label,
  className,
  group,
  children,
}: {
  label: string;
  className?: string;
  group?: boolean;
  children: ReactNode;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag
      className={cn("block max-w-full min-w-0 space-y-1", className)}
      role={group ? "group" : undefined}
      aria-label={group ? label || undefined : undefined}
    >
      {label && <span className={cn(FIELD_LABEL, "block")}>{label}</span>}
      {children}
    </Tag>
  );
}

/** Titled block on a page or in a dialog, with an optional note and header actions (a download). */
export function Section({
  title,
  note,
  actions,
  children,
}: {
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          {/* Inside a Disclosure the disclosure's title stands in for it. */}
          {title && (
            <h2 className="text-fg text-base font-semibold">{title}</h2>
          )}
          {note && (
            <p className="text-fg-muted max-w-3xl text-xs">
              <GlossedText>{note}</GlossedText>
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * A cell's text: a string or number, or the text of an element wrapping one (a bold value). With
 * several children (a value over a smaller note), the first one's.
 */
const cellText = (c: ReactNode): string | null =>
  typeof c === "string" || typeof c === "number"
    ? String(c)
    : Array.isArray(c)
      ? cellText(c[0] as ReactNode)
      : isValidElement<{ children?: ReactNode }>(c)
        ? cellText(c.props.children)
        : null;

/** Formatted numbers as tables show them: "1,234", "19.5B", "-0.5", "+12.3 %", "3.1 – 4.2", "< 0.001". */
const NUMERIC_TEXT =
  /^[<>≤≥]?\s*[-+−]?[\d,]*\.?\d+(e[-+]?\d+)?[KMBT]?\s*[%×]?(\s*–\s*[-+−]?[\d,]*\.?\d+[KMBT]?)?$/i;
const BLANK = /^(—|-|baseline|)$/;

/** A header with a plain definition on hover (dotted underline), when the glossary has one. */
function Glossed({ term }: { term: string }) {
  const definition = define(term);
  return definition ? (
    <span title={definition} className={GLOSS_CLASS}>
      {term}
    </span>
  ) : (
    term
  );
}

/**
 * Compact monospace table for validation reports, histories, and record lists. With `sortable`,
 * headers sort ↑/↓ on click: text and number cells sort by their own value, other cells (badges,
 * links) by `sortKeys[row][column]`, and a column with no value at all stays fixed. Numeric columns
 * start highest-first. Columns of numbers (and percentages, ranges, dashes) are right-aligned;
 * `wrap` columns wrap instead of truncating.
 */
export function ReportTable({
  head,
  rows,
  sortable = false,
  sortKeys,
  wrap = [],
}: {
  head: string[];
  rows: ReactNode[][];
  sortable?: boolean;
  sortKeys?: SortValue[][];
  wrap?: number[];
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
  const alignRight = head.map((_, j) => {
    const texts = rows.map((r) => cellText(r[j])?.trim() ?? null);
    return (
      texts.some((t) => t !== null && NUMERIC_TEXT.test(t)) &&
      texts.every((t) => t !== null && (NUMERIC_TEXT.test(t) || BLANK.test(t)))
    );
  });
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
                  label={<Glossed term={h} />}
                  sort={String(j)}
                  {...localSortProps(sort, setSort, (f) => numeric(Number(f)))}
                  className={cn(
                    "whitespace-nowrap",
                    alignRight[j] && "text-right",
                  )}
                />
              ) : (
                <TableHead
                  key={j}
                  className={cn(
                    "whitespace-nowrap",
                    alignRight[j] && "text-right",
                  )}
                >
                  <Glossed term={h} />
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.map((i) => (
            <TableRow key={i}>
              {rows[i]!.map((cell, j) => (
                <TableCell
                  key={j}
                  className={cn(
                    "tabular-nums",
                    wrap.includes(j) ? "min-w-64" : "max-w-64 truncate",
                    alignRight[j] && "text-right",
                  )}
                >
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
    <div className="border-danger/40 bg-danger/5 text-danger rounded-md border px-3 py-2 text-sm">
      {children}
    </div>
  );
}

/** Label–value pairs for the detail dialog (identification, fuel and controls), one hairline per row. */
export function DetailList({
  items,
  className,
}: {
  items: [string, ReactNode][];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2",
        className,
      )}
    >
      {items.map(([term, value]) => (
        <div
          key={term}
          className="border-edge/70 flex justify-between gap-4 border-b pb-2"
        >
          <dt className="text-fg-muted shrink-0">{term}</dt>
          <dd className="text-fg min-w-0 text-right break-words">
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A collapsed section: a title, a short hint of what's inside, and content rendered only once
 * opened (so a hidden table doesn't query or draw until someone asks for it).
 */
export function Disclosure({
  title,
  hint,
  children,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <details
      className={cn("border-edge rounded-md border", className)}
      onToggle={(e) => e.currentTarget.open && setOpened(true)}
    >
      <summary className="hover:bg-surface flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
        <span className="text-fg font-semibold">{title}</span>
        {hint && <span className="text-fg-muted text-xs">{hint}</span>}
      </summary>
      {opened && <div className="space-y-6 px-4 pt-2 pb-5">{children}</div>}
    </details>
  );
}
