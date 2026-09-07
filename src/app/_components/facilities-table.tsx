"use client";

import { useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Factory,
  Power,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CarbonIntensityBadge } from "~/components/ui/carbon-intensity-badge";
import { Card } from "~/components/ui/card";
import { FuelBadge } from "~/components/ui/fuel-badge";
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
import {
  getHumanEquivalents,
  getPlantRole,
} from "~/lib/plant-narrative";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

export type FacilityRow =
  RouterOutputs["facilities"]["getFacilities"]["items"][number];

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
      return <ArrowUpDown className="ml-1 h-3 w-3 text-fg-muted opacity-60" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-emerald-400" />
    );
  };

  const renderRoleIcon = (icon: string) => {
    if (icon === "zap") return <Zap className="h-2.5 w-2.5" />;
    if (icon === "clock") return <Clock className="h-2.5 w-2.5" />;
    if (icon === "factory") return <Factory className="h-2.5 w-2.5" />;
    if (icon === "power") return <Power className="h-2.5 w-2.5" />;
    return <Activity className="h-2.5 w-2.5" />;
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const left = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    const pages: (number | "ellipsis")[] = [1];
    if (left > 2) pages.push("ellipsis");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  };

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <Card className="overflow-hidden border-edge/80 bg-surface/20 shadow-xs">
      {/* Desktop Table (>= md) */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-edge/80 bg-surface/50 hover:bg-surface/50">
              <TableHead className="w-10 text-center">
                <Scale className="mx-auto h-3.5 w-3.5 text-fg-muted" />
              </TableHead>

              <TableHead
                className="w-20 cursor-pointer select-none transition-colors hover:text-fg"
                onClick={() => onSortChange("id")}
                title="Sort by ORISPL plant code"
              >
                <div className="flex items-center gap-1">
                  <span>ORISPL</span>
                  {getSortIcon("id")}
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none transition-colors hover:text-fg"
                onClick={() => onSortChange("name")}
                title="Sort by Facility Name"
              >
                <div className="flex items-center">
                  <span>Facility & Grid Role</span>
                  {getSortIcon("name")}
                </div>
              </TableHead>

              <TableHead>Location</TableHead>
              <TableHead>Grid & Fuels</TableHead>

              <TableHead
                className="cursor-pointer select-none text-center transition-colors hover:text-fg"
                onClick={() => onSortChange("capacity")}
                title="Sort by Capacity (MW)"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Capacity</span>
                  {getSortIcon("capacity")}
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none text-right transition-colors hover:text-fg"
                onClick={() => onSortChange("co2")}
                title="Sort by Annual CO2 Tonnage"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Annual CO₂</span>
                  {getSortIcon("co2")}
                </div>
              </TableHead>

              <TableHead className="w-20 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow key={i} className="animate-pulse">
                  <TableCell className="text-center">
                    <div className="mx-auto h-4 w-4 rounded bg-surface-2" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-12 rounded bg-surface-2" />
                  </TableCell>
                  <TableCell>
                    <div className="mb-1 h-4 w-48 rounded bg-surface-2" />
                    <div className="h-3 w-32 rounded bg-surface-2/60" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 rounded bg-surface-2" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-32 rounded bg-surface-2" />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="mx-auto h-4 w-16 rounded bg-surface-2" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="ml-auto h-4 w-16 rounded bg-surface-2" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="ml-auto h-7 w-16 rounded bg-surface-2" />
                  </TableCell>
                </TableRow>
              ))
            ) : facilities?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-16 text-center text-fg-muted"
                >
                  <p className="text-sm font-medium text-fg-2">
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
                const equivalents = getHumanEquivalents(
                  fac.totalCapacityMW,
                  fac.totalCo2Tons,
                );
                const plantRole = getPlantRole({
                  operatingHours: fac.totalOperatingHours,
                  capacityMW: fac.totalCapacityMW,
                  sourceCategory: fac.sourceCategory,
                  primaryFuels: fac.primaryFuels,
                });

                return (
                  <TableRow
                    key={fac.id}
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isSelected
                        ? "bg-emerald-950/20 hover:bg-emerald-950/30"
                        : "hover:bg-surface-2/30",
                    )}
                    onClick={() => onInspect(fac.id)}
                  >
                    {/* Compare Checkbox */}
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleCompare(fac.id)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-edge bg-canvas text-emerald-500 accent-emerald-500 focus:ring-0"
                        aria-label={`Select ${fac.name} for comparison`}
                      />
                    </TableCell>

                    {/* ORISPL ID */}
                    <TableCell className="font-mono text-xs text-fg-muted">
                      #{fac.id}
                    </TableCell>

                    {/* Facility Name & Role */}
                    <TableCell>
                      <div className="text-base font-semibold text-fg transition-colors group-hover:text-emerald-400">
                        {fac.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
                            plantRole.badgeClass,
                          )}
                          title={plantRole.description}
                        >
                          {renderRoleIcon(plantRole.icon)}
                          <span>{plantRole.badgeLabel}</span>
                        </span>
                        <span className="max-w-[200px] truncate text-xs text-fg-muted">
                          {fac.ownerOperator ?? "Owner unlisted"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <div className="text-sm font-semibold text-fg-2">
                        {fac.stateCode}
                      </div>
                      <div className="text-xs text-fg-muted">
                        {fac.county ? `${fac.county} Co.` : "County N/A"}
                      </div>
                    </TableCell>

                    {/* Grid & Fuel */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {fac.nercRegion && (
                            <Badge
                              variant="sky"
                              className="px-2 py-0.5 font-mono text-xs"
                            >
                              {fac.nercRegion}
                            </Badge>
                          )}
                          {fac.controlledUnitsCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-400"
                              title="Equipped with SO2 scrubbers or NOx catalytic control systems"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Scrubbed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {fac.primaryFuels.length > 0 ? (
                            fac.primaryFuels.map((fuel) => (
                              <FuelBadge key={fuel} fuel={fuel} />
                            ))
                          ) : (
                            <span className="italic text-xs text-fg-muted">
                              Fuel unlisted
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Capacity */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-base font-semibold text-fg">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span>
                          {fac.totalCapacityMW > 0
                            ? `${Number(fac.totalCapacityMW).toLocaleString()} MW`
                            : "—"}
                        </span>
                      </div>
                      <div className="text-xs text-fg-muted">
                        {equivalents.homesPoweredRaw > 0 && (
                          <span className="font-medium text-fg-2">
                            {equivalents.homesPoweredFormatted} •{" "}
                          </span>
                        )}
                        <span>
                          {fac.unitCount}{" "}
                          {fac.unitCount === 1 ? "unit" : "units"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Annual CO2 */}
                    <TableCell className="text-right">
                      <div className="font-mono text-base font-semibold text-fg">
                        {fac.totalCo2Tons > 0 ? (
                          `${Number(fac.totalCo2Tons).toLocaleString()} t`
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </div>
                      {equivalents.carsDrivenRaw > 0 && (
                        <div className="text-xs text-fg-muted">
                          ≈ {equivalents.carsDrivenFormatted}
                        </div>
                      )}
                      <div className="pt-0.5">
                        <CarbonIntensityBadge
                          intensity={fac.carbonIntensityLbsMWh}
                        />
                      </div>
                    </TableCell>

                    {/* Inspect */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs font-normal text-fg-muted hover:text-fg"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspect(fac.id);
                        }}
                      >
                        <span>Inspect</span>
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Plant Cards (< md) */}
      <div className="divide-y divide-edge/60 md:hidden">
        {isLoading ? (
          Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-2 p-3.5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-40 rounded bg-surface-2" />
                <div className="h-4 w-10 rounded bg-surface-2" />
              </div>
              <div className="h-3 w-28 rounded bg-surface-2/60" />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="h-10 rounded bg-surface-2/40" />
                <div className="h-10 rounded bg-surface-2/40" />
              </div>
            </div>
          ))
        ) : facilities?.length === 0 ? (
          <div className="px-4 py-12 text-center text-fg-muted">
            <p className="text-sm font-medium text-fg-2">
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
          </div>
        ) : (
          facilities?.map((fac) => {
            const isSelected = compareIds.includes(fac.id);
            const plantRole = getPlantRole({
              operatingHours: fac.totalOperatingHours,
              capacityMW: fac.totalCapacityMW,
              sourceCategory: fac.sourceCategory,
              primaryFuels: fac.primaryFuels,
            });

            return (
              <div
                key={fac.id}
                onClick={() => onInspect(fac.id)}
                className={cn(
                  "cursor-pointer space-y-2.5 p-3.5 transition-colors active:bg-surface-2/40",
                  isSelected ? "bg-emerald-950/20" : "hover:bg-surface/40",
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div
                      className="shrink-0 pt-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleCompare(fac.id)}
                        className="h-4 w-4 cursor-pointer rounded border-edge bg-canvas text-emerald-500 accent-emerald-500 focus:ring-0"
                        aria-label={`Select ${fac.name} for comparison`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-semibold tracking-tight text-fg">
                        {fac.name}
                      </h4>
                      <div className="flex items-center gap-1.5 truncate text-xs text-fg-muted">
                        <span className="font-mono">#{fac.id}</span>
                        <span>•</span>
                        <span>
                          {fac.county ? `${fac.county} Co., ` : ""}
                          {fac.stateCode}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="shrink-0 px-2 py-0.5 font-mono text-xs"
                  >
                    {fac.stateCode}
                  </Badge>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium",
                      plantRole.badgeClass,
                    )}
                  >
                    {renderRoleIcon(plantRole.icon)}
                    <span>{plantRole.badgeLabel}</span>
                  </span>

                  {fac.nercRegion && (
                    <Badge
                      variant="sky"
                      className="px-2 py-0.5 font-mono text-xs"
                    >
                      {fac.nercRegion}
                    </Badge>
                  )}

                  {fac.primaryFuels.slice(0, 2).map((fuel) => (
                    <FuelBadge key={fuel} fuel={fuel} size="sm" />
                  ))}

                  {fac.controlledUnitsCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      Scrubbed
                    </span>
                  )}
                </div>

                {/* Metrics Strip */}
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-edge/60 bg-canvas/60 p-3 text-xs">
                  <div>
                    <span className="block text-xs text-fg-muted">
                      Nameplate
                    </span>
                    <span className="text-base font-bold text-fg">
                      {fac.totalCapacityMW > 0
                        ? `${Number(fac.totalCapacityMW).toLocaleString()} MW`
                        : "—"}
                    </span>
                    <span className="mt-0.5 block text-xs text-fg-muted">
                      {fac.unitCount} {fac.unitCount === 1 ? "unit" : "units"}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="block text-xs text-fg-muted">
                      Annual CO₂
                    </span>
                    <span className="font-mono text-base font-bold text-emerald-400">
                      {fac.totalCo2Tons > 0
                        ? `${Number(fac.totalCo2Tons).toLocaleString()} t`
                        : "—"}
                    </span>
                    {fac.carbonIntensityLbsMWh &&
                    fac.carbonIntensityLbsMWh > 0 ? (
                      <span className="mt-0.5 block font-mono text-xs text-fg-muted">
                        {Math.round(fac.carbonIntensityLbsMWh)} lbs/MWh
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-edge/80 bg-surface/30 px-3 py-2.5 sm:flex-row sm:px-4 sm:py-3">
        {/* Left: Range + Per Page */}
        <div className="flex w-full items-center justify-between gap-3 text-xs text-fg-muted sm:w-auto sm:justify-start">
          <span>
            Showing{" "}
            <strong className="text-fg">
              {totalCount === 0 ? 0 : startRecord.toLocaleString()}–
              {endRecord.toLocaleString()}
            </strong>{" "}
            of{" "}
            <strong className="text-fg">{totalCount.toLocaleString()}</strong>{" "}
            <span className="hidden sm:inline">facilities</span>
          </span>

          <div className="flex items-center gap-1.5 sm:border-l sm:border-edge sm:pl-3">
            <span className="text-fg-muted">Per page:</span>
            <div className="w-16 sm:w-18">
              <Select
                value={String(pageSize)}
                onValueChange={(val) => onPageSizeChange(Number(val))}
              >
                <SelectTrigger
                  sizeVariant="sm"
                  className="h-7 w-full bg-canvas text-xs"
                >
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

        {/* Right: Navigation */}
        <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end">
          {/* Quick Jump */}
          <form
            onSubmit={handleJumpSubmit}
            className="hidden items-center gap-1 border-r border-edge pr-2 text-xs text-fg-muted sm:flex"
          >
            <span>Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(page)}
              className="h-7 w-12 rounded border border-edge bg-canvas px-1 text-center text-xs text-fg focus:border-edge focus:outline-none"
            />
          </form>

          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPlaceholderData}
            onClick={() => onPageChange(1)}
            className="hidden h-7 w-7 p-0 sm:inline-flex"
            title="First page"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPlaceholderData}
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            className="h-7 px-2.5 text-xs sm:w-7 sm:p-0"
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="ml-1 sm:hidden">Prev</span>
          </Button>

          {/* Windowed Page Numbers (>= sm) */}
          <div className="hidden items-center gap-1 sm:flex">
            {getPageNumbers().map((p, idx) => {
              if (p === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="select-none px-1 text-xs text-fg-muted"
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
                  className={cn(
                    "h-7 min-w-[28px] cursor-pointer rounded px-1.5 text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-fg font-semibold text-canvas shadow-xs"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Mobile Page Indicator */}
          <span className="font-mono text-xs text-fg-2 sm:hidden">
            Page {page} of {Math.max(totalPages, 1)}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => onPageChange(page + 1)}
            className="h-7 px-2.5 text-xs sm:w-7 sm:p-0"
            title="Next page"
          >
            <span className="mr-1 sm:hidden">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => onPageChange(totalPages)}
            className="hidden h-7 w-7 p-0 sm:inline-flex"
            title="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
