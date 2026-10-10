"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SourceBadge } from "~/components/ui/badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { percentOf, ProgressBar } from "~/components/ui/metric-bar";
import { Select, toOptions } from "~/components/ui/select";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  localSortProps,
  SortableTableHead,
  TableRow,
} from "~/components/ui/table";
import {
  buildDateOptionsForYear,
  clampDateToYear,
  getCampdPublishedYear,
  getDefaultCampdDateForYear,
  GRANULARITIES,
  type Granularity,
} from "~/lib/campd-reporting-period";
import type { SortDirection } from "~/lib/facility-filters";
import { cn, sortRows } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

interface GranularPlant {
  id: number;
  name: string;
  units?: { unitId: string; primaryFuel?: string | null }[];
  availableYears?: number[];
}

type Item =
  RouterOutputs["facilities"]["getGranularEmissions"]["items"][number] & {
    order: number;
  };

/** Header, width, and sort key per column; "Time Interval" sorts chronologically. */
const COLUMNS = [
  ["Period", "w-28 text-left", (i: Item) => i.order],
  ["Op. hours", "w-16", (i: Item) => i.operatingHours],
  ["Gross MWh", "w-24", (i: Item) => i.grossGenerationMWh],
  ["Heat MMBtu", "w-20", (i: Item) => i.heatInputMMBtu],
  ["CO₂ t", "w-20", (i: Item) => i.co2MassTons],
  ["SO₂ t", "w-12", (i: Item) => i.so2MassTons],
  ["NOₓ t", "w-12", (i: Item) => i.noxMassTons],
  ["lbs/MWh", "w-20", (i: Item) => i.co2IntensityLbsMWh],
] as const;
type ColumnLabel = (typeof COLUMNS)[number][0];

export function GranularEmissionsWindow({
  plants,
}: {
  plants: GranularPlant[];
}) {
  const [activeFacilityId, setActiveFacilityId] = useState(plants[0]?.id);
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  // `null` means "use the default for the current plant / published window".
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState("ALL");
  const [sort, setSort] = useState({
    sortBy: "Period" as ColumnLabel,
    sortDir: "asc" as SortDirection,
  });
  const head = localSortProps(sort, setSort, (f) => f !== "Period");

  const plant = plants.find((p) => p.id === activeFacilityId) ?? plants[0]!;
  const units = plant.units ?? [];

  const { data: availability } =
    api.facilities.getCampdPublishedThrough.useQuery(
      { facilityId: plant.id },
      { staleTime: 60 * 60 * 1000 },
    );
  const publishedThrough = availability?.publishedThrough;
  const lastPublishedYear = publishedThrough
    ? getCampdPublishedYear(publishedThrough)
    : new Date().getFullYear();

  const plantYears = (plant.availableYears ?? []).filter(
    (y) => y <= lastPublishedYear,
  );
  const yearOptions =
    plantYears.length > 0
      ? plantYears
      : [lastPublishedYear, lastPublishedYear - 1, lastPublishedYear - 2];
  const year = pickedYear ?? Math.max(...yearOptions);
  const date =
    pickedDate ??
    (publishedThrough
      ? getDefaultCampdDateForYear(year, publishedThrough)
      : `${year}-12-31`);
  const needsDate = granularity === "hourly" || granularity === "daily";

  const { data, isLoading, isFetching } =
    api.facilities.getGranularEmissions.useQuery(
      {
        facilityId: plant.id,
        granularity,
        year,
        date: needsDate ? date : undefined,
        unitId: selectedUnit === "ALL" ? undefined : selectedUnit,
      },
      { placeholderData: (prev) => prev },
    );

  const livePublishedThrough = data?.publishedThrough ?? publishedThrough;
  const dateOptions = useMemo(
    () => buildDateOptionsForYear(year, livePublishedThrough),
    [year, livePublishedThrough],
  );

  const items = data?.items ?? [];
  const summary = data?.summary;
  const maxGen = Math.max(...items.map((i) => i.grossGenerationMWh), 1);
  const maxCo2 = Math.max(...items.map((i) => i.co2MassTons), 1);

  const selectPlant = (id: string) => {
    setActiveFacilityId(Number(id));
    setPickedYear(null);
    setPickedDate(null);
    setSelectedUnit("ALL");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-fg-2 text-sm">
            {plant.name} by hour, day, week, month, or year
            {livePublishedThrough &&
              `; the EPA has published through ${livePublishedThrough}`}
            .
          </p>
          {data && data.source !== "UNAVAILABLE" && (
            <SourceBadge
              kind={data.source === "LOCAL_RECORDS" ? "db" : "api"}
            />
          )}
          {isFetching && (
            <RefreshCw className="text-fg-muted h-3.5 w-3.5 animate-spin" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {plants.length > 1 && (
            <Select
              value={String(plant.id)}
              onValueChange={selectPlant}
              options={plants.map((p) => ({
                value: String(p.id),
                label: p.name,
              }))}
              className="w-[280px] sm:w-[320px]"
            />
          )}
          <Select
            value={granularity}
            onValueChange={(val) => setGranularity(val as Granularity)}
            options={GRANULARITIES.map((g) => ({
              value: g,
              label: g[0]!.toUpperCase() + g.slice(1),
            }))}
            className="w-[105px]"
          />
          {granularity !== "yearly" && (
            <Select
              value={String(year)}
              onValueChange={(val) => {
                const newYear = Number(val);
                setPickedYear(newYear);
                setPickedDate(
                  clampDateToYear(date, newYear, livePublishedThrough),
                );
              }}
              options={toOptions(yearOptions)}
              className="w-[82px]"
            />
          )}
          {units.length > 0 && (
            <Select
              value={selectedUnit}
              onValueChange={setSelectedUnit}
              options={[
                { value: "ALL", label: "All Units" },
                ...units.map((u) => ({
                  value: u.unitId,
                  label: `Unit ${u.unitId}${u.primaryFuel ? ` (${u.primaryFuel})` : ""}`,
                })),
              ]}
              className="w-[150px]"
            />
          )}
          {needsDate && (
            <Select
              value={date}
              onValueChange={setPickedDate}
              options={dateOptions}
              placeholder="Select date"
              className="w-[155px] sm:w-[160px]"
            />
          )}
        </div>
      </div>

      {summary && items.length > 0 && (
        <KpiStrip className="lg:grid-cols-4">
          <StatTile
            label="Gross load"
            value={`${summary.grossGenerationMWh.toLocaleString()} MWh`}
            subtext={`${summary.operatingHours.toLocaleString()} operating hours`}
          />
          <StatTile
            label="CO₂"
            value={`${summary.co2MassTons.toLocaleString()} t`}
            subtext={`${summary.heatInputMMBtu.toLocaleString()} MMBtu heat input`}
          />
          <StatTile
            label="CO₂ rate"
            value={
              summary.co2IntensityLbsMWh !== null
                ? `${summary.co2IntensityLbsMWh.toLocaleString()} lbs/MWh`
                : "—"
            }
          />
          <StatTile
            label="Heat rate"
            value={
              summary.heatRateMMBtuMWh !== null
                ? `${summary.heatRateMMBtuMWh.toFixed(2)} MMBtu/MWh`
                : "—"
            }
          />
        </KpiStrip>
      )}

      <DataPanel>
        {isLoading ? (
          <InlineLoading title={`Loading ${granularity} data from the EPA…`} />
        ) : items.length === 0 ? (
          <EmptyState
            title={
              data?.error
                ? "CAMPD window unavailable"
                : "No data for this window"
            }
            description={
              data?.error ??
              "EPA CAMPD returned no records for this facility and time window."
            }
          />
        ) : (
          <div className="max-h-[380px] overflow-auto">
            <Table>
              <TableHeader className="bg-surface sticky top-0 z-10">
                <TableRow>
                  {COLUMNS.map(([label, width]) => (
                    <SortableTableHead
                      key={label}
                      label={label}
                      sort={label}
                      {...head}
                      className={cn("h-8 px-2 text-right", width)}
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortRows(
                  items.map((item, order) => ({ ...item, order })),
                  COLUMNS.find(([label]) => label === sort.sortBy)![2],
                  sort.sortDir,
                ).map((item) => (
                  <TableRow key={item.periodKey} className="tabular-nums">
                    <TableCell className="px-2 py-1">
                      <span className="text-fg">{item.periodLabel}</span>
                      {item.subLabel && (
                        <span className="text-fg-muted ml-1.5">
                          {item.subLabel}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-fg-2 px-2 py-1 text-right whitespace-nowrap">
                      {item.operatingHours.toLocaleString()}
                    </TableCell>
                    {(
                      [
                        { value: item.grossGenerationMWh, max: maxGen },
                        { value: item.heatInputMMBtu },
                        { value: item.co2MassTons, max: maxCo2 },
                      ] satisfies { value: number; max?: number }[]
                    ).map(({ value, max }, i) => (
                      <TableCell key={i} className="px-2 py-1 text-right">
                        <span className={max ? "text-fg" : "text-fg-2"}>
                          {value.toLocaleString()}
                        </span>
                        {max && (
                          <ProgressBar
                            percent={percentOf(value, max)}
                            className="mt-0.5 ml-auto h-1 w-12"
                          />
                        )}
                      </TableCell>
                    ))}
                    {[item.so2MassTons, item.noxMassTons].map((value, i) => (
                      <TableCell
                        key={i}
                        className="text-fg-muted px-2 py-1 text-right whitespace-nowrap"
                      >
                        {value.toFixed(1)}
                      </TableCell>
                    ))}
                    <TableCell className="text-fg-2 px-2 py-1 text-right whitespace-nowrap">
                      {item.co2IntensityLbsMWh?.toLocaleString() ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}
