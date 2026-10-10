"use client";

import { use } from "react";
import { FuelBadge } from "~/components/ui/badge";
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
  getCarbonIntensityTier,
  getPlantRole,
} from "~/lib/plant-narrative";
import { cn, formatQuantity, plural } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import { DetailLink } from "./detail-link";
import { SelectionContext } from "./selection-context";

type FacilitiesPage = RouterOutputs["facilities"]["getFacilities"];
type FacilityRow = FacilitiesPage["items"][number];

interface RowProps {
  fac: FacilityRow;
  showRank?: boolean;
  isSelected: boolean;
  onToggleCompare: (id: number) => void;
}

export const SELECTED_ROW = "bg-primary/[0.06] hover:bg-primary/10";

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
      className="accent-primary h-4 w-4 cursor-pointer align-middle"
      aria-label={`Select ${label} for comparison`}
    />
  );
}

/** Position under a Top-N ranking (overall or within the state). */
export function RankBadge({ rank }: { rank: number }) {
  return <span className="text-fg-muted mr-1.5 tabular-nums">{rank}.</span>;
}

/** Up to two fuels as colored dots, then "+n". */
function FuelList({ fuels }: { fuels: string[] }) {
  if (fuels.length === 0)
    return <span className="text-fg-muted text-sm">Not listed</span>;
  return (
    <div className="flex flex-col gap-0.5" title={fuels.join(", ")}>
      {fuels.slice(0, 2).map((fuel) => (
        <FuelBadge key={fuel} fuel={fuel} />
      ))}
      {fuels.length > 2 && (
        <span className="text-fg-muted pl-3.5 text-xs">
          +{fuels.length - 2} more
        </span>
      )}
    </div>
  );
}

const roleOf = (fac: FacilityRow) =>
  getPlantRole({
    operatingHours: fac.peakUnitHours ?? 0,
    capacityMW: fac.totalCapacityMW,
    sourceCategory: fac.sourceCategory,
    primaryFuels: fac.primaryFuels,
  });

function FacilityTableRow({
  fac,
  showRank,
  isSelected,
  onToggleCompare,
}: RowProps) {
  const { inspect } = use(SelectionContext);
  const owner = cleanOwnerOperator(fac.ownerOperator);
  const role = roleOf(fac);
  const tier =
    fac.carbonIntensityLbsMWh != null
      ? getCarbonIntensityTier(fac.carbonIntensityLbsMWh)
      : null;

  return (
    <TableRow
      className={cn("cursor-pointer", isSelected && SELECTED_ROW)}
      onClick={() => inspect({ kind: "facility", id: fac.id })}
    >
      <TableCell className="text-center">
        <CompareCheckbox
          label={fac.name}
          isSelected={isSelected}
          onToggle={() => onToggleCompare(fac.id)}
        />
      </TableCell>
      <TableCell className="min-w-0">
        <div className="truncate">
          {showRank && <RankBadge rank={fac.rank} />}
          <DetailLink
            view={{ kind: "facility", id: fac.id }}
            className="text-fg font-medium"
            title={fac.name}
          >
            {fac.name}
          </DetailLink>
        </div>
        <div className="text-fg-muted truncate text-xs" title={owner}>
          {owner}
        </div>
      </TableCell>
      <TableCell className="text-fg-muted font-mono text-xs">
        {fac.id}
      </TableCell>
      <TableCell className="min-w-0">
        <div className="text-fg-2">{fac.stateCode}</div>
        <div className="text-fg-muted truncate text-xs">
          {formatCountyShort(fac.county)}
        </div>
      </TableCell>
      <TableCell className="min-w-0">
        <FuelList fuels={fac.primaryFuels} />
      </TableCell>
      <TableCell className="min-w-0">
        <div className="text-fg-2 truncate" title={role.description}>
          {role.badgeLabel}
        </div>
        <div className="text-fg-muted text-xs">{fac.nercRegion ?? "—"}</div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="text-fg">
          {formatQuantity(fac.totalCapacityMW, "MW", { digits: 1 })}
        </div>
        <div className="text-fg-muted text-xs">
          {plural(fac.unitCount, "unit")}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="text-fg">{formatQuantity(fac.totalCo2Tons, "t")}</div>
        <div
          className="text-fg-muted truncate text-xs"
          title={tier?.description}
        >
          {tier?.label ?? "—"}
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
}: RowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-3",
        isSelected && SELECTED_ROW,
      )}
    >
      <div className="pt-0.5">
        <CompareCheckbox
          label={fac.name}
          isSelected={isSelected}
          onToggle={() => onToggleCompare(fac.id)}
        />
      </div>
      <DetailLink
        view={{ kind: "facility", id: fac.id }}
        className="min-w-0 flex-1 space-y-1 hover:no-underline"
      >
        <div className="text-fg truncate font-medium">
          {showRank && <RankBadge rank={fac.rank} />}
          {fac.name}
        </div>
        <div className="text-fg-muted truncate text-xs">
          {fac.id} · {formatCountyShort(fac.county)}, {fac.stateCode} ·{" "}
          {roleOf(fac).badgeLabel}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm tabular-nums">
          <FuelBadge fuel={fac.primaryFuels[0] ?? "Not listed"} />
          <span className="text-fg-2 ml-auto whitespace-nowrap">
            {formatQuantity(fac.totalCapacityMW, "MW", { digits: 1 })} ·{" "}
            {formatQuantity(fac.totalCo2Tons, "t")}
          </span>
        </div>
      </DetailLink>
    </div>
  );
}

const COLUMNS: { label: string; sort?: SortField; className: string }[] = [
  { label: "Facility", sort: "name", className: "w-[30%]" },
  { label: "ID", sort: "id", className: "w-20" },
  { label: "State", className: "w-[11%]" },
  { label: "Primary fuel", className: "w-[17%]" },
  { label: "Role, grid", className: "w-[14%]" },
  { label: "Capacity", sort: "capacity", className: "w-[11%] text-right" },
  { label: "CO₂", sort: "co2", className: "w-[14%] text-right" },
];

export function FacilitiesTable({
  data,
  page,
  pageSize,
  sortBy,
  sortDir,
  showRank,
  year,
  isLoading,
  isPlaceholderData,
  onSortChange,
  compareIds,
  onToggleCompare,
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
  /** The year filter; CO₂ totals cover it, or every year when "ALL". */
  year: string;
  isLoading: boolean;
  isPlaceholderData: boolean;
  onSortChange: (field: SortField) => void;
  compareIds: number[];
  onToggleCompare: (id: number) => void;
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
  });

  return (
    <DataPanel>
      {isLoading ? (
        <TableSkeleton rows={pageSize} />
      ) : facilities.length === 0 ? (
        <EmptyState
          title="No facilities match these filters."
          description="Remove a filter above, or clear them all."
          action={
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Compare</span>
                  </TableHead>
                  {COLUMNS.map((col) => (
                    <SortableTableHead
                      key={col.label}
                      {...col}
                      label={
                        col.sort === "co2"
                          ? `CO₂, ${year === "ALL" ? "all years" : year}`
                          : col.label
                      }
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
          <div className="divide-edge/70 divide-y md:hidden">
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
