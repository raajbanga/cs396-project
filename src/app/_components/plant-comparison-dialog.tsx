"use client";

import { useState } from "react";
import {
  Activity,
  Award,
  ExternalLink,
  Flame,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
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
import { MetricBar } from "~/components/ui/metric-bar";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { StatTile } from "~/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { pickCleanestByCarbonIntensity } from "~/lib/emissions-metrics";
import { cleanOwnerOperator, formatCountyShort } from "~/lib/plant-narrative";
import { type RouterOutputs } from "~/trpc/react";

type ComparedPlant = RouterOutputs["facilities"]["compareFacilities"][number];

interface PlantComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plants?: ComparedPlant[];
  isLoading: boolean;
  onClearSelection: () => void;
  onRemovePlant?: (id: number) => void;
  onInspectPlant?: (id: number) => void;
}

function SectionRow({ title, colSpan }: { title: string; colSpan: number }) {
  return (
    <TableRow className="bg-surface/50 hover:bg-surface/50">
      <TableCell
        colSpan={colSpan}
        className="text-fg px-3.5 py-2 text-xs font-semibold tracking-wider uppercase"
      >
        {title}
      </TableCell>
    </TableRow>
  );
}

function MetricRow({
  label,
  plants,
  renderCell,
}: {
  label: React.ReactNode;
  plants: ComparedPlant[];
  renderCell: (plant: ComparedPlant) => React.ReactNode;
}) {
  return (
    <TableRow className="hover:bg-surface/40">
      <TableCell className="text-fg-2 p-3.5 font-medium">{label}</TableCell>
      {plants.map((p) => (
        <TableCell key={p.id} className="border-edge/60 border-l p-3.5">
          {renderCell(p)}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function PlantComparisonDialog({
  open,
  onOpenChange,
  plants = [],
  isLoading,
  onClearSelection,
  onRemovePlant,
  onInspectPlant,
}: PlantComparisonDialogProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "emissions" | "fleet"
  >("overview");

  // Benchmarking aggregate calculations
  const totalJointCapacity = plants.reduce(
    (sum, p) => sum + p.totalCapacityMW,
    0,
  );
  const totalJointGeneration = plants.reduce(
    (sum, p) => sum + p.totalGenerationMWh,
    0,
  );
  const totalJointCo2 = plants.reduce((sum, p) => sum + p.totalCo2Tons, 0);

  const cleanestPlant = pickCleanestByCarbonIntensity(plants);

  // Largest capacity plant
  const largestPlant = [...plants].sort(
    (a, b) => b.totalCapacityMW - a.totalCapacityMW,
  )[0];

  // Highest generation plant
  const highestGenPlant = [...plants].sort(
    (a, b) => b.totalGenerationMWh - a.totalGenerationMWh,
  )[0];

  // Total scrubbed units across all plants
  const totalUnits = plants.reduce((sum, p) => sum + p.unitCount, 0);
  const totalScrubbed = plants.reduce(
    (sum, p) => sum + p.controlledUnitsCount,
    0,
  );
  const controlCoveragePct =
    totalUnits > 0 ? Math.round((totalScrubbed / totalUnits) * 100) : 0;

  // Relative max values for visual bars
  const maxCapacity = Math.max(...plants.map((p) => p.totalCapacityMW), 1);
  const maxGen = Math.max(...plants.map((p) => p.totalGenerationMWh), 1);
  const maxCo2 = Math.max(...plants.map((p) => p.totalCo2Tons), 1);
  const maxSo2 = Math.max(...plants.map((p) => p.totalSo2Tons), 1);
  const maxNox = Math.max(...plants.map((p) => p.totalNoxTons), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative flex h-[90dvh] max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden p-3.5 sm:h-auto sm:max-h-[90vh] sm:p-6">
        <DialogClose onClose={() => onOpenChange(false)} />

        {/* Dialog Header */}
        <DialogHeader className="border-edge shrink-0 border-b pr-10 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-emerald-400">
                BENCHMARK MATRIX
              </span>
              <Badge variant="outline" className="font-mono text-xs">
                {plants.length}{" "}
                {plants.length === 1 ? "Facility" : "Facilities"} Selected
              </Badge>
              {cleanestPlant && (
                <Badge variant="success" className="gap-1">
                  <Award className="h-3 w-3" />
                  Cleanest: {cleanestPlant.name}
                </Badge>
              )}
            </div>

            <DialogTitle className="mt-1 text-lg sm:text-xl">
              Cross-Facility Comparative Benchmark
            </DialogTitle>

            <p className="text-fg-muted mt-0.5 text-xs">
              Side-by-side performance audit across grid reliability,
              thermodynamic capacity, and emission rates.
            </p>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="-mr-1 min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
          {isLoading ? (
            <div className="text-fg-muted py-24 text-center">
              <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-emerald-400" />
              <p className="text-fg text-sm font-medium">
                Computing comparative cross-facility metrics...
              </p>
              <p className="text-fg-muted mt-1 text-xs">
                Aggregating generation, emission intensity, and environmental
                controls
              </p>
            </div>
          ) : plants.length < 2 ? (
            <div className="text-fg-muted py-20 text-center">
              <p className="text-fg text-sm font-medium">
                Select at least 2 facilities to benchmark side-by-side.
              </p>
              <p className="text-fg-muted mt-1 text-xs">
                Use the comparison checkboxes in the facilities table to add up
                to 4 plants.
              </p>
            </div>
          ) : (
            <>
              {/* Top 5 Key Benchmarking KPI Strip */}
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5 sm:gap-2.5">
                <StatTile
                  label="Cleanest Plant"
                  icon={<Award className="h-3.5 w-3.5 text-emerald-400" />}
                  value={
                    cleanestPlant ? (
                      <span className="block max-w-[120px] truncate text-emerald-400">
                        {cleanestPlant.name}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                  subtext={
                    cleanestPlant?.carbonIntensityLbsMWh != null
                      ? cleanestPlant.carbonIntensityLbsMWh === 0
                        ? "Zero stack CO₂"
                        : `${cleanestPlant.carbonIntensityLbsMWh.toLocaleString()} lbs/MWh`
                      : "—"
                  }
                />

                <StatTile
                  label="Joint Capacity"
                  icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
                  value={
                    totalJointCapacity > 0
                      ? `${Math.round(totalJointCapacity).toLocaleString()} MW`
                      : "—"
                  }
                  subtext={`${totalUnits} combined units`}
                />

                <StatTile
                  label="Joint Generation"
                  icon={<Activity className="h-3.5 w-3.5 text-sky-400" />}
                  value={
                    totalJointGeneration > 0
                      ? `${Math.round(totalJointGeneration).toLocaleString()} MWh`
                      : "—"
                  }
                  subtext="Annual grid supply"
                />

                <StatTile
                  label="Joint CO₂ Mass"
                  icon={<Flame className="h-3.5 w-3.5 text-rose-400" />}
                  value={
                    totalJointCo2 > 0
                      ? `${Math.round(totalJointCo2).toLocaleString()} t`
                      : "0 t"
                  }
                  subtext="Total direct stack output"
                />

                <StatTile
                  label="Control Coverage"
                  icon={
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  }
                  value={`${controlCoveragePct}%`}
                  subtext={`${totalScrubbed}/${totalUnits} units scrubbed`}
                  className="col-span-2 sm:col-span-1"
                />
              </div>

              <SegmentedControl
                variant="tabs"
                value={activeTab}
                onChange={setActiveTab}
                options={[
                  { value: "overview", label: "Overview Matrix" },
                  { value: "emissions", label: "Emissions & Air Quality" },
                  { value: "fleet", label: "Fleet & Generation Units" },
                ]}
              />

              {/* Benchmark Table Container */}
              <div className="border-edge bg-canvas overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-edge bg-surface/80 border-b">
                      <TableHead className="text-fg-muted w-48 align-bottom text-xs font-medium tracking-wider uppercase sm:w-56">
                        Benchmarking Metric
                      </TableHead>
                      {plants.map((plant) => {
                        const isCleanest = cleanestPlant?.id === plant.id;
                        return (
                          <TableHead
                            key={plant.id}
                            className="border-edge min-w-[220px] border-l p-3.5 align-top"
                          >
                            <div className="space-y-2">
                              {/* Header Meta: ID & Actions */}
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-xs font-medium text-emerald-400">
                                  #{plant.id}
                                </span>
                                <div className="flex items-center gap-1">
                                  {isCleanest && (
                                    <Badge
                                      variant="success"
                                      className="gap-1 py-0 text-xs"
                                    >
                                      <Award className="h-3 w-3" />
                                      Cleanest
                                    </Badge>
                                  )}
                                  {onInspectPlant && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onInspectPlant(plant.id)}
                                      className="h-6 gap-1 px-2 text-xs font-medium"
                                      title={`View full dossier for ${plant.name}`}
                                    >
                                      <span>Dossier</span>
                                      <ExternalLink className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                  {onRemovePlant && (
                                    <button
                                      type="button"
                                      onClick={() => onRemovePlant(plant.id)}
                                      className="text-fg-muted hover:bg-surface-2 hover:text-fg cursor-pointer rounded p-1 transition-colors"
                                      title={`Remove ${plant.name} from comparison`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Plant Name */}
                              <div className="text-fg line-clamp-2 text-sm font-semibold sm:text-base">
                                {plant.name}
                              </div>

                              {/* Location & NERC */}
                              <div className="text-fg-muted flex items-center gap-1.5 text-xs">
                                <span>
                                  {plant.county
                                    ? `${formatCountyShort(plant.county)}, `
                                    : ""}
                                  {plant.stateCode}
                                </span>
                                {plant.nercRegion && (
                                  <>
                                    <span>•</span>
                                    <Badge
                                      variant="sky"
                                      className="px-1.5 py-0 font-mono text-xs"
                                    >
                                      {plant.nercRegion}
                                    </Badge>
                                  </>
                                )}
                              </div>

                              {/* Fuel Badges */}
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {plant.primaryFuels
                                  .filter((f): f is string => Boolean(f))
                                  .map((f) => (
                                    <FuelBadge key={f} fuel={f} />
                                  ))}
                              </div>
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {/* ──────────────── TAB 1: OVERVIEW MATRIX ──────────────── */}
                    {activeTab === "overview" && (
                      <>
                        <SectionRow
                          title="1. Operational Capacity & Grid Delivery"
                          colSpan={plants.length + 1}
                        />

                        <MetricRow
                          label="Nameplate Capacity"
                          plants={plants}
                          renderCell={(p) => (
                            <MetricBar
                              value={
                                p.totalCapacityMW > 0
                                  ? `${p.totalCapacityMW.toLocaleString()} MW`
                                  : "—"
                              }
                              percentage={
                                maxCapacity > 0
                                  ? Math.round(
                                      (p.totalCapacityMW / maxCapacity) * 100,
                                    )
                                  : 0
                              }
                              color="amber"
                              isLeader={
                                p.id === largestPlant?.id &&
                                p.totalCapacityMW > 0
                              }
                              leaderLabel="Largest"
                            />
                          )}
                        />

                        <MetricRow
                          label="Net Generation"
                          plants={plants}
                          renderCell={(p) => (
                            <MetricBar
                              value={
                                p.totalGenerationMWh > 0
                                  ? `${p.totalGenerationMWh.toLocaleString()} MWh`
                                  : "—"
                              }
                              percentage={
                                maxGen > 0
                                  ? Math.round(
                                      (p.totalGenerationMWh / maxGen) * 100,
                                    )
                                  : 0
                              }
                              color="sky"
                              isLeader={
                                p.id === highestGenPlant?.id &&
                                p.totalGenerationMWh > 0
                              }
                              leaderLabel="Top Gen"
                            />
                          )}
                        />

                        <MetricRow
                          label="Annual Dispatch Hours"
                          plants={plants}
                          renderCell={(p) => (
                            <span className="text-fg-2 font-mono text-xs">
                              {p.totalOperatingHours > 0
                                ? `${p.totalOperatingHours.toLocaleString()} hrs`
                                : "—"}
                            </span>
                          )}
                        />

                        <MetricRow
                          label="Capacity Factor"
                          plants={plants}
                          renderCell={(p) => {
                            const capFactor =
                              p.totalCapacityMW > 0 && p.totalGenerationMWh > 0
                                ? Math.min(
                                    100,
                                    Math.round(
                                      (p.totalGenerationMWh /
                                        (p.totalCapacityMW * 8760)) *
                                        100,
                                    ),
                                  )
                                : null;
                            return capFactor !== null ? (
                              <div className="space-y-1">
                                <span className="text-fg font-mono text-xs font-semibold">
                                  {capFactor}%
                                </span>
                                <div className="bg-surface-2 h-1 w-24 overflow-hidden rounded-full">
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${capFactor}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-fg-muted font-mono text-xs">
                                —
                              </span>
                            );
                          }}
                        />

                        <SectionRow
                          title="2. Thermodynamic & Carbon Intensity"
                          colSpan={plants.length + 1}
                        />

                        <MetricRow
                          label={
                            <div className="flex items-center gap-1">
                              <span>Carbon Intensity</span>
                              <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                          }
                          plants={plants}
                          renderCell={(p) => (
                            <CarbonIntensityBadge
                              intensity={p.carbonIntensityLbsMWh}
                              showValue
                            />
                          )}
                        />

                        <MetricRow
                          label={
                            <div className="flex items-center gap-1">
                              <span>Heat Rate Efficiency</span>
                              <Flame className="h-3.5 w-3.5 text-amber-400" />
                            </div>
                          }
                          plants={plants}
                          renderCell={(p) =>
                            p.heatRateMMBtuMWh ? (
                              <div className="space-y-0.5">
                                <div className="text-fg font-mono text-xs font-semibold">
                                  {p.heatRateMMBtuMWh.toFixed(2)} MMBtu/MWh
                                </div>
                                <span className="text-fg-muted text-xs">
                                  {p.heatRateMMBtuMWh < 8.0
                                    ? "High CCGT efficiency"
                                    : p.heatRateMMBtuMWh < 12.0
                                      ? "Standard steam rankine"
                                      : "Subcritical thermal"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-fg-muted font-mono text-xs">
                                —
                              </span>
                            )
                          }
                        />
                      </>
                    )}

                    {/* ───────────── TAB 2: EMISSIONS & AIR QUALITY ───────────── */}
                    {activeTab === "emissions" && (
                      <>
                        <SectionRow
                          title="1. Direct Stack Pollutant Mass"
                          colSpan={plants.length + 1}
                        />

                        <MetricRow
                          label="Annual CO₂ Mass"
                          plants={plants}
                          renderCell={(p) => (
                            <MetricBar
                              value={
                                p.totalCo2Tons > 0
                                  ? `${p.totalCo2Tons.toLocaleString()} t`
                                  : "0 t"
                              }
                              percentage={
                                maxCo2 > 0
                                  ? Math.round((p.totalCo2Tons / maxCo2) * 100)
                                  : 0
                              }
                              color="rose"
                            />
                          )}
                        />

                        <MetricRow
                          label="Annual SO₂ Mass"
                          plants={plants}
                          renderCell={(p) => (
                            <MetricBar
                              value={
                                p.totalSo2Tons > 0
                                  ? `${p.totalSo2Tons.toLocaleString()} t`
                                  : "0 t"
                              }
                              percentage={
                                maxSo2 > 0
                                  ? Math.round((p.totalSo2Tons / maxSo2) * 100)
                                  : 0
                              }
                              color="amber"
                            />
                          )}
                        />

                        <MetricRow
                          label="Annual NOₓ Mass"
                          plants={plants}
                          renderCell={(p) => (
                            <MetricBar
                              value={
                                p.totalNoxTons > 0
                                  ? `${p.totalNoxTons.toLocaleString()} t`
                                  : "0 t"
                              }
                              percentage={
                                maxNox > 0
                                  ? Math.round((p.totalNoxTons / maxNox) * 100)
                                  : 0
                              }
                              color="amber"
                            />
                          )}
                        />

                        <SectionRow
                          title="2. Clean Air Quality & Abatement Controls"
                          colSpan={plants.length + 1}
                        />

                        {(
                          [
                            {
                              label: "SO₂ Scrubbers (FGD)",
                              countFn: (p: ComparedPlant) =>
                                p.so2ControlledUnits,
                              color: "bg-emerald-500",
                            },
                            {
                              label: "NOₓ Catalytic Controls (SCR/SNCR)",
                              countFn: (p: ComparedPlant) =>
                                p.noxControlledUnits,
                              color: "bg-sky-500",
                            },
                            {
                              label: "Particulate Controls (ESP/Baghouses)",
                              countFn: (p: ComparedPlant) =>
                                p.pmControlledUnits,
                              color: "bg-amber-500",
                            },
                          ] as const
                        ).map((ctrl) => (
                          <MetricRow
                            key={ctrl.label}
                            label={ctrl.label}
                            plants={plants}
                            renderCell={(p) => {
                              const count = ctrl.countFn(p);
                              const pct =
                                p.unitCount > 0
                                  ? Math.round((count / p.unitCount) * 100)
                                  : 0;
                              return (
                                <div className="space-y-1">
                                  <div className="text-fg flex items-center gap-1.5 text-xs font-semibold">
                                    <span>
                                      {count} of {p.unitCount} units
                                    </span>
                                    <span className="text-fg-muted">
                                      ({pct}%)
                                    </span>
                                  </div>
                                  <div className="bg-surface-2 h-1 w-24 overflow-hidden rounded-full">
                                    <div
                                      className={`h-full rounded-full ${ctrl.color}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            }}
                          />
                        ))}
                      </>
                    )}

                    {/* ────────────── TAB 3: FLEET & TECHNOLOGY ───────────── */}
                    {activeTab === "fleet" && (
                      <>
                        <SectionRow
                          title="1. Generation Units & Status"
                          colSpan={plants.length + 1}
                        />

                        <MetricRow
                          label="Operating vs Total Units"
                          plants={plants}
                          renderCell={(p) => (
                            <span className="text-xs">
                              <strong className="text-fg font-semibold">
                                {p.operatingUnitsCount}
                              </strong>
                              <span className="text-fg-muted">
                                {" "}
                                / {p.unitCount} total units
                              </span>
                            </span>
                          )}
                        />

                        <MetricRow
                          label="Fuel Portfolio"
                          plants={plants}
                          renderCell={(p) => (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap gap-1">
                                {p.primaryFuels.map((f) => (
                                  <FuelBadge key={f} fuel={f} />
                                ))}
                              </div>
                              {p.secondaryFuels.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {p.secondaryFuels.map((sf) => (
                                    <Badge key={sf} variant="secondary">
                                      Backup: {sf}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        />

                        <MetricRow
                          label="Owner / Operator"
                          plants={plants}
                          renderCell={(p) => (
                            <span className="text-fg-2 text-sm">
                              {cleanOwnerOperator(p.ownerOperator)}
                            </span>
                          )}
                        />

                        <MetricRow
                          label="EPA Source Category"
                          plants={plants}
                          renderCell={(p) => (
                            <Badge variant="outline">{p.sourceCategory}</Badge>
                          )}
                        />

                        <SectionRow
                          title="2. Unit-Level Roster Comparison"
                          colSpan={plants.length + 1}
                        />

                        <MetricRow
                          label="Generator Units"
                          plants={plants}
                          renderCell={(p) => (
                            <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                              {p.units?.map((u) => (
                                <div
                                  key={u.id}
                                  className="border-edge/60 bg-surface/60 flex items-center justify-between rounded-md border px-2 py-1 text-sm"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-medium text-emerald-400">
                                      #{u.unitId}
                                    </span>
                                    <span className="text-fg-muted text-sm">
                                      {u.unitType ?? "Combustion"}
                                    </span>
                                  </div>
                                  <span className="text-fg font-mono text-sm font-medium">
                                    {u.nameplateCapacityMW
                                      ? `${u.nameplateCapacityMW} MW`
                                      : "—"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        />
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-edge mt-auto flex-col items-stretch justify-between gap-2 border-t pt-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClearSelection}
            className="text-fg-muted hover:text-fg cursor-pointer py-1 text-center text-xs underline transition-colors sm:text-left"
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
