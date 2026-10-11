"use client";

import { use } from "react";
import { FuelBadge, OriginBadge } from "~/components/ui/badge";
import {
  ResultsPanel,
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Paging,
} from "~/components/ui/table";
import type { SortDirection, UnitSortField } from "~/lib/facility-filters";
import {
  formatCountyShort,
  getCarbonIntensityTier,
} from "~/lib/plant-narrative";
import { cn, formatNumber, formatQuantity } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import { DetailLink } from "./detail-link";
import { CompareCheckbox, RankBadge, SELECTED_ROW } from "./facilities-table";
import { SelectionContext } from "./selection-context";

type UnitYearsPage = RouterOutputs["facilities"]["getUnitYears"];
type UnitYearRow = UnitYearsPage["items"][number];

const NUM = "text-right tabular-nums whitespace-nowrap";

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
  paging,
  sortBy,
  sortDir,
  showRank,
  onSortChange,
  compareUnitIds,
  onToggleCompare,
  onResetFilters,
}: {
  data?: UnitYearsPage;
  paging: Paging;
  sortBy: UnitSortField;
  sortDir: SortDirection;
  showRank: boolean;
  onSortChange: (field: UnitSortField) => void;
  compareUnitIds: string[];
  onToggleCompare: (unitInternalId: string) => void;
  onResetFilters: () => void;
}) {
  const { inspect } = use(SelectionContext);
  const rows = data?.items ?? [];
  const head = { sortBy, sortDir, onSortChange };

  return (
    <ResultsPanel
      paging={paging}
      data={data}
      itemLabel="unit-years"
      onResetFilters={onResetFilters}
    >
      <Table className="[&_td]:px-2 [&_th]:px-2">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Compare</span>
            </TableHead>
            <SortableTableHead label="Facility" sort="facility" {...head} />
            <SortableTableHead label="Unit" sort="unitId" {...head} />
            <SortableTableHead label="State" sort="state" {...head} />
            <SortableTableHead label="Year" sort="year" {...head} />
            <TableHead>Fuel</TableHead>
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
              className="text-right"
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
                className={cn("cursor-pointer", isSelected && SELECTED_ROW)}
                onClick={() => inspect({ kind: "unit", id: r.unitInternalId })}
              >
                <TableCell className="text-center">
                  <CompareCheckbox
                    label={label}
                    isSelected={isSelected}
                    onToggle={() => onToggleCompare(r.unitInternalId)}
                  />
                </TableCell>
                <TableCell className="max-w-48 min-w-36">
                  <div className="truncate">
                    {showRank && <RankBadge rank={r.rank} />}
                    <span className="text-fg" title={r.facilityName}>
                      {r.facilityName}
                    </span>
                  </div>
                  <div className="text-fg-muted font-mono text-xs">
                    {r.facilityId}
                  </div>
                </TableCell>
                <TableCell className="max-w-36 min-w-24">
                  <DetailLink
                    view={{ kind: "unit", id: r.unitInternalId }}
                    className="text-fg block font-medium"
                  >
                    Unit {r.unitId}
                  </DetailLink>
                  <div
                    className="text-fg-muted truncate text-xs"
                    title={r.unitType ?? undefined}
                  >
                    {r.unitType ?? "—"}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="text-fg-2">{r.stateCode}</div>
                  <div
                    className="text-fg-muted max-w-28 truncate text-xs"
                    title={r.county ?? undefined}
                  >
                    {formatCountyShort(r.county)}
                  </div>
                </TableCell>
                <TableCell className="text-fg tabular-nums">{r.year}</TableCell>
                <TableCell>
                  {r.primaryFuel ? (
                    <FuelBadge fuel={r.primaryFuel} />
                  ) : (
                    <span className="text-fg-muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <OriginBadge {...r} />
                </TableCell>
                {METRIC_COLUMNS.map((col) => (
                  <TableCell
                    key={col.sort}
                    className={cn(
                      NUM,
                      col.sort === sortBy ? "text-fg font-medium" : "",
                    )}
                  >
                    {col.render(r)}
                  </TableCell>
                ))}
                <TableCell
                  className={NUM}
                  title={
                    r.co2IntensityLbsMWh != null
                      ? getCarbonIntensityTier(r.co2IntensityLbsMWh).description
                      : undefined
                  }
                >
                  {formatNumber(r.co2IntensityLbsMWh)}
                </TableCell>
                <TableCell className={cn(NUM, "text-fg-muted")}>
                  {formatQuantity(r.heatRateMMBtuMWh, "", { digits: 2 })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ResultsPanel>
  );
}
