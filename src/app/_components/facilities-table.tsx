"use client";

import { Scale, ShieldCheck, Zap } from "lucide-react";
import {
  Badge,
  CarbonIntensityBadge,
  FuelBadge,
  PlantRoleBadge,
} from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState } from "~/components/ui/empty-state";
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableSkeleton,
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
  showRank?: boolean;
  isSelected: boolean;
  onToggleCompare: (id: number) => void;
  onInspect: (id: number) => void;
}

export const SELECTED_ROW =
  "bg-emerald-500/10 hover:bg-emerald-500/15 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30";

const unitLabel = (count: number) =>
  `${count} ${count === 1 ? "unit" : "units"}`;

export function CompareCheckbox({
  label,
  isSelected,
  onToggle,
}: {
  label: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={onToggle}
      onClick={(e) => e.stopPropagation()}
      className="border-edge bg-canvas h-4 w-4 cursor-pointer rounded accent-emerald-500 md:h-3.5 md:w-3.5"
      aria-label={`Select ${label} for comparison`}
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
  showRank,
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
          label={fac.name}
          isSelected={isSelected}
          onToggle={() => onToggleCompare(fac.id)}
        />
      </TableCell>
      <TableCell className="text-fg-muted font-mono text-xs">
        {showRank && <RankBadge rank={fac.rank} />}#{fac.id}
      </TableCell>
      <TableCell className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="text-fg truncate text-base font-semibold"
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
  showRank,
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
              label={fac.name}
              isSelected={isSelected}
              onToggle={() => onToggleCompare(fac.id)}
            />
          </div>
          <div className="min-w-0">
            <h4 className="text-fg truncate text-base font-semibold tracking-tight">
              {showRank && <RankBadge rank={fac.rank} />}
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

/** Position under a Top-N ranking (overall or within the state). */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <Badge variant="success" className="mr-1.5 px-1.5 py-0 font-mono">
      {rank}
    </Badge>
  );
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
  showRank,
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
  showRank: boolean;
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
  const facilities = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(data?.totalPages ?? 1, 1);
  const rowProps = (fac: FacilityRow) => ({
    fac,
    showRank,
    isSelected: compareIds.includes(fac.id),
    onToggleCompare,
    onInspect,
  });

  return (
    <DataPanel className="border-edge/80 bg-surface/20 shadow-xs">
      {isLoading ? (
        <TableSkeleton rows={pageSize} />
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
                    <SortableTableHead
                      key={col.label}
                      {...col}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSortChange={onSortChange}
                    />
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

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        totalPages={totalPages}
        itemLabel="facilities"
        isPlaceholderData={isPlaceholderData}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </DataPanel>
  );
}
