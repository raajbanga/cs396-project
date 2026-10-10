"use client";

import { Scale } from "lucide-react";
import { Badge, CarbonIntensityBadge, FuelBadge } from "~/components/ui/badge";
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
import type { SortDirection, UnitSortField } from "~/lib/facility-filters";
import { formatCountyShort } from "~/lib/plant-narrative";
import {
  cn,
  datasetOriginLabel,
  formatNumber,
  formatQuantity,
} from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import { CompareCheckbox, RankBadge, SELECTED_ROW } from "./facilities-table";

type UnitYearsPage = RouterOutputs["facilities"]["getUnitYears"];
type UnitYearRow = UnitYearsPage["items"][number];

const NUM = "text-right font-mono text-xs whitespace-nowrap";

/** Which dataset wrote this unit-year: the CAMPD API or a file upload (date and name on hover). */
function OriginBadge({ row }: { row: UnitYearRow }) {
  if (!row.origin || !row.datasetImportedAt) {
    return <span className="text-fg-muted text-xs">—</span>;
  }
  const api = row.origin === "API";
  return (
    <Badge
      variant={api ? "sky" : "purple"}
      title={`${datasetOriginLabel({ source: row.origin, importedAt: row.datasetImportedAt })}${row.datasetName ? `\n${row.datasetName}` : ""}`}
    >
      {api ? "API" : "Upload"}
    </Badge>
  );
}

/** Metric columns: header, sort key, and how the row value renders. */
const METRIC_COLUMNS: {
  label: string;
  sort: UnitSortField;
  render: (r: UnitYearRow) => string;
}[] = [
  {
    label: "MW",
    sort: "capacity",
    render: (r) => formatQuantity(r.nameplateCapacityMW, "", { digits: 1 }),
  },
  {
    label: "Op. hrs",
    sort: "operatingHours",
    render: (r) => formatNumber(r.operatingHours),
  },
  {
    label: "Gross MWh",
    sort: "grossGenerationMWh",
    render: (r) => formatNumber(r.grossGenerationMWh),
  },
  {
    label: "Heat MMBtu",
    sort: "heatInputMMBtu",
    render: (r) => formatNumber(r.heatInputMMBtu),
  },
  {
    label: "CO₂ t",
    sort: "co2MassTons",
    render: (r) => formatNumber(r.co2MassTons),
  },
  {
    label: "SO₂ t",
    sort: "so2MassTons",
    render: (r) => formatNumber(r.so2MassTons, 1),
  },
  {
    label: "NOₓ t",
    sort: "noxMassTons",
    render: (r) => formatNumber(r.noxMassTons, 1),
  },
];

/** §8 Units view: one row per facility-unit-year, sharing the facilities table's header, pagination, and compare checkbox. */
export function UnitsTable({
  data,
  page,
  pageSize,
  sortBy,
  sortDir,
  showRank,
  isLoading,
  isPlaceholderData,
  onSortChange,
  compareUnitIds,
  onToggleCompare,
  onInspect,
  onPageChange,
  onPageSizeChange,
  onResetFilters,
}: {
  data?: UnitYearsPage;
  page: number;
  pageSize: number;
  sortBy: UnitSortField;
  sortDir: SortDirection;
  showRank: boolean;
  isLoading: boolean;
  isPlaceholderData: boolean;
  onSortChange: (field: UnitSortField) => void;
  compareUnitIds: string[];
  onToggleCompare: (unitInternalId: string) => void;
  onInspect: (unitInternalId: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onResetFilters: () => void;
}) {
  const rows = data?.items ?? [];
  const head = { sortBy, sortDir, onSortChange };

  return (
    <DataPanel className="border-edge/80 bg-surface/20 shadow-xs">
      {isLoading ? (
        <TableSkeleton rows={pageSize} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No unit-years match the active filter criteria."
          className="border-0 py-14"
          action={
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              Clear All Filters
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">
                <Scale className="text-fg-muted mx-auto h-3.5 w-3.5" />
              </TableHead>
              <SortableTableHead label="Facility" sort="facility" {...head} />
              <SortableTableHead label="State" sort="state" {...head} />
              <SortableTableHead label="Unit" sort="unitId" {...head} />
              <SortableTableHead label="Year" sort="year" {...head} />
              <TableHead>Origin</TableHead>
              {METRIC_COLUMNS.map((col) => (
                <SortableTableHead
                  key={col.sort}
                  label={col.label}
                  sort={col.sort}
                  className="text-right"
                  {...head}
                />
              ))}
              <SortableTableHead
                label="lbs/MWh"
                sort="co2Intensity"
                className="text-right"
                {...head}
              />
              <SortableTableHead
                label="Heat rate"
                sort="heatRate"
                className="pr-4 text-right"
                {...head}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const isSelected = compareUnitIds.includes(r.unitInternalId);
              const label = `${r.facilityName} unit ${r.unitId}`;
              return (
                <TableRow
                  key={r.id}
                  className={cn(
                    "group cursor-pointer",
                    isSelected && SELECTED_ROW,
                  )}
                  onClick={() => onInspect(r.unitInternalId)}
                >
                  <TableCell className="text-center">
                    <CompareCheckbox
                      label={label}
                      isSelected={isSelected}
                      onToggle={() => onToggleCompare(r.unitInternalId)}
                    />
                  </TableCell>
                  <TableCell className="max-w-56 min-w-40">
                    <div className="flex items-center">
                      {showRank && <RankBadge rank={r.rank} />}
                      <span
                        className="text-fg truncate font-semibold"
                        title={r.facilityName}
                      >
                        {r.facilityName}
                      </span>
                    </div>
                    <div className="text-fg-muted font-mono text-xs">
                      #{r.facilityId}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="text-fg-2 font-semibold">{r.stateCode}</div>
                    <div
                      className="text-fg-muted max-w-28 truncate text-xs"
                      title={r.county ?? undefined}
                    >
                      {formatCountyShort(r.county)}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-36">
                    <div className="font-mono text-xs font-semibold text-emerald-400">
                      Unit {r.unitId}
                    </div>
                    <div
                      className="text-fg-muted max-w-44 truncate text-xs"
                      title={r.unitType ?? undefined}
                    >
                      {r.unitType ?? "—"}
                    </div>
                    {r.primaryFuel && (
                      <div className="pt-0.5">
                        <FuelBadge fuel={r.primaryFuel} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-fg font-mono text-xs font-semibold">
                    {r.year}
                  </TableCell>
                  <TableCell>
                    <OriginBadge row={r} />
                  </TableCell>
                  {METRIC_COLUMNS.map((col) => (
                    <TableCell
                      key={col.sort}
                      className={cn(
                        NUM,
                        col.sort === sortBy ? "text-fg font-semibold" : "",
                      )}
                    >
                      {col.render(r)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <CarbonIntensityBadge
                      intensity={r.co2IntensityLbsMWh}
                      showValue
                    />
                  </TableCell>
                  <TableCell className={cn(NUM, "text-fg-muted pr-4")}>
                    {formatQuantity(r.heatRateMMBtuMWh, "", { digits: 2 })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalCount={data?.totalCount ?? 0}
        totalPages={Math.max(data?.totalPages ?? 1, 1)}
        itemLabel="unit-years"
        isPlaceholderData={isPlaceholderData}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </DataPanel>
  );
}
