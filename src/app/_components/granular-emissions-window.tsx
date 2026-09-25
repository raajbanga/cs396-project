"use client";

import { useMemo, useState } from "react";
import { Clock, Flame, Gauge, Leaf, RefreshCw, Zap } from "lucide-react";
import { Badge, CarbonIntensityBadge } from "~/components/ui/badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import {
  percentOf,
  ProgressBar,
  type BarColor,
} from "~/components/ui/metric-bar";
import { Select, toOptions } from "~/components/ui/select";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
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
import { getCarbonIntensityTier } from "~/lib/plant-narrative";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

export interface GranularPlant {
  id: number;
  name: string;
  units?: { unitId: string; primaryFuel?: string | null }[];
  availableYears?: number[];
}

const INTENSITY_TEXT = {
  success: "text-emerald-400",
  warning: "text-amber-400",
  destructive: "text-rose-400",
} as Record<string, string>;

const COLUMNS = [
  ["Time Interval", "w-28 text-left"],
  ["Operating", "w-16"],
  ["Generation", "w-24"],
  ["Heat Input", "w-20"],
  ["CO₂ Mass", "w-20"],
  ["SO₂", "w-12"],
  ["NOₓ", "w-12"],
  ["Intensity", "w-20"],
] as const;

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
    <div className="space-y-3.5">
      <div className="border-edge bg-surface/50 space-y-3 rounded-xl border p-3 sm:p-4">
        <div className="border-edge/40 flex items-center gap-2.5 border-b pb-2.5">
          <div className="border-edge bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-fg text-sm font-semibold">
                Temporal Emissions Telemetry
              </span>
              {data?.source === "EPA_CAMPD_API" && !data.error && (
                <Badge variant="success" className="px-1.5 py-0">
                  Live EPA CAMPD
                </Badge>
              )}
              {data?.source === "LOCAL_RECORDS" && (
                <Badge variant="outline" className="px-1.5 py-0">
                  CEMS Store
                </Badge>
              )}
              {isFetching && (
                <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
              )}
            </div>
            <p className="text-fg-muted text-xs">
              Filtering stack sensors for {plant.name} across time resolutions
              {livePublishedThrough &&
                ` · EPA published through ${livePublishedThrough}`}
            </p>
          </div>
        </div>

        <div className="-m-1 flex items-center gap-2 overflow-x-auto p-1 whitespace-nowrap">
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
        <KpiStrip className="gap-2.5 sm:grid-cols-4 sm:gap-2.5">
          <StatTile
            label="Total Generation"
            icon={<Zap className="h-3.5 w-3.5 text-sky-400" />}
            value={`${summary.grossGenerationMWh.toLocaleString()} MWh`}
            subtext={`${summary.operatingHours.toLocaleString()} run hours`}
          />
          <StatTile
            label="Carbon Dioxide"
            icon={<Flame className="h-3.5 w-3.5 text-amber-400" />}
            value={`${summary.co2MassTons.toLocaleString()} t`}
            subtext={`${summary.heatInputMMBtu.toLocaleString()} MMBtu fuel`}
          />
          <StatTile
            label="Carbon Intensity"
            icon={<Leaf className="h-3.5 w-3.5 text-emerald-400" />}
            value={
              summary.co2IntensityLbsMWh !== null ? (
                <div className="flex items-center gap-2">
                  {summary.co2IntensityLbsMWh.toLocaleString()}
                  <CarbonIntensityBadge
                    intensity={summary.co2IntensityLbsMWh}
                  />
                </div>
              ) : (
                "N/A"
              )
            }
            subtext="lbs CO₂ / MWh"
          />
          <StatTile
            label="Heat Rate Efficiency"
            icon={<Gauge className="h-3.5 w-3.5 text-purple-400" />}
            value={summary.heatRateMMBtuMWh?.toFixed(2) ?? "N/A"}
            subtext="MMBtu / MWh (Thermal efficiency)"
          />
        </KpiStrip>
      )}

      <DataPanel>
        {isLoading ? (
          <InlineLoading
            title={`Retrieving ${granularity} continuous monitoring data...`}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title={
              data?.error
                ? "CAMPD window unavailable"
                : "No telemetry for this window"
            }
            description={
              data?.error ??
              "No stack telemetry returned by EPA CAMPD for this specific facility and time window."
            }
            className="border-0"
          />
        ) : (
          <div className="max-h-[380px] overflow-auto">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10 backdrop-blur-xs">
                <TableRow>
                  {COLUMNS.map(([label, width]) => (
                    <TableHead
                      key={label}
                      className={cn(
                        "h-7 px-1.5 py-1 text-right font-sans text-xs",
                        width,
                      )}
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.periodKey} className="font-mono text-xs">
                    <TableCell className="px-2 py-1 font-sans">
                      <span className="text-fg font-semibold">
                        {item.periodLabel}
                      </span>
                      {item.subLabel && (
                        <span className="text-fg-muted ml-1.5 text-[10px]">
                          {item.subLabel}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-fg-2 px-1.5 py-1 text-right whitespace-nowrap">
                      {item.operatingHours.toLocaleString()}
                      <span className="text-fg-muted ml-0.5 text-[10px]">
                        h
                      </span>
                    </TableCell>
                    {(
                      [
                        {
                          value: item.grossGenerationMWh,
                          max: maxGen,
                          color: "sky",
                        },
                        { value: item.heatInputMMBtu },
                        {
                          value: item.co2MassTons,
                          max: maxCo2,
                          color: "amber",
                        },
                      ] satisfies {
                        value: number;
                        max?: number;
                        color?: BarColor;
                      }[]
                    ).map(({ value, max, color }, i) => (
                      <TableCell key={i} className="px-1.5 py-1 text-right">
                        <span
                          className={
                            max ? "text-fg font-semibold" : "text-fg-2"
                          }
                        >
                          {value.toLocaleString()}
                        </span>
                        {max && (
                          <ProgressBar
                            percent={percentOf(value, max)}
                            color={color}
                            className="bg-edge/60 mt-0.5 ml-auto h-1 w-12"
                          />
                        )}
                      </TableCell>
                    ))}
                    {[item.so2MassTons, item.noxMassTons].map((value, i) => (
                      <TableCell
                        key={i}
                        className="text-fg-muted px-1 py-1 text-right text-[11px] whitespace-nowrap"
                      >
                        {value.toFixed(1)}
                      </TableCell>
                    ))}
                    <TableCell className="px-2 py-1 text-right font-semibold whitespace-nowrap">
                      {item.co2IntensityLbsMWh !== null ? (
                        <span
                          className={
                            INTENSITY_TEXT[
                              getCarbonIntensityTier(item.co2IntensityLbsMWh)
                                .variant
                            ]
                          }
                        >
                          {item.co2IntensityLbsMWh.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-fg-muted font-normal">—</span>
                      )}
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
