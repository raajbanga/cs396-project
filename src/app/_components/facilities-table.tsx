"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Scale,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

export interface FacilityRow {
  id: number;
  name: string;
  stateCode: string;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  epaRegion: number | null;
  nercRegion: string | null;
  sourceCategory: string | null;
  ownerOperator: string | null;
  unitCount: number;
  totalCapacityMW: number;
  totalCo2Tons: number;
}

export type SortByField = "name" | "id" | "capacity" | "co2";
export type SortDirection = "asc" | "desc";

interface FacilitiesTableProps {
  facilities?: FacilityRow[];
  totalCount?: number;
  totalPages?: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isPlaceholderData: boolean;
  sortBy: SortByField;
  sortDir: SortDirection;
  onSortChange: (field: SortByField) => void;
  compareIds: number[];
  onToggleCompare: (id: number) => void;
  onInspect: (id: number) => void;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onResetFilters: () => void;
}

export function FacilitiesTable({
  facilities,
  totalCount = 0,
  totalPages = 1,
  page,
  pageSize,
  isLoading,
  isPlaceholderData,
  sortBy,
  sortDir,
  onSortChange,
  compareIds,
  onToggleCompare,
  onInspect,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
}: FacilitiesTableProps) {
  const [jumpPageInput, setJumpPageInput] = useState("");

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = Number.parseInt(jumpPageInput.trim(), 10);
    if (
      !Number.isNaN(targetPage) &&
      targetPage >= 1 &&
      targetPage <= totalPages
    ) {
      onPageChange(targetPage);
      setJumpPageInput("");
    }
  };

  const getSortIcon = (field: SortByField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-zinc-600 opacity-60" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-emerald-400" />
    );
  };

  // Generate windowed page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    if (start > 2) {
      pages.push("ellipsis");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);
    return pages;
  };

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <Card className="overflow-hidden border-zinc-800 bg-zinc-950/70 shadow-xl">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900/60">
            <TableHead className="w-10 text-center">
              <Scale className="mx-auto h-3.5 w-3.5 text-zinc-500" />
            </TableHead>

            {/* ORISPL Column with Sorting */}
            <TableHead
              className="w-24 cursor-pointer transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("id")}
            >
              <div className="flex items-center">
                <span>ORISPL</span>
                {getSortIcon("id")}
              </div>
            </TableHead>

            {/* Facility Name Column with Sorting */}
            <TableHead
              className="cursor-pointer transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("name")}
            >
              <div className="flex items-center">
                <span>Facility Name & Utility</span>
                {getSortIcon("name")}
              </div>
            </TableHead>

            <TableHead>Location</TableHead>
            <TableHead>NERC Grid & Sector</TableHead>

            {/* Capacity Column with Sorting */}
            <TableHead
              className="cursor-pointer text-center transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("capacity")}
            >
              <div className="flex items-center justify-center">
                <span>Capacity / Units</span>
                {getSortIcon("capacity")}
              </div>
            </TableHead>

            {/* Annual CO2 Column with Sorting */}
            <TableHead
              className="cursor-pointer text-right transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("co2")}
            >
              <div className="flex items-center justify-end">
                <span>Annual CO2 (2022)</span>
                {getSortIcon("co2")}
              </div>
            </TableHead>

            <TableHead className="w-24 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: pageSize }).map((_, i) => (
              <TableRow key={i} className="animate-pulse">
                <TableCell className="text-center">
                  <div className="mx-auto h-4 w-4 rounded bg-zinc-800" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-12 rounded bg-zinc-800" />
                </TableCell>
                <TableCell>
                  <div className="mb-1 h-4 w-48 rounded bg-zinc-800" />
                  <div className="h-3 w-32 rounded bg-zinc-800/60" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-24 rounded bg-zinc-800" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-32 rounded bg-zinc-800" />
                </TableCell>
                <TableCell className="text-center">
                  <div className="mx-auto h-4 w-16 rounded bg-zinc-800" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="ml-auto h-4 w-16 rounded bg-zinc-800" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="ml-auto h-7 w-16 rounded bg-zinc-800" />
                </TableCell>
              </TableRow>
            ))
          ) : facilities?.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-16 text-center text-zinc-400"
              >
                <p className="text-sm font-medium text-zinc-300">
                  No facilities match the active filter criteria.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onResetFilters}
                  className="mt-3"
                >
                  Clear All Filters
                </Button>
              </TableCell>
            </TableRow>
          ) : (
            facilities?.map((fac) => {
              const isSelected = compareIds.includes(fac.id);
              return (
                <TableRow
                  key={fac.id}
                  className={`group cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-emerald-950/20 hover:bg-emerald-950/30"
                      : "hover:bg-zinc-800/40"
                  }`}
                  onClick={() => onInspect(fac.id)}
                >
                  {/* Benchmarking Checkbox */}
                  <TableCell
                    className="text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleCompare(fac.id)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-700 bg-zinc-950 text-emerald-500 accent-emerald-500 focus:ring-0"
                      aria-label={`Select ${fac.name} for comparison`}
                    />
                  </TableCell>

                  <TableCell className="font-mono text-xs font-semibold text-emerald-400">
                    #{fac.id}
                  </TableCell>

                  <TableCell>
                    <div className="font-medium text-zinc-100 transition-colors group-hover:text-emerald-300">
                      {fac.name}
                    </div>
                    <div className="max-w-xs truncate text-[11px] text-zinc-400">
                      {fac.ownerOperator ?? "Owner unlisted"}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-medium text-zinc-200">
                      {fac.stateCode}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {fac.county ? `${fac.county} Co.` : "County N/A"}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {fac.nercRegion && (
                        <Badge
                          variant="sky"
                          className="py-0 font-mono text-[10px]"
                        >
                          {fac.nercRegion}
                        </Badge>
                      )}
                      <span className="truncate text-[11px] text-zinc-400">
                        {fac.sourceCategory ?? "Unspecified"}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="font-medium text-zinc-100">
                      {fac.totalCapacityMW > 0
                        ? `${Number(fac.totalCapacityMW).toLocaleString()} MW`
                        : "—"}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {fac.unitCount} {fac.unitCount === 1 ? "unit" : "units"}
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-mono text-xs">
                    {fac.totalCo2Tons > 0 ? (
                      <span className="font-semibold text-zinc-100">
                        {Number(fac.totalCo2Tons).toLocaleString()} t
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-normal transition-transform group-hover:translate-x-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspect(fac.id);
                      }}
                    >
                      <span>Inspect</span>
                      <ArrowRight className="ml-1 h-3 w-3 text-zinc-400" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Advanced A+ Tier Pagination Bar */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:flex-row">
        {/* Left: Range and Page Size */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span>
            Showing{" "}
            <strong className="text-zinc-200">
              {totalCount === 0 ? 0 : startRecord.toLocaleString()}–
              {endRecord.toLocaleString()}
            </strong>{" "}
            of{" "}
            <strong className="text-zinc-200">
              {totalCount.toLocaleString()}
            </strong>{" "}
            facilities
          </span>

          <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-2">
            <span>Per page:</span>
            <div className="w-18">
              <Select
                value={String(pageSize)}
                onValueChange={(val) => onPageSizeChange(Number(val))}
              >
                <SelectTrigger sizeVariant="sm" className="h-7 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Right: Numeric Buttons, First/Last, & Jump to Page */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Jump Input */}
          <form
            onSubmit={handleJumpSubmit}
            className="flex items-center gap-1 border-r border-zinc-800 pr-2 text-xs text-zinc-400"
          >
            <span>Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(page)}
              className="h-7 w-12 rounded border border-zinc-700 bg-zinc-950 px-1.5 text-center text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
            />
          </form>

          {/* First Page */}
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPlaceholderData}
            onClick={() => onPageChange(1)}
            className="h-7 w-7 p-0"
            title="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Previous Page */}
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPlaceholderData}
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            className="h-7 w-7 p-0"
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          {/* Windowed Numeric Page Buttons */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((p, idx) => {
              if (p === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-1 text-xs text-zinc-600 select-none"
                  >
                    …
                  </span>
                );
              }
              const isCurrent = p === page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  disabled={isPlaceholderData}
                  className={`h-7 min-w-[28px] cursor-pointer rounded px-1 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-zinc-100 font-semibold text-zinc-900 shadow-xs"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => onPageChange(page + 1)}
            className="h-7 w-7 p-0"
            title="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          {/* Last Page */}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => onPageChange(totalPages)}
            className="h-7 w-7 p-0"
            title="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
