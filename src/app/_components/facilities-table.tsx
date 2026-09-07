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
  Flame,
  Power,
  Scale,
  ShieldCheck,
  Zap,
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
import {
  getCarbonIntensityTier,
  getHumanEquivalents,
  getPlantRole,
} from "~/lib/plant-narrative";
import { getFuelTheme } from "~/lib/map-utils";
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
      return <ArrowUpDown className="ml-1 h-3 w-3 text-zinc-600 opacity-60" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-emerald-400" />
    );
  };

  // Fuel badge helper using unified getFuelTheme
  const renderFuelBadge = (fuel: string) => {
    const theme = getFuelTheme(fuel);
    return (
      <Badge
        key={fuel}
        variant={theme.variant}
        className="gap-1 px-2 py-0.5 text-xs font-medium"
      >
        {theme.name === "Natural Gas" && (
          <Flame className="h-3 w-3 shrink-0 text-sky-400" />
        )}
        <span>{fuel}</span>
      </Badge>
    );
  };

  // Carbon Intensity badge helper using unified getCarbonIntensityTier
  const renderIntensityBadge = (intensity: number | null) => {
    if (intensity === null || intensity === 0) return null;
    const tier = getCarbonIntensityTier(intensity);
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${tier.badgeClass}`}
        title={tier.description}
      >
        {tier.badgeText}
      </span>
    );
  };

  // Plain-English Role Icon helper
  const renderRoleIcon = (icon: string) => {
    if (icon === "zap") return <Zap className="h-2.5 w-2.5" />;
    if (icon === "clock") return <Clock className="h-2.5 w-2.5" />;
    if (icon === "factory") return <Factory className="h-2.5 w-2.5" />;
    if (icon === "power") return <Power className="h-2.5 w-2.5" />;
    return <Activity className="h-2.5 w-2.5" />;
  };

  // Windowed page numbers with ellipsis
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
    <Card className="overflow-hidden border-zinc-800/80 bg-zinc-900/20 shadow-xs">
      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-zinc-800/80 bg-zinc-900/50 hover:bg-zinc-900/50">
              <TableHead className="w-10 text-center">
                <Scale className="mx-auto h-3.5 w-3.5 text-zinc-500" />
              </TableHead>

              {/* ORISPL Column */}
              <TableHead
                className="w-20 cursor-pointer transition-colors select-none hover:text-zinc-200"
                onClick={() => onSortChange("id")}
                title="Sort by ORISPL plant code"
              >
                <div className="flex items-center gap-1">
                  <span>ORISPL</span>
                  {getSortIcon("id")}
                </div>
              </TableHead>

              {/* Facility Name & Role Column */}
              <TableHead
                className="cursor-pointer transition-colors select-none hover:text-zinc-200"
                onClick={() => onSortChange("name")}
                title="Sort by Facility Name"
              >
                <div className="flex items-center">
                  <span>Facility & Grid Role</span>
                  {getSortIcon("name")}
                </div>
              </TableHead>

              <TableHead>Location</TableHead>

              {/* Grid & Fuel Column */}
              <TableHead>Grid & Fuels</TableHead>

              {/* Capacity Column */}
              <TableHead
                className="cursor-pointer text-center transition-colors select-none hover:text-zinc-200"
                onClick={() => onSortChange("capacity")}
                title="Sort by Capacity (MW)"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Capacity</span>
                  {getSortIcon("capacity")}
                </div>
              </TableHead>

              {/* Annual CO2 Column */}
              <TableHead
                className="cursor-pointer text-right transition-colors select-none hover:text-zinc-200"
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
                  <TableCell className="text-center"><div className="mx-auto h-4 w-4 rounded bg-zinc-800" /></TableCell>
                  <TableCell><div className="h-4 w-12 rounded bg-zinc-800" /></TableCell>
                  <TableCell>
                    <div className="mb-1 h-4 w-48 rounded bg-zinc-800" />
                    <div className="h-3 w-32 rounded bg-zinc-800/60" />
                  </TableCell>
                  <TableCell><div className="h-4 w-24 rounded bg-zinc-800" /></TableCell>
                  <TableCell><div className="h-4 w-32 rounded bg-zinc-800" /></TableCell>
                  <TableCell className="text-center"><div className="mx-auto h-4 w-16 rounded bg-zinc-800" /></TableCell>
                  <TableCell className="text-right"><div className="ml-auto h-4 w-16 rounded bg-zinc-800" /></TableCell>
                  <TableCell className="text-right"><div className="ml-auto h-7 w-16 rounded bg-zinc-800" /></TableCell>
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
                        : "hover:bg-zinc-800/30",
                    )}
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

                    {/* ORISPL ID */}
                    <TableCell className="font-mono text-xs text-zinc-400">
                      #{fac.id}
                    </TableCell>

                    {/* Facility Name & Grid Role */}
                    <TableCell>
                      <div className="text-sm sm:text-base font-semibold text-zinc-100 transition-colors group-hover:text-emerald-300">
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
                        <span className="max-w-[200px] truncate text-xs text-zinc-400">
                          {fac.ownerOperator ?? "Owner unlisted"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <div className="text-sm font-semibold text-zinc-200">
                        {fac.stateCode}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {fac.county ? `${fac.county} Co.` : "County N/A"}
                      </div>
                    </TableCell>

                    {/* Grid & Fuel Tags */}
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

                        {/* Primary Fuel Tags */}
                        <div className="flex flex-wrap items-center gap-1">
                          {fac.primaryFuels.length > 0 ? (
                            fac.primaryFuels.map((fuel) => renderFuelBadge(fuel))
                          ) : (
                            <span className="text-xs text-zinc-500 italic">
                              Fuel unlisted
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Capacity */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 text-sm sm:text-base font-semibold text-zinc-100">
                        <Zap className="h-3.5 w-3.5 text-amber-400" />
                        <span>
                          {fac.totalCapacityMW > 0
                            ? `${Number(fac.totalCapacityMW).toLocaleString()} MW`
                            : "—"}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">
                        {equivalents.homesPoweredRaw > 0 && (
                          <span className="font-medium text-zinc-300">
                            {equivalents.homesPoweredFormatted} •{" "}
                          </span>
                        )}
                        <span>
                          {fac.unitCount} {fac.unitCount === 1 ? "unit" : "units"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Annual CO2 & Carbon Intensity */}
                    <TableCell className="text-right">
                      <div className="font-mono text-sm sm:text-base font-semibold text-zinc-100">
                        {fac.totalCo2Tons > 0 ? (
                          `${Number(fac.totalCo2Tons).toLocaleString()} t`
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </div>
                      {equivalents.carsDrivenRaw > 0 && (
                        <div className="text-xs text-zinc-400">
                          ≈ {equivalents.carsDrivenFormatted}
                        </div>
                      )}
                      <div className="pt-0.5">
                        {renderIntensityBadge(fac.carbonIntensityLbsMWh)}
                      </div>
                    </TableCell>

                    {/* Inspect Button */}
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs font-normal text-zinc-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspect(fac.id);
                        }}
                      >
                        <span>Inspect</span>
                        <ArrowRight className="ml-1 h-3.5 w-3.5 text-zinc-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Plant Cards View (< md) */}
      <div className="divide-y divide-zinc-800/60 md:hidden">
        {isLoading ? (
          Array.from({ length: Math.min(pageSize, 5) }).map((_, i) => (
            <div key={i} className="p-3.5 space-y-2 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-40 rounded bg-zinc-800" />
                <div className="h-4 w-10 rounded bg-zinc-800" />
              </div>
              <div className="h-3 w-28 rounded bg-zinc-800/60" />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="h-10 rounded bg-zinc-800/40" />
                <div className="h-10 rounded bg-zinc-800/40" />
              </div>
            </div>
          ))
        ) : facilities?.length === 0 ? (
          <div className="py-12 px-4 text-center text-zinc-400">
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
                  "p-3.5 space-y-2.5 cursor-pointer transition-colors active:bg-zinc-800/40",
                  isSelected ? "bg-emerald-950/20" : "hover:bg-zinc-900/40",
                )}
              >
                {/* Header: Select Checkbox, Plant Name, State Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className="pt-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleCompare(fac.id)}
                        className="h-4 w-4 cursor-pointer rounded border-zinc-700 bg-zinc-950 text-emerald-500 accent-emerald-500 focus:ring-0"
                        aria-label={`Select ${fac.name} for comparison`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold tracking-tight text-white truncate">
                        {fac.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                        <span className="font-mono text-zinc-400">#{fac.id}</span>
                        <span>•</span>
                        <span>{fac.county ? `${fac.county} Co., ` : ""}{fac.stateCode}</span>
                      </div>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-xs px-2 py-0.5 font-mono shrink-0">
                    {fac.stateCode}
                  </Badge>
                </div>

                {/* Tags Row */}
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
                    <Badge variant="sky" className="px-2 py-0.5 font-mono text-xs">
                      {fac.nercRegion}
                    </Badge>
                  )}

                  {fac.primaryFuels.slice(0, 2).map((fuel) => renderFuelBadge(fuel))}

                  {fac.controlledUnitsCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                      <ShieldCheck className="h-3 w-3" />
                      Scrubbed
                    </span>
                  )}
                </div>

                {/* Metrics 2-column strip */}
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3 text-xs">
                  <div>
                    <span className="text-xs text-zinc-400 block">Nameplate</span>
                    <span className="text-base font-bold text-zinc-100">
                      {fac.totalCapacityMW > 0
                        ? `${Number(fac.totalCapacityMW).toLocaleString()} MW`
                        : "—"}
                    </span>
                    <span className="text-xs text-zinc-400 block mt-0.5">
                      {fac.unitCount} {fac.unitCount === 1 ? "unit" : "units"}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-zinc-400 block">Annual CO₂</span>
                    <span className="font-mono text-base font-bold text-emerald-400">
                      {fac.totalCo2Tons > 0
                        ? `${Number(fac.totalCo2Tons).toLocaleString()} t`
                        : "—"}
                    </span>
                    {fac.carbonIntensityLbsMWh && fac.carbonIntensityLbsMWh > 0 ? (
                      <span className="text-xs text-zinc-400 block font-mono mt-0.5">
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

      {/* Unified Responsive Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Left: Range and Per-Page Selector */}
        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-3 text-xs text-zinc-400">
          <span>
            Showing{" "}
            <strong className="text-zinc-200">
              {totalCount === 0 ? 0 : startRecord.toLocaleString()}–{endRecord.toLocaleString()}
            </strong>{" "}
            of{" "}
            <strong className="text-zinc-200">
              {totalCount.toLocaleString()}
            </strong>{" "}
            <span className="hidden sm:inline">facilities</span>
          </span>

          <div className="flex items-center gap-1.5 sm:border-l sm:border-zinc-800 sm:pl-3">
            <span className="text-zinc-500">Per page:</span>
            <div className="w-16 sm:w-18">
              <Select
                value={String(pageSize)}
                onValueChange={(val) => onPageSizeChange(Number(val))}
              >
                <SelectTrigger sizeVariant="sm" className="h-7 w-full bg-zinc-950 text-xs">
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

        {/* Right: Navigation, Numeric Buttons & Quick Jump */}
        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-1.5">
          {/* Quick Jump Input */}
          <form
            onSubmit={handleJumpSubmit}
            className="hidden sm:flex items-center gap-1 border-r border-zinc-800 pr-2 text-xs text-zinc-400"
          >
            <span>Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(page)}
              className="h-7 w-12 rounded border border-zinc-800 bg-zinc-950 px-1 text-center text-xs text-zinc-200 focus:border-zinc-600 focus:outline-hidden"
            />
          </form>

          {/* First Page */}
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPlaceholderData}
            onClick={() => onPageChange(1)}
            className="hidden sm:inline-flex h-7 w-7 p-0"
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
            className="h-7 px-2.5 sm:w-7 sm:p-0 text-xs"
            title="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="sm:hidden ml-1">Prev</span>
          </Button>

          {/* Windowed Numeric Page Buttons (>= sm) */}
          <div className="hidden sm:flex items-center gap-1">
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
                  className={cn(
                    "h-7 min-w-[28px] cursor-pointer rounded px-1.5 text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-zinc-100 font-semibold text-zinc-900 shadow-xs"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Mobile Current Page Indicator (< sm) */}
          <span className="sm:hidden font-mono text-xs text-zinc-300">
            Page {page} of {Math.max(totalPages, 1)}
          </span>

          {/* Next Page */}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => onPageChange(page + 1)}
            className="h-7 px-2.5 sm:w-7 sm:p-0 text-xs"
            title="Next page"
          >
            <span className="sm:hidden mr-1">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          {/* Last Page */}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isPlaceholderData}
            onClick={() => onPageChange(totalPages)}
            className="hidden sm:inline-flex h-7 w-7 p-0"
            title="Last page"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
