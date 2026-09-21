"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Flame, Gauge, Leaf, RefreshCw, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { CarbonIntensityBadge } from "~/components/ui/carbon-intensity-badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState } from "~/components/ui/empty-state";
import { InlineLoading } from "~/components/ui/inline-loading";
import { KpiStrip } from "~/components/ui/kpi-strip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { StatTile } from "~/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  getCampdPublishedYear,
  getDefaultCampdDateForYear,
  getDefaultCampdYearOptions,
} from "~/lib/campd-reporting-period";
import { buildDateOptionsForYear, clampDateToYear } from "~/lib/date-options";
import { api } from "~/trpc/react";

export interface UnitOption {
  unitId: string;
  id?: string;
  unitType?: string | null;
  primaryFuel?: string | null;
}

export interface PlantOption {
  id: number;
  name: string;
  units?: UnitOption[];
  availableYears?: number[];
}

export interface GranularEmissionsWindowProps {
  facilityId: number;
  facilityName: string;
  units?: UnitOption[];
  availableYears?: number[];
  plants?: PlantOption[];
  initialGranularity?: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
}

export function GranularEmissionsWindow({
  facilityId,
  facilityName,
  units = [],
  availableYears,
  plants,
  initialGranularity = "monthly",
}: GranularEmissionsWindowProps) {
  const [activeFacilityId, setActiveFacilityId] = useState<number>(facilityId);
  const [granularity, setGranularity] = useState<
    "hourly" | "daily" | "weekly" | "monthly" | "yearly"
  >(initialGranularity);

  const currentPlant = useMemo(() => {
    if (!plants || plants.length === 0) {
      return { id: facilityId, name: facilityName, units, availableYears };
    }
    return (
      plants.find((p) => p.id === activeFacilityId) ??
      plants[0] ?? { id: facilityId, name: facilityName, units, availableYears }
    );
  }, [
    plants,
    activeFacilityId,
    facilityId,
    facilityName,
    units,
    availableYears,
  ]);

  const currentUnits = currentPlant.units ?? units;

  const { data: availability } =
    api.facilities.getCampdPublishedThrough.useQuery(
      { facilityId: currentPlant.id },
      { staleTime: 60 * 60 * 1000 },
    );

  const publishedThrough = availability?.publishedThrough;
  const lastPublishedYear = publishedThrough
    ? getCampdPublishedYear(publishedThrough)
    : new Date().getFullYear();

  const plantYears = (
    currentPlant.availableYears ??
    availableYears ??
    []
  ).filter((y) => y <= lastPublishedYear);
  const yearsForPicker =
    plantYears.length > 0
      ? plantYears
      : publishedThrough
        ? getDefaultCampdYearOptions(publishedThrough)
        : [lastPublishedYear];
  const defaultYear = Math.min(Math.max(...yearsForPicker), lastPublishedYear);

  const [year, setYear] = useState<number>(defaultYear);
  const [date, setDate] = useState<string>(() => `${defaultYear}-12-31`);
  const [selectedUnit, setSelectedUnit] = useState<string>("ALL");

  useEffect(() => {
    setActiveFacilityId(facilityId);
  }, [facilityId]);

  useEffect(() => {
    setYear(defaultYear);
    setDate(
      publishedThrough
        ? getDefaultCampdDateForYear(defaultYear, publishedThrough)
        : `${defaultYear}-12-31`,
    );
    setSelectedUnit("ALL");
  }, [currentPlant.id, defaultYear, publishedThrough]);

  const { data, isLoading, isFetching } =
    api.facilities.getGranularEmissions.useQuery(
      {
        facilityId: currentPlant.id,
        granularity,
        year,
        date:
          granularity === "hourly" || granularity === "daily"
            ? date
            : undefined,
        unitId: selectedUnit === "ALL" ? undefined : selectedUnit,
      },
      { placeholderData: (prev) => prev },
    );

  const livePublishedThrough = data?.publishedThrough ?? publishedThrough;

  const dateOptions = useMemo(
    () => buildDateOptionsForYear(year, livePublishedThrough),
    [year, livePublishedThrough],
  );

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const summary = data?.summary;

  const maxGen = useMemo(
    () => Math.max(...items.map((i) => i.grossGenerationMWh), 1),
    [items],
  );
  const maxCo2 = useMemo(
    () => Math.max(...items.map((i) => i.co2MassTons), 1),
    [items],
  );

  return (
    <div className="space-y-3.5">
      <div className="border-edge bg-surface/50 space-y-3 rounded-xl border p-3 sm:p-4">
        <div className="border-edge/40 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="border-edge bg-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
              <Clock className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-fg text-sm font-semibold">
                  Temporal Emissions Telemetry
                </span>
                {data?.source === "EPA_CAMPD_API" && !data.error && (
                  <Badge variant="success" className="px-1.5 py-0 text-xs">
                    Live EPA CAMPD
                  </Badge>
                )}
                {data?.source === "LOCAL_RECORDS" && (
                  <Badge variant="outline" className="px-1.5 py-0 text-xs">
                    CEMS Store
                  </Badge>
                )}
                {isFetching && (
                  <RefreshCw className="h-3 w-3 animate-spin text-emerald-400" />
                )}
              </div>
              <p className="text-fg-muted text-xs">
                Filtering stack sensors for {currentPlant.name} across time
                resolutions
                {livePublishedThrough
                  ? ` · EPA published through ${livePublishedThrough}`
                  : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="-mx-1 -my-1 flex scrollbar-none items-center gap-2 overflow-x-auto px-1 py-1 whitespace-nowrap">
          {plants && plants.length > 1 && (
            <Select
              value={String(currentPlant.id)}
              onValueChange={(val) => {
                setActiveFacilityId(Number(val));
                setSelectedUnit("ALL");
              }}
            >
              <SelectTrigger
                sizeVariant="toolbar"
                className="w-[280px] sm:w-[320px]"
              >
                <SelectValue placeholder="Select Facility" />
              </SelectTrigger>
              <SelectContent>
                {plants.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={granularity}
            onValueChange={(val) =>
              setGranularity(
                val as "hourly" | "daily" | "weekly" | "monthly" | "yearly",
              )
            }
          >
            <SelectTrigger sizeVariant="toolbar" className="w-[105px]">
              <SelectValue placeholder="Resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>

          {granularity !== "yearly" && (
            <Select
              value={String(year)}
              onValueChange={(val) => {
                const newYear = Number(val);
                setYear(newYear);
                setDate((prev) =>
                  clampDateToYear(prev, newYear, livePublishedThrough),
                );
              }}
            >
              <SelectTrigger sizeVariant="toolbar" className="w-[82px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearsForPicker.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {currentUnits.length > 0 && (
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger sizeVariant="toolbar" className="w-[150px]">
                <SelectValue placeholder="All Units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Units</SelectItem>
                {currentUnits.map((u) => (
                  <SelectItem key={u.unitId} value={u.unitId}>
                    Unit {u.unitId} {u.primaryFuel ? `(${u.primaryFuel})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(granularity === "hourly" || granularity === "daily") && (
            <Select value={date} onValueChange={setDate}>
              <SelectTrigger
                sizeVariant="toolbar"
                className="w-[155px] sm:w-[160px]"
              >
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {dateOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {summary && items.length > 0 && (
        <KpiStrip columns={4} gapClassName="gap-2.5">
          <StatTile
            label="Total Generation"
            icon={<Zap className="h-3.5 w-3.5 text-sky-400" />}
            value={`${summary.totalGenerationMWh.toLocaleString()} MWh`}
            subtext={`${summary.totalOperatingHours.toLocaleString()} run hours`}
          />
          <StatTile
            label="Carbon Dioxide"
            icon={<Flame className="h-3.5 w-3.5 text-amber-400" />}
            value={`${summary.totalCo2Tons.toLocaleString()} t`}
            subtext={`${summary.totalHeatInputMMBtu.toLocaleString()} MMBtu fuel`}
          />
          <StatTile
            label="Carbon Intensity"
            icon={<Leaf className="h-3.5 w-3.5 text-emerald-400" />}
            value={
              summary.co2IntensityLbsMWh !== null ? (
                <div className="flex items-center gap-2">
                  <span>{summary.co2IntensityLbsMWh.toLocaleString()}</span>
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
            value={
              summary.heatRateMMBtuMWh !== null
                ? `${summary.heatRateMMBtuMWh.toFixed(2)}`
                : "N/A"
            }
            subtext="MMBtu / MWh (Thermal efficiency)"
          />
        </KpiStrip>
      )}

      <DataPanel>
        {isLoading ? (
          <InlineLoading
            size="sm"
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
            <Table className="w-full text-xs">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="border-edge bg-surface/90 border-b backdrop-blur-xs">
                  <TableHead className="h-7 w-28 px-2 py-1 text-left font-sans text-xs">
                    Time Interval
                  </TableHead>
                  <TableHead className="h-7 w-16 px-1.5 py-1 text-right font-sans text-xs">
                    Operating
                  </TableHead>
                  <TableHead className="h-7 w-24 px-1.5 py-1 text-right font-sans text-xs">
                    Generation
                  </TableHead>
                  <TableHead className="h-7 w-20 px-1.5 py-1 text-right font-sans text-xs">
                    Heat Input
                  </TableHead>
                  <TableHead className="h-7 w-20 px-1.5 py-1 text-right font-sans text-xs">
                    CO₂ Mass
                  </TableHead>
                  <TableHead className="h-7 w-12 px-1 py-1 text-right font-sans text-xs">
                    SO₂
                  </TableHead>
                  <TableHead className="h-7 w-12 px-1 py-1 text-right font-sans text-xs">
                    NOₓ
                  </TableHead>
                  <TableHead className="h-7 w-20 px-2 py-1 text-right font-sans text-xs">
                    Intensity
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const genPct = Math.min(
                    100,
                    Math.round((item.grossGenerationMWh / maxGen) * 100),
                  );
                  const co2Pct = Math.min(
                    100,
                    Math.round((item.co2MassTons / maxCo2) * 100),
                  );

                  return (
                    <TableRow
                      key={item.periodKey}
                      className="border-edge/40 hover:bg-surface/40 border-b font-mono text-xs"
                    >
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

                      <TableCell className="px-1.5 py-1 text-right whitespace-nowrap">
                        <span className="text-fg-2">
                          {item.operatingHours.toLocaleString()}
                        </span>
                        <span className="text-fg-muted ml-0.5 text-[10px]">
                          h
                        </span>
                      </TableCell>

                      <TableCell className="px-1.5 py-1 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-fg leading-none font-semibold">
                            {item.grossGenerationMWh.toLocaleString()}
                          </span>
                          <div className="bg-edge/60 mt-0.5 h-1 w-12 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-sky-400"
                              style={{ width: `${genPct}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-fg-2 px-1.5 py-1 text-right whitespace-nowrap">
                        {item.heatInputMMBtu.toLocaleString()}
                      </TableCell>

                      <TableCell className="px-1.5 py-1 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-fg leading-none font-semibold">
                            {item.co2MassTons.toLocaleString()}
                          </span>
                          <div className="bg-edge/60 mt-0.5 h-1 w-12 overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-amber-400"
                              style={{ width: `${co2Pct}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-fg-muted px-1 py-1 text-right font-mono text-[11px] whitespace-nowrap">
                        {item.so2MassTons > 0
                          ? item.so2MassTons.toFixed(1)
                          : "0.0"}
                      </TableCell>

                      <TableCell className="text-fg-muted px-1 py-1 text-right font-mono text-[11px] whitespace-nowrap">
                        {item.noxMassTons > 0
                          ? item.noxMassTons.toFixed(1)
                          : "0.0"}
                      </TableCell>

                      <TableCell className="px-2 py-1 text-right whitespace-nowrap">
                        {item.co2IntensityLbsMWh !== null ? (
                          <span
                            className={
                              item.co2IntensityLbsMWh < 950
                                ? "font-semibold text-emerald-400"
                                : item.co2IntensityLbsMWh < 1600
                                  ? "font-semibold text-amber-400"
                                  : "font-semibold text-rose-400"
                            }
                          >
                            {item.co2IntensityLbsMWh.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-fg-muted">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DataPanel>
    </div>
  );
}
