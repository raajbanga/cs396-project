"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, toOptions } from "~/components/ui/select";
import { cn } from "~/lib/utils";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cn("text-fg-2 w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      className={cn(
        "border-edge bg-surface/80 text-fg-muted border-b text-xs font-medium tracking-wider uppercase [&_tr]:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody className={cn("divide-edge/60 divide-y", className)} {...props} />
  );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("hover:bg-surface-2/40 transition-colors", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn("h-10 px-3 text-left align-middle font-medium", className)}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("p-3 align-middle", className)} {...props} />;
}

/** Pulsing placeholder rows while a table's first page loads. */
export function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-edge/60 divide-y">
      {Array.from({ length: Math.min(rows, 10) }, (_, i) => (
        <div key={i} className="animate-pulse space-y-2 p-3.5">
          <div className="bg-surface-2 h-4 w-2/3 rounded" />
          <div className="bg-surface-2/60 h-3 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Header cell that sorts on click; `sort` omitted = plain header. Right-aligns when className has text-right. */
export function SortableTableHead<F extends string>({
  label,
  sort,
  sortBy,
  sortDir,
  onSortChange,
  className = "",
}: {
  label: ReactNode;
  sort?: F;
  sortBy: F;
  sortDir: "asc" | "desc";
  onSortChange: (field: F) => void;
  className?: string;
}) {
  const icon =
    sort === undefined ? null : sortBy !== sort ? (
      <ArrowUpDown className="text-fg-muted h-3 w-3 shrink-0 opacity-60" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 shrink-0 text-emerald-400" />
    ) : (
      <ArrowDown className="h-3 w-3 shrink-0 text-emerald-400" />
    );
  return (
    <TableHead
      className={cn(
        className,
        sort && "hover:text-fg cursor-pointer transition-colors select-none",
      )}
      onClick={sort ? () => onSortChange(sort) : undefined}
    >
      <div
        className={cn(
          "flex items-center gap-1",
          className.includes("text-right") && "justify-end",
        )}
      >
        {label}
        {icon}
      </div>
    </TableHead>
  );
}

function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);
  return [
    1,
    ...(left > 2 ? (["…"] as const) : []),
    ...Array.from({ length: right - left + 1 }, (_, i) => left + i),
    ...(right < totalPages - 1 ? (["…"] as const) : []),
    totalPages,
  ];
}

/** Table footer: "Showing a–b of n", page size, jump-to-page, and page buttons. */
export function TablePagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  itemLabel,
  isPlaceholderData,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  itemLabel: string;
  isPlaceholderData: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const [jumpPageInput, setJumpPageInput] = useState("");

  const navButton = (
    target: number,
    icon: ReactNode,
    title: string,
    className?: string,
  ) => (
    <Button
      key={title}
      variant="outline"
      size="icon"
      disabled={
        isPlaceholderData ||
        target < 1 ||
        target > totalPages ||
        target === page
      }
      onClick={() => onPageChange(target)}
      className={cn("h-7 w-7", className)}
      title={title}
    >
      {icon}
    </Button>
  );

  return (
    <div className="border-edge/80 bg-surface/30 flex flex-col items-center justify-between gap-3 border-t px-3 py-2.5 sm:flex-row sm:px-4 sm:py-3">
      <div className="text-fg-muted flex w-full items-center justify-between gap-3 text-xs sm:w-auto sm:justify-start">
        <span>
          Showing{" "}
          <strong className="text-fg">
            {totalCount === 0
              ? 0
              : ((page - 1) * pageSize + 1).toLocaleString()}
            –{Math.min(page * pageSize, totalCount).toLocaleString()}
          </strong>{" "}
          of <strong className="text-fg">{totalCount.toLocaleString()}</strong>{" "}
          <span className="hidden sm:inline">{itemLabel}</span>
        </span>
        <div className="sm:border-edge flex items-center gap-1.5 sm:border-l sm:pl-3">
          Per page:
          <Select
            value={String(pageSize)}
            onValueChange={(val) => onPageSizeChange(Number(val))}
            options={toOptions([10, 25, 50, 100])}
            size="sm"
            className="w-16 sm:w-18"
          />
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const target = Number.parseInt(jumpPageInput, 10);
            if (target >= 1 && target <= totalPages) {
              onPageChange(target);
              setJumpPageInput("");
            }
          }}
          className="border-edge text-fg-muted hidden items-center gap-1 border-r pr-2 text-xs sm:flex"
        >
          Go to:
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPageInput}
            onChange={(e) => setJumpPageInput(e.target.value)}
            placeholder={String(page)}
            className="h-7 w-12 px-1 text-center text-xs"
          />
        </form>

        {navButton(
          1,
          <ChevronsLeft className="h-3.5 w-3.5" />,
          "First page",
          "hidden sm:inline-flex",
        )}
        {navButton(
          page - 1,
          <ChevronLeft className="h-3.5 w-3.5" />,
          "Previous page",
        )}
        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((p, idx) =>
            p === "…" ? (
              <span
                key={`gap-${idx}`}
                className="text-fg-muted px-1 text-xs select-none"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="sm"
                onClick={() => onPageChange(p)}
                disabled={isPlaceholderData}
                className="h-7 min-w-7 px-1.5"
              >
                {p}
              </Button>
            ),
          )}
        </div>
        <span className="text-fg-2 font-mono text-xs sm:hidden">
          Page {page} of {totalPages}
        </span>
        {navButton(
          page + 1,
          <ChevronRight className="h-3.5 w-3.5" />,
          "Next page",
        )}
        {navButton(
          totalPages,
          <ChevronsRight className="h-3.5 w-3.5" />,
          "Last page",
          "hidden sm:inline-flex",
        )}
      </div>
    </div>
  );
}
