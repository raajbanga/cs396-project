"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  Badge,
  CarbonIntensityBadge,
  FuelBadge,
  PlantRoleBadge,
} from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { Select, toOptions } from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { SortDirection, SortField } from "~/lib/facility-filters";
import {
  cleanOwnerOperator,
  formatCountyShort,
  getHumanEquivalents,
  getPlantRole,
} from "~/lib/plant-narrative";
import { cn, formatQuantity } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

type FacilitiesPage = RouterOutputs["facilities"]["getFacilities"];
type FacilityRow = FacilitiesPage["items"][number];

interface RowProps {
  fac: FacilityRow;
  isSelected: boolean;
  onToggleCompare: (id: number) => void;
  onInspect: (id: number) => void;
}

const SELECTED_ROW =
  "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30";

const unitLabel = (count: number) =>
  `${count} ${count === 1 ? "unit" : "units"}`;

function CompareCheckbox({
  fac,
  isSelected,
  onToggleCompare,
}: Omit<RowProps, "onInspect">) {
  return (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggleCompare(fac.id)}
      onClick={(e) => e.stopPropagation()}
      className="border-edge bg-canvas h-4 w-4 cursor-pointer rounded accent-emerald-500 md:h-3.5 md:w-3.5"
      aria-label={`Select ${fac.name} for comparison`}
    />
  );
}

function FacilityBadges({
  fac,
  fuelLimit,
}: {
  fac: FacilityRow;
  fuelLimit?: number;
}) {
  return (
    <>
      {fac.nercRegion && <Badge variant="sky">{fac.nercRegion}</Badge>}
      {fac.primaryFuels.slice(0, fuelLimit).map((fuel) => (
        <FuelBadge key={fuel} fuel={fuel} />
      ))}
      {fac.controlledUnitsCount > 0 && (
        <Badge variant="success" title="Air-quality controls installed">
          <ShieldCheck className="h-3 w-3" />
          Scrubbed
        </Badge>
      )}
    </>
  );
}

function FacilityTableRow({
  fac,
  isSelected,
  onToggleCompare,
  onInspect,
}: RowProps) {
  const owner = cleanOwnerOperator(fac.ownerOperator);
  const county = formatCountyShort(fac.county);
  const equivalents = getHumanEquivalents(
    fac.totalCapacityMW,
    fac.totalCo2Tons,
  );

  return (
    <TableRow
      className={cn("group cursor-pointer", isSelected && SELECTED_ROW)}
      onClick={() => onInspect(fac.id)}
    >
      <TableCell className="text-center">
        <CompareCheckbox
          fac={fac}
          isSelected={isSelected}
          onToggleCompare={onToggleCompare}
        />
      </TableCell>
      <TableCell className="text-fg-muted font-mono text-xs">
        #{fac.id}
      </TableCell>
      <TableCell className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="text-fg truncate text-base font-semibold transition-colors group-hover:text-emerald-400"
            title={fac.name}
          >
            {fac.name}
          </span>
          <PlantRoleBadge
            roleInfo={getPlantRole({
              operatingHours: fac.totalOperatingHours,
              capacityMW: fac.totalCapacityMW,
              sourceCategory: fac.sourceCategory,
              primaryFuels: fac.primaryFuels,
            })}
          />
        </div>
        <div className="text-fg-muted truncate pt-0.5 text-xs" title={owner}>
          {owner}
        </div>
      </TableCell>
      <TableCell className="min-w-0">
        <div className="text-fg-2 text-sm font-semibold">{fac.stateCode}</div>
        <div className="text-fg-muted truncate text-xs" title={county}>
          {county}
        </div>
      </TableCell>
      <TableCell className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
          <FacilityBadges fac={fac} />
          {fac.primaryFuels.length === 0 && (
            <span className="text-fg-muted text-xs italic">Fuel unlisted</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="text-fg flex items-center justify-end gap-1 text-base font-semibold">
          <Zap className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          {formatQuantity(fac.totalCapacityMW, "MW", { digits: 1 })}
        </div>
        <div className="text-fg-muted text-xs">
          {equivalents.homesPoweredRaw > 0 && (
            <span className="text-fg-2 font-medium">
              {equivalents.homesPoweredFormatted} •{" "}
            </span>
          )}
          {unitLabel(fac.unitCount)}
        </div>
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="text-fg font-mono text-base font-semibold">
          {formatQuantity(fac.totalCo2Tons, "t")}
        </div>
        {equivalents.carsDrivenRaw > 0 && (
          <div className="text-fg-muted text-xs">
            ≈ {equivalents.carsDrivenFormatted}
          </div>
        )}
        <div className="flex justify-end pt-0.5">
          <CarbonIntensityBadge intensity={fac.carbonIntensityLbsMWh} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function FacilityCard({
  fac,
  isSelected,
  onToggleCompare,
  onInspect,
}: RowProps) {
  return (
    <div
      onClick={() => onInspect(fac.id)}
      className={cn(
        "hover:bg-surface/40 active:bg-surface-2/40 cursor-pointer space-y-2.5 p-3.5 transition-colors",
        isSelected && SELECTED_ROW,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="shrink-0 pt-0.5">
            <CompareCheckbox
              fac={fac}
              isSelected={isSelected}
              onToggleCompare={onToggleCompare}
            />
          </div>
          <div className="min-w-0">
            <h4 className="text-fg truncate text-base font-semibold tracking-tight">
              {fac.name}
            </h4>
            <div className="text-fg-muted truncate text-xs">
              <span className="font-mono">#{fac.id}</span> •{" "}
              {formatCountyShort(fac.county)}, {fac.stateCode}
            </div>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono">
          {fac.stateCode}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <PlantRoleBadge
          roleInfo={getPlantRole({
            operatingHours: fac.totalOperatingHours,
            capacityMW: fac.totalCapacityMW,
            sourceCategory: fac.sourceCategory,
            primaryFuels: fac.primaryFuels,
          })}
        />
        <FacilityBadges fac={fac} fuelLimit={2} />
      </div>

      <div className="border-edge/60 bg-canvas/60 grid grid-cols-2 gap-2 rounded-lg border p-3 text-xs">
        <div>
          <span className="text-fg-muted block">Nameplate</span>
          <span className="text-fg text-base font-semibold">
            {formatQuantity(fac.totalCapacityMW, "MW", { digits: 1 })}
          </span>
          <span className="text-fg-muted mt-0.5 block">
            {unitLabel(fac.unitCount)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-fg-muted block">Annual CO₂</span>
          <span className="font-mono text-base font-semibold text-emerald-400">
            {formatQuantity(fac.totalCo2Tons, "t")}
          </span>
          {fac.carbonIntensityLbsMWh ? (
            <span className="text-fg-muted mt-0.5 block font-mono">
              {Math.round(fac.carbonIntensityLbsMWh)} lbs/MWh
            </span>
          ) : null}
        </div>
      </div>
    </div>
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

const COLUMNS: { label: string; sort?: SortField; className: string }[] = [
  { label: "ORISPL", sort: "id", className: "w-20" },
  { label: "Facility & Grid Role", sort: "name", className: "w-[40%]" },
  { label: "Location", className: "w-[12%]" },
  { label: "Grid & Fuels", className: "w-[18%]" },
  { label: "Capacity", sort: "capacity", className: "w-[15%] text-right" },
  { label: "Annual CO₂", sort: "co2", className: "w-[15%] pr-4 text-right" },
];

export function FacilitiesTable({
  data,
  page,
  pageSize,
  sortBy,
  sortDir,
  isLoading,
  isPlaceholderData,
  onSortChange,
  compareIds,
  onToggleCompare,
  onInspect,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
}: {
  data?: FacilitiesPage;
  page: number;
  pageSize: number;
  sortBy: SortField;
  sortDir: SortDirection;
  isLoading: boolean;
  isPlaceholderData: boolean;
  onSortChange: (field: SortField) => void;
  compareIds: number[];
  onToggleCompare: (id: number) => void;
  onInspect: (id: number) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onResetFilters: () => void;
}) {
  const [jumpPageInput, setJumpPageInput] = useState("");
  const facilities = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(data?.totalPages ?? 1, 1);
  const rowProps = (fac: FacilityRow) => ({
    fac,
    isSelected: compareIds.includes(fac.id),
    onToggleCompare,
    onInspect,
  });

  const sortIcon = (field: SortField) =>
    sortBy !== field ? (
      <ArrowUpDown className="text-fg-muted h-3 w-3 opacity-60" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-400" />
    );

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
    <DataPanel className="border-edge/80 bg-surface/20 shadow-xs">
      {isLoading ? (
        <div className="divide-edge/60 divide-y">
          {Array.from({ length: Math.min(pageSize, 10) }, (_, i) => (
            <div key={i} className="animate-pulse space-y-2 p-3.5">
              <div className="bg-surface-2 h-4 w-2/3 rounded" />
              <div className="bg-surface-2/60 h-3 w-1/3 rounded" />
            </div>
          ))}
        </div>
      ) : facilities.length === 0 ? (
        <EmptyState
          title="No facilities match the active filter criteria."
          className="border-0 py-14"
          action={
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              Clear All Filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Scale className="text-fg-muted mx-auto h-3.5 w-3.5" />
                  </TableHead>
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col.label}
                      className={cn(
                        col.className,
                        col.sort &&
                          "hover:text-fg cursor-pointer transition-colors select-none",
                      )}
                      onClick={
                        col.sort ? () => onSortChange(col.sort!) : undefined
                      }
                    >
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          col.className.includes("text-right") && "justify-end",
                        )}
                      >
                        {col.label}
                        {col.sort && sortIcon(col.sort)}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilities.map((fac) => (
                  <FacilityTableRow key={fac.id} {...rowProps(fac)} />
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-edge/60 divide-y md:hidden">
            {facilities.map((fac) => (
              <FacilityCard key={fac.id} {...rowProps(fac)} />
            ))}
          </div>
        </>
      )}

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
            of{" "}
            <strong className="text-fg">{totalCount.toLocaleString()}</strong>{" "}
            <span className="hidden sm:inline">facilities</span>
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
    </DataPanel>
  );
}
