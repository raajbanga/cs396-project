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
  HelpCircle,
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
        className="gap-0.5 px-1.5 py-0 text-[10px] font-medium"
      >
        {theme.name === "Natural Gas" && (
          <Flame className="h-2.5 w-2.5 shrink-0 text-sky-400" />
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
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${tier.badgeClass}`}
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
    <Card className="overflow-hidden border-zinc-800 bg-zinc-950/70 shadow-xl">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-900/60">
            <TableHead className="w-10 text-center">
              <Scale className="mx-auto h-3.5 w-3.5 text-zinc-500" />
            </TableHead>

            {/* ORISPL Column with Tooltip */}
            <TableHead
              className="w-24 cursor-pointer transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("id")}
              title="Click to sort by ORISPL plant code"
            >
              <div className="flex items-center gap-1">
                <span>ORISPL</span>
                <span title="Official DOE/EIA plant code identifying each facility">
                  <HelpCircle className="h-3 w-3 text-zinc-500" />
                </span>
                {getSortIcon("id")}
              </div>
            </TableHead>

            {/* Facility Name & Role Column */}
            <TableHead
              className="cursor-pointer transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("name")}
              title="Click to sort by Facility Name"
            >
              <div className="flex items-center">
                <span>Facility & Grid Role</span>
                {getSortIcon("name")}
              </div>
            </TableHead>

            <TableHead>Location</TableHead>

            {/* Grid & Fuel Tags Column */}
            <TableHead>
              <span>Grid & Primary Fuels</span>
            </TableHead>

            {/* Capacity Column with Tooltip */}
            <TableHead
              className="cursor-pointer text-center transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("capacity")}
              title="Click to sort by Capacity (MW)"
            >
              <div className="flex items-center justify-center gap-1">
                <span>Capacity / Scale</span>
                <span title="Nameplate continuous power rating. 1 MW powers ~750 homes.">
                  <HelpCircle className="h-3 w-3 text-zinc-500" />
                </span>
                {getSortIcon("capacity")}
              </div>
            </TableHead>

            {/* Annual CO2 & Carbon Intensity Column */}
            <TableHead
              className="cursor-pointer text-right transition-colors select-none hover:text-zinc-200"
              onClick={() => onSortChange("co2")}
              title="Click to sort by Annual CO2 Tonnage"
            >
              <div className="flex items-center justify-end gap-1">
                <span>Annual CO2 & Impact</span>
                <span title="Annual stack carbon emissions monitored by CEMS and carbon intensity (lbs CO2/MWh)">
                  <HelpCircle className="h-3 w-3 text-zinc-500" />
                </span>
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

                  {/* ORISPL ID */}
                  <TableCell className="font-mono text-xs font-semibold text-emerald-400">
                    #{fac.id}
                  </TableCell>

                  {/* Facility Name & Plain-English Grid Role */}
                  <TableCell>
                    <div className="font-medium text-zinc-100 transition-colors group-hover:text-emerald-300">
                      {fac.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0 text-[10px] font-medium ${plantRole.badgeClass}`}
                        title={plantRole.description}
                      >
                        {renderRoleIcon(plantRole.icon)}
                        <span>{plantRole.badgeLabel}</span>
                      </span>
                      <span className="max-w-[180px] truncate text-[11px] text-zinc-400">
                        {fac.ownerOperator ?? "Owner unlisted"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Location */}
                  <TableCell>
                    <div className="font-medium text-zinc-200">
                      {fac.stateCode}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {fac.county ? `${fac.county} Co.` : "County N/A"}
                    </div>
                  </TableCell>

                  {/* Grid & Fuel Tags for 1-Line Read */}
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1">
                        {fac.nercRegion && (
                          <Badge
                            variant="sky"
                            className="py-0 font-mono text-[10px]"
                          >
                            {fac.nercRegion}
                          </Badge>
                        )}
                        {fac.controlledUnitsCount > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0 text-[9px] font-medium text-emerald-400"
                            title="Equipped with SO2 scrubbers or NOx catalytic control systems"
                          >
                            <ShieldCheck className="h-2.5 w-2.5" />
                            Scrubbed
                          </span>
                        )}
                      </div>

                      {/* Primary Fuel Tags */}
                      <div className="flex flex-wrap items-center gap-1">
                        {fac.primaryFuels.length > 0 ? (
                          fac.primaryFuels.map((fuel) => renderFuelBadge(fuel))
                        ) : (
                          <span className="text-[10px] text-zinc-500 italic">
                            Fuel unlisted
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Capacity & Homes Powered Scale */}
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1 font-medium text-zinc-100">
                      <Zap className="h-3 w-3 text-amber-400" />
                      <span>
                        {fac.totalCapacityMW > 0
                          ? `${Number(fac.totalCapacityMW).toLocaleString()} MW`
                          : "—"}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
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
                    <div className="font-mono text-xs font-semibold text-zinc-100">
                      {fac.totalCo2Tons > 0 ? (
                        `${Number(fac.totalCo2Tons).toLocaleString()} t`
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </div>
                    {equivalents.carsDrivenRaw > 0 && (
                      <div className="text-[10px] text-zinc-400">
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
