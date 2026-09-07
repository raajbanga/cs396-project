"use client";

import { Award, Flame, Gauge, RefreshCw, X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getCarbonIntensityTier } from "~/lib/plant-narrative";
import { getFuelTheme } from "~/lib/map-utils";
import { type RouterOutputs } from "~/trpc/react";

export type ComparedPlant =
  RouterOutputs["facilities"]["compareFacilities"][number];

interface PlantComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compareIds?: number[];
  plants?: ComparedPlant[];
  isLoading: boolean;
  onClearSelection: () => void;
}

export function PlantComparisonDialog({
  open,
  onOpenChange,
  plants = [],
  isLoading,
  onClearSelection,
}: PlantComparisonDialogProps) {
  // Find plant with lowest carbon intensity (cleanest)
  const cleanestPlant = plants
    .filter(
      (p) => p.carbonIntensityLbsMWh !== null && p.carbonIntensityLbsMWh > 0,
    )
    .sort(
      (a, b) =>
        (a.carbonIntensityLbsMWh ?? 9999) - (b.carbonIntensityLbsMWh ?? 9999),
    )[0];

  // Find max capacity for relative visual bars
  const maxCapacity = Math.max(...plants.map((p) => p.totalCapacityMW), 1);
  const maxCo2 = Math.max(...plants.map((p) => p.totalCo2Tons), 1);

  const getCarbonIntensityBadge = (intensity: number | null) => {
    if (intensity === null || intensity === 0) {
      return <span className="font-mono text-zinc-500">—</span>;
    }
    const tier = getCarbonIntensityTier(intensity);

    return (
      <div className="space-y-1">
        <div className="font-mono text-sm font-bold text-zinc-100">
          {intensity.toLocaleString()}{" "}
          <span className="text-[11px] font-normal text-zinc-400">lbs/MWh</span>
        </div>
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${tier.badgeClass}`}
        >
          {tier.label}
        </span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative flex h-[90dvh] max-h-[90dvh] sm:h-auto sm:max-h-[90vh] w-full max-w-5xl flex-col p-3.5 sm:p-6 overflow-hidden">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3.5 top-3.5 sm:right-5 sm:top-5 z-10 flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader className="shrink-0 border-b border-zinc-800 pb-3 pr-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">
                Comparing {plants.length} Facilities
              </span>
            </div>
            <DialogTitle className="text-lg font-bold text-white sm:text-xl">
              Plant Benchmarking Matrix
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-2 flex-1 min-h-0 space-y-4 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-24 text-center text-zinc-400">
              <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-emerald-400" />
              <p className="text-sm font-medium text-zinc-300">
                Computing comparative cross-fleet metrics...
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Aggregating generation, thermodynamic heat rates, and
                environmental controls
              </p>
            </div>
          ) : plants.length < 2 ? (
            <div className="py-16 text-center text-zinc-400">
              <p className="text-sm">
                Please select at least 2 facilities to compare.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80">
              <table className="w-full border-collapse text-left text-xs">
                {/* Header Row: Plant Cards */}
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/90">
                    <th className="w-48 p-4 align-bottom text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
                      Benchmarking Attribute
                    </th>
                    {plants.map((plant) => {
                      const isCleanest = cleanestPlant?.id === plant.id;
                      return (
                        <th
                          key={plant.id}
                          className="min-w-[240px] border-l border-zinc-800 p-4 align-top"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-semibold text-emerald-400">
                                ORISPL #{plant.id}
                              </span>
                              {isCleanest && (
                                <Badge
                                  variant="success"
                                  className="gap-1 py-0 text-[10px]"
                                >
                                  <Award className="h-3 w-3" />
                                  Cleanest
                                </Badge>
                              )}
                            </div>
                            <div className="line-clamp-2 text-sm font-bold text-white">
                              {plant.name}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {plant.county ? `${plant.county} Co., ` : ""}
                              {plant.stateCode}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800/60">
                  {/* Category 1: Grid & Reliability Profile */}
                  <tr className="bg-zinc-900/40">
                    <td
                      colSpan={plants.length + 1}
                      className="px-4 py-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                    >
                      1. Grid & Reliability Profile
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      NERC Grid Council
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        <Badge variant="sky" className="font-mono text-[10px]">
                          {p.nercRegion ?? "Unassigned"}
                        </Badge>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Source Category
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5 text-zinc-200"
                      >
                        {p.sourceCategory ?? "Unspecified"}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Owner / Utility Operator
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5 text-zinc-300"
                      >
                        {p.ownerOperator ?? "Owner unlisted"}
                      </td>
                    ))}
                  </tr>

                  {/* Category 2: Generation Fleet & Scale */}
                  <tr className="bg-zinc-900/40">
                    <td
                      colSpan={plants.length + 1}
                      className="px-4 py-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                    >
                      2. Generation Fleet & Capacity
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Nameplate Capacity (MW)
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-bold text-zinc-100">
                            {p.totalCapacityMW > 0
                              ? `${p.totalCapacityMW.toLocaleString()} MW`
                              : "—"}
                          </div>
                          {p.totalCapacityMW > 0 && (
                            <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-amber-400"
                                style={{
                                  width: `${Math.round((p.totalCapacityMW / maxCapacity) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Units (Active / Total)
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        <span className="font-semibold text-zinc-200">
                          {p.operatingUnitsCount}
                        </span>
                        <span className="text-zinc-500">
                          {" "}
                          / {p.unitCount} units
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Primary Fuel Types
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        <div className="flex flex-wrap gap-1">
                          {p.primaryFuels
                            .filter((f): f is string => Boolean(f))
                            .map((f) => (
                              <Badge
                                key={f}
                                variant={getFuelTheme(f).variant}
                                className="text-[10px]"
                              >
                                {f}
                              </Badge>
                            ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Category 3: Annual Emissions & Production (2022) */}
                  <tr className="bg-zinc-900/40">
                    <td
                      colSpan={plants.length + 1}
                      className="px-4 py-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                    >
                      3. Emissions Footprint (2022 CAMPD)
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Gross CO2 Mass (Tons)
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-semibold text-zinc-100">
                            {p.totalCo2Tons > 0
                              ? `${p.totalCo2Tons.toLocaleString()} t`
                              : "—"}
                          </div>
                          {p.totalCo2Tons > 0 && (
                            <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{
                                  width: `${Math.round((p.totalCo2Tons / maxCo2) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Gross Generation (MWh)
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5 font-mono text-zinc-200"
                      >
                        {p.totalGenerationMWh > 0
                          ? `${p.totalGenerationMWh.toLocaleString()} MWh`
                          : "—"}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      Operating Hours
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5 font-mono text-zinc-300"
                      >
                        {p.totalOperatingHours > 0
                          ? `${p.totalOperatingHours.toLocaleString()} hrs`
                          : "—"}
                      </td>
                    ))}
                  </tr>

                  {/* Category 4: Thermodynamic Efficiency & Carbon Intensity */}
                  <tr className="bg-zinc-900/40">
                    <td
                      colSpan={plants.length + 1}
                      className="px-4 py-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                    >
                      4. Efficiency & Intensity Benchmarks
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      <div className="flex items-center gap-1">
                        <span>Carbon Intensity</span>
                        <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <span className="text-[10px] font-normal text-zinc-500">
                        lbs CO2 / MWh produced
                      </span>
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        {getCarbonIntensityBadge(p.carbonIntensityLbsMWh)}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      <div className="flex items-center gap-1">
                        <span>Heat Rate</span>
                        <Flame className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                      <span className="text-[10px] font-normal text-zinc-500">
                        MMBtu / MWh (Thermal efficiency)
                      </span>
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        {p.heatRateMMBtuMWh ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-sm font-semibold text-zinc-200">
                              {p.heatRateMMBtuMWh.toFixed(2)}{" "}
                              <span className="text-[10px] text-zinc-400">
                                MMBtu/MWh
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500">
                              {p.heatRateMMBtuMWh < 8.0
                                ? "High CCGT efficiency"
                                : p.heatRateMMBtuMWh < 12.0
                                  ? "Standard thermal efficiency"
                                  : "Subcritical / Low efficiency"}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-zinc-500">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Category 5: Environmental Controls Matrix */}
                  <tr className="bg-zinc-900/40">
                    <td
                      colSpan={plants.length + 1}
                      className="px-4 py-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                    >
                      5. Air Quality Control Systems
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      SO2 Control Coverage
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        <span className="font-semibold text-zinc-200">
                          {p.so2ControlledUnits} of {p.unitCount}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {" "}
                          units with scrubbers
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-zinc-400">
                      NOx Control Coverage
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-zinc-800/60 p-3.5"
                      >
                        <span className="font-semibold text-zinc-200">
                          {p.noxControlledUnits} of {p.unitCount}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {" "}
                          units with SCR/SNCR
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 mt-auto flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-zinc-800 pt-3">
          <button
            type="button"
            onClick={onClearSelection}
            className="cursor-pointer text-xs text-zinc-400 underline hover:text-zinc-200 text-center sm:text-left py-1"
          >
            Clear comparison selection ({plants.length} plants)
          </button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs sm:text-sm font-medium"
          >
            Close Benchmarking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
