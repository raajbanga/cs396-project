"use client";

import { Award, Flame, Gauge, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CarbonIntensityBadge } from "~/components/ui/carbon-intensity-badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FuelBadge } from "~/components/ui/fuel-badge";
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
  onRemovePlant?: (id: number) => void;
}

export function PlantComparisonDialog({
  open,
  onOpenChange,
  plants = [],
  isLoading,
  onClearSelection,
  onRemovePlant,
}: PlantComparisonDialogProps) {
  // Identify cleanest plant (lowest direct carbon intensity > 0)
  const cleanestPlant = plants
    .filter(
      (p) => p.carbonIntensityLbsMWh !== null && p.carbonIntensityLbsMWh > 0,
    )
    .sort(
      (a, b) =>
        (a.carbonIntensityLbsMWh ?? 9999) - (b.carbonIntensityLbsMWh ?? 9999),
    )[0];

  // Maximum values for relative comparative bar charts
  const maxCapacity = Math.max(...plants.map((p) => p.totalCapacityMW), 1);
  const maxCo2 = Math.max(...plants.map((p) => p.totalCo2Tons), 1);
  const maxGen = Math.max(...plants.map((p) => p.totalGenerationMWh), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative flex h-[90dvh] max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden p-3.5 sm:h-auto sm:max-h-[90vh] sm:p-6">
        <DialogClose onClose={() => onOpenChange(false)} />

        <DialogHeader className="shrink-0 border-b border-edge pb-3 pr-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-fg-muted">
                Side-by-Side Facility Benchmarking
              </span>
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {plants.length} {plants.length === 1 ? "Plant" : "Plants"}
              </Badge>
            </div>
            <DialogTitle className="mt-1">Plant Comparison Matrix</DialogTitle>
          </div>
        </DialogHeader>

        <div className="mt-2 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="py-24 text-center text-fg-muted">
              <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-emerald-400" />
              <p className="text-sm font-medium text-fg">
                Computing cross-facility metrics...
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                Aggregating generation, emission rates, and environmental controls
              </p>
            </div>
          ) : plants.length < 2 ? (
            <div className="py-16 text-center text-fg-muted">
              <p className="text-sm">
                Please select at least 2 facilities to benchmark side-by-side.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-edge bg-canvas">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                {/* Header Row: Plant Column Summary Cards */}
                <thead>
                  <tr className="border-b border-edge bg-surface/90">
                    <th className="w-44 p-3.5 align-bottom text-[11px] font-semibold tracking-wider text-fg-muted uppercase sm:w-52">
                      Benchmarking Metric
                    </th>
                    {plants.map((plant) => {
                      const isCleanest = cleanestPlant?.id === plant.id;
                      return (
                        <th
                          key={plant.id}
                          className="min-w-[220px] border-l border-edge p-3.5 align-top"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-semibold text-emerald-400">
                                #{plant.id}
                              </span>
                              <div className="flex items-center gap-1">
                                {isCleanest && (
                                  <Badge
                                    variant="success"
                                    className="gap-1 py-0 text-[10px]"
                                  >
                                    <Award className="h-3 w-3" />
                                    Cleanest
                                  </Badge>
                                )}
                                {onRemovePlant && (
                                  <button
                                    type="button"
                                    onClick={() => onRemovePlant(plant.id)}
                                    className="cursor-pointer rounded p-1 text-fg-muted hover:bg-surface-2 hover:text-fg"
                                    title={`Remove ${plant.name} from comparison`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="line-clamp-2 text-sm font-bold text-fg sm:text-base">
                              {plant.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
                              <span>
                                {plant.county ? `${plant.county} Co., ` : ""}
                                {plant.stateCode}
                              </span>
                              {plant.nercRegion && (
                                <>
                                  <span>•</span>
                                  <Badge
                                    variant="sky"
                                    className="px-1.5 py-0 font-mono text-[10px]"
                                  >
                                    {plant.nercRegion}
                                  </Badge>
                                </>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {plant.primaryFuels
                                .filter((f): f is string => Boolean(f))
                                .map((f) => (
                                  <FuelBadge key={f} fuel={f} size="sm" />
                                ))}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-edge/60">
                  {/* Section 1: Fleet & Capacity */}
                  <tr className="bg-surface/50">
                    <td
                      colSpan={plants.length + 1}
                      className="px-3.5 py-2 text-[11px] font-bold tracking-wider text-fg uppercase"
                    >
                      1. Fleet & Capacity
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      Nameplate Capacity
                    </td>
                    {plants.map((p) => (
                      <td key={p.id} className="border-l border-edge/60 p-3.5">
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-bold text-fg">
                            {p.totalCapacityMW > 0
                              ? `${p.totalCapacityMW.toLocaleString()} MW`
                              : "—"}
                          </div>
                          {p.totalCapacityMW > 0 && (
                            <div className="h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-surface-2">
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
                    <td className="p-3.5 font-medium text-fg-2">
                      Active / Total Units
                    </td>
                    {plants.map((p) => (
                      <td key={p.id} className="border-l border-edge/60 p-3.5">
                        <span className="font-semibold text-fg">
                          {p.operatingUnitsCount}
                        </span>
                        <span className="text-fg-muted">
                          {" "}
                          / {p.unitCount} units
                        </span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      Operator / Utility
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-edge/60 p-3.5 text-xs text-fg-2"
                      >
                        {p.ownerOperator ?? "Owner unlisted"}
                      </td>
                    ))}
                  </tr>

                  {/* Section 2: Generation & Emissions */}
                  <tr className="bg-surface/50">
                    <td
                      colSpan={plants.length + 1}
                      className="px-3.5 py-2 text-[11px] font-bold tracking-wider text-fg uppercase"
                    >
                      2. Annual Emissions & Generation (2022)
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      Annual CO₂ Mass
                    </td>
                    {plants.map((p) => (
                      <td key={p.id} className="border-l border-edge/60 p-3.5">
                        <div className="space-y-1">
                          <div className="font-mono text-sm font-semibold text-fg">
                            {p.totalCo2Tons > 0
                              ? `${p.totalCo2Tons.toLocaleString()} t`
                              : "—"}
                          </div>
                          {p.totalCo2Tons > 0 && (
                            <div className="h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-surface-2">
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
                    <td className="p-3.5 font-medium text-fg-2">
                      Gross Generation
                    </td>
                    {plants.map((p) => (
                      <td key={p.id} className="border-l border-edge/60 p-3.5">
                        <div className="space-y-1">
                          <div className="font-mono text-sm text-fg">
                            {p.totalGenerationMWh > 0
                              ? `${p.totalGenerationMWh.toLocaleString()} MWh`
                              : "—"}
                          </div>
                          {p.totalGenerationMWh > 0 && (
                            <div className="h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-sky-400"
                                style={{
                                  width: `${Math.round((p.totalGenerationMWh / maxGen) * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      Dispatch Hours
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-edge/60 p-3.5 font-mono text-xs text-fg-muted"
                      >
                        {p.totalOperatingHours > 0
                          ? `${p.totalOperatingHours.toLocaleString()} hrs`
                          : "—"}
                      </td>
                    ))}
                  </tr>

                  {/* Section 3: Efficiency & Controls */}
                  <tr className="bg-surface/50">
                    <td
                      colSpan={plants.length + 1}
                      className="px-3.5 py-2 text-[11px] font-bold tracking-wider text-fg uppercase"
                    >
                      3. Efficiency & Air Quality Controls
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      <div className="flex items-center gap-1">
                        <span>Carbon Intensity</span>
                        <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                    </td>
                    {plants.map((p) => (
                      <td key={p.id} className="border-l border-edge/60 p-3.5">
                        <CarbonIntensityBadge
                          intensity={p.carbonIntensityLbsMWh}
                          showValue
                        />
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      <div className="flex items-center gap-1">
                        <span>Thermal Heat Rate</span>
                        <Flame className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                    </td>
                    {plants.map((p) => (
                      <td key={p.id} className="border-l border-edge/60 p-3.5">
                        {p.heatRateMMBtuMWh ? (
                          <div className="space-y-0.5">
                            <div className="font-mono text-xs font-semibold text-fg">
                              {p.heatRateMMBtuMWh.toFixed(2)} MMBtu/MWh
                            </div>
                            <span className="text-[10px] text-fg-muted">
                              {p.heatRateMMBtuMWh < 8.0
                                ? "High CCGT efficiency"
                                : p.heatRateMMBtuMWh < 12.0
                                  ? "Standard efficiency"
                                  : "Subcritical thermal"}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-fg-muted">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      SO₂ Scrubbers
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-edge/60 p-3.5 text-xs"
                      >
                        <span className="font-semibold text-fg">
                          {p.so2ControlledUnits} of {p.unitCount}
                        </span>
                        <span className="text-fg-muted"> units scrubbed</span>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="p-3.5 font-medium text-fg-2">
                      NOx Catalytic SCR/SNCR
                    </td>
                    {plants.map((p) => (
                      <td
                        key={p.id}
                        className="border-l border-edge/60 p-3.5 text-xs"
                      >
                        <span className="font-semibold text-fg">
                          {p.noxControlledUnits} of {p.unitCount}
                        </span>
                        <span className="text-fg-muted"> units controlled</span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter className="mt-auto flex-col items-stretch justify-between gap-2 border-t border-edge pt-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClearSelection}
            className="cursor-pointer py-1 text-center text-xs text-fg-muted underline transition-colors hover:text-fg sm:text-left"
          >
            Clear comparison selection ({plants.length} plants)
          </button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 font-medium"
          >
            Close Comparison
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
