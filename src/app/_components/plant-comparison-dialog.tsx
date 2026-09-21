"use client";

import { useState } from "react";
import { Activity, Award, Flame, ShieldCheck, Zap } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DialogTitle } from "~/components/ui/dialog";
import { EmptyState } from "~/components/ui/empty-state";
import { KpiStrip } from "~/components/ui/kpi-strip";
import { StatTile } from "~/components/ui/stat-tile";
import { pickCleanestByCarbonIntensity } from "~/lib/emissions-metrics";
import { GranularEmissionsWindow } from "./granular-emissions-window";
import { PlantCompareMatrix } from "./plant-compare-matrix";
import {
  PlantAnalysisTabs,
  PlantDialogFooter,
  PlantDialogHeader,
  PlantDialogLoading,
  PlantDialogScrollBody,
  PlantDialogShell,
} from "./plant-dialog-shell";
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
    "overview" | "emissions" | "fleet" | "granular"
  >("overview");

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

  const largestPlant = [...plants].sort(
    (a, b) => b.totalCapacityMW - a.totalCapacityMW,
  )[0];

  const highestGenPlant = [...plants].sort(
    (a, b) => b.totalGenerationMWh - a.totalGenerationMWh,
  )[0];

  const totalUnits = plants.reduce((sum, p) => sum + p.unitCount, 0);
  const totalScrubbed = plants.reduce(
    (sum, p) => sum + p.controlledUnitsCount,
    0,
  );
  const controlCoveragePct =
    totalUnits > 0 ? Math.round((totalScrubbed / totalUnits) * 100) : 0;

  const maxCapacity = Math.max(...plants.map((p) => p.totalCapacityMW), 1);
  const maxGen = Math.max(...plants.map((p) => p.totalGenerationMWh), 1);
  const maxCo2 = Math.max(...plants.map((p) => p.totalCo2Tons), 1);
  const maxSo2 = Math.max(...plants.map((p) => p.totalSo2Tons), 1);
  const maxNox = Math.max(...plants.map((p) => p.totalNoxTons), 1);

  const defaultGranularYears = [2022, 2021, 2020];

  return (
    <PlantDialogShell
      open={open}
      onOpenChange={onOpenChange}
      size="compare"
      header={
        <PlantDialogHeader>
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
        </PlantDialogHeader>
      }
      footer={
        <PlantDialogFooter className="flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
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
        </PlantDialogFooter>
      }
    >
      <PlantDialogScrollBody>
        {isLoading ? (
          <PlantDialogLoading
            title="Computing comparative cross-facility metrics..."
            subtitle="Aggregating generation, emission intensity, and environmental controls"
            className="py-24"
          />
        ) : plants.length < 2 ? (
          <EmptyState
            title="Select at least 2 facilities to benchmark side-by-side."
            description="Use the comparison checkboxes in the facilities table to add up to 4 plants."
            className="py-12"
          />
        ) : (
          <>
            <KpiStrip>
              <StatTile
                label="Cleanest Plant"
                icon={<Award className="h-3.5 w-3.5 text-emerald-400" />}
                value={
                  cleanestPlant ? (
                    <span className="block max-w-[120px] truncate text-emerald-400 xl:max-w-[200px]">
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
                icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
                value={`${controlCoveragePct}%`}
                subtext={`${totalScrubbed}/${totalUnits} units scrubbed`}
                className="col-span-2 sm:col-span-1"
              />
            </KpiStrip>

            <PlantAnalysisTabs
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: "overview", label: "Overview Matrix" },
                { value: "emissions", label: "Emissions & Air Quality" },
                { value: "fleet", label: "Fleet & Generation Units" },
                { value: "granular", label: "Granular Time Series" },
              ]}
            />

            {activeTab === "granular" ? (
              plants.length > 0 ? (
                <GranularEmissionsWindow
                  facilityId={plants[0]?.id ?? 0}
                  facilityName={plants[0]?.name ?? ""}
                  units={plants[0]?.units}
                  plants={plants.map((p) => ({
                    id: p.id,
                    name: p.name,
                    units: p.units,
                    availableYears:
                      p.availableYears.length > 0
                        ? p.availableYears
                        : defaultGranularYears,
                  }))}
                />
              ) : null
            ) : (
              <PlantCompareMatrix
                plants={plants}
                activeTab={activeTab}
                cleanestPlant={cleanestPlant}
                largestPlant={largestPlant}
                highestGenPlant={highestGenPlant}
                maxCapacity={maxCapacity}
                maxGen={maxGen}
                maxCo2={maxCo2}
                maxSo2={maxSo2}
                maxNox={maxNox}
                onInspectPlant={onInspectPlant}
                onRemovePlant={onRemovePlant}
              />
            )}
          </>
        )}
      </PlantDialogScrollBody>
    </PlantDialogShell>
  );
}
