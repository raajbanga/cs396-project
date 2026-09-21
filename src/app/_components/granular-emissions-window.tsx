"use client";

import { useMemo, useState } from "react";
import { Clock, Flame, Gauge, Leaf, RefreshCw, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { CarbonIntensityBadge } from "~/components/ui/carbon-intensity-badge";
import { Input } from "~/components/ui/input";
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
  availableYears = [2022, 2021, 2020],
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

  const plantYears = currentPlant.availableYears ?? availableYears;
  const defaultYear = plantYears.length > 0 ? Math.max(...plantYears) : 2022;

  const [year, setYear] = useState<number>(defaultYear);
  const [date, setDate] = useState<string>(`${defaultYear}-07-15`);
  const [selectedUnit, setSelectedUnit] = useState<string>("ALL");

  const currentUnits = currentPlant.units ?? units;

  // Directly leverage existing tRPC query hook (DRY codebase principle - zero custom hooks)
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
      {/* Control Header & Dropdowns Toolbar */}
      <div className="border-edge bg-surface/50 space-y-3 rounded-xl border p-3 sm:p-4">
        {/* Title and Telemetry Source */}
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
                {data?.source === "EPA_CAMPD_API" && (
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
              </p>
            </div>
          </div>
        </div>

        {/* Dedicated Single-Line Dropdowns Toolbar: all dropdowns strictly stay on the same line with padding to prevent focus border clipping */}
        <div className="-mx-1 -my-1 flex scrollbar-none items-center gap-2 overflow-x-auto px-1 py-1 whitespace-nowrap">
          {/* Facility Selector (Comparison mode) - widened so long plant names like 48th Street Peaking Station are not clipped */}
          {plants && plants.length > 1 && (
            <Select
              value={String(currentPlant.id)}
              onValueChange={(val) => {
                setActiveFacilityId(Number(val));
                setSelectedUnit("ALL");
              }}
            >
              <SelectTrigger className="border-edge bg-surface/60 h-9 w-[280px] shrink-0 text-xs sm:w-[320px] sm:text-sm">
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

          {/* 1. Time Granularity Dropdown (Clean, without redundant indicators like 52w) */}
          <Select
            value={granularity}
            onValueChange={(val) =>
              setGranularity(
                val as "hourly" | "daily" | "weekly" | "monthly" | "yearly",
              )
            }
          >
            <SelectTrigger className="border-edge bg-surface/60 h-9 w-[105px] shrink-0 text-xs sm:text-sm">
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

          {/* 2. Reporting Year Dropdown (Displays selected year number cleanly) */}
          {granularity !== "yearly" && (
            <Select
              value={String(year)}
              onValueChange={(val) => {
                const newYear = Number(val);
                setYear(newYear);
                if (granularity === "hourly" || granularity === "daily") {
                  setDate(`${newYear}-07-15`);
                }
              }}
            >
              <SelectTrigger className="border-edge bg-surface/60 h-9 w-[82px] shrink-0 text-xs sm:text-sm">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {plantYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 3. Generator Unit Filter Dropdown */}
          {currentUnits.length > 0 && (
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="border-edge bg-surface/60 h-9 w-[150px] shrink-0 text-xs sm:text-sm">
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

          {/* 4. Date Picker for Hourly or Daily Granularity */}
          {(granularity === "hourly" || granularity === "daily") && (
            <div className="flex shrink-0 items-center">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border-edge bg-surface/60 h-9 w-[155px] px-2.5 text-xs [color-scheme:dark] sm:w-[160px] sm:text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      {summary && items.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
        </div>
      )}

      {/* Granular Breakdown Table with table-fixed layout, balanced column widths, and zero empty void */}
      <div className="border-edge bg-canvas overflow-hidden rounded-xl border">
        {isLoading ? (
          <div className="text-fg-muted py-14 text-center">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
            <p className="text-xs sm:text-sm">
              Retrieving {granularity} continuous monitoring data...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-fg-muted p-8 text-center text-xs">
            No stack telemetry returned by EPA CAMPD for this specific facility
            and time window.
          </div>
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
                      {/* Interval Label */}
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

                      {/* Operating Hours */}
                      <TableCell className="px-1.5 py-1 text-right whitespace-nowrap">
                        <span className="text-fg-2">
                          {item.operatingHours.toLocaleString()}
                        </span>
                        <span className="text-fg-muted ml-0.5 text-[10px]">
                          h
                        </span>
                      </TableCell>

                      {/* Generation + compact mini bar */}
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

                      {/* Heat Input */}
                      <TableCell className="text-fg-2 px-1.5 py-1 text-right whitespace-nowrap">
                        {item.heatInputMMBtu.toLocaleString()}
                      </TableCell>

                      {/* CO2 Mass + compact mini bar */}
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

                      {/* SO2 */}
                      <TableCell className="text-fg-muted px-1 py-1 text-right font-mono text-[11px] whitespace-nowrap">
                        {item.so2MassTons > 0
                          ? item.so2MassTons.toFixed(1)
                          : "0.0"}
                      </TableCell>

                      {/* NOx */}
                      <TableCell className="text-fg-muted px-1 py-1 text-right font-mono text-[11px] whitespace-nowrap">
                        {item.noxMassTons > 0
                          ? item.noxMassTons.toFixed(1)
                          : "0.0"}
                      </TableCell>

                      {/* Intensity */}
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
      </div>
    </div>
  );
}
