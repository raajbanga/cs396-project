"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  Award,
  ExternalLink,
  Flame,
  Gauge,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge, CarbonIntensityBadge, FuelBadge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import {
  MetricBar,
  percentOf,
  ProgressBar,
  type BarColor,
} from "~/components/ui/metric-bar";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
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
import { formatQuantity } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import { GranularEmissionsWindow } from "./granular-emissions-window";

type ComparedPlant = RouterOutputs["facilities"]["compareFacilities"][number];
type CompareTab = "overview" | "emissions" | "fleet" | "granular";
type NumericKey = {
  [K in keyof ComparedPlant]: ComparedPlant[K] extends number ? K : never;
}[keyof ComparedPlant];

interface MatrixRow {
  label: ReactNode;
  render: (plant: ComparedPlant) => ReactNode;
}

type MatrixSection = [title: string, rows: MatrixRow[]];

const sum = (plants: ComparedPlant[], key: NumericKey) =>
  plants.reduce((acc, p) => acc + p[key], 0);

const topBy = (plants: ComparedPlant[], key: NumericKey) =>
  plants.reduce<ComparedPlant | undefined>(
    (best, p) => (!best || p[key] > best[key] ? p : best),
    undefined,
  );

const labelWithIcon = (label: string, icon: ReactNode) => (
  <span className="flex items-center gap-1">
    {label}
    {icon}
  </span>
);

/** A plant's value as a bar scaled against the largest plant for that metric. */
function barRow(
  plants: ComparedPlant[],
  label: string,
  key: NumericKey,
  unit: string,
  color: BarColor,
  leaderLabel?: string,
): MatrixRow {
  const max = Math.max(...plants.map((p) => p[key]), 1);
  const leader = topBy(plants, key);
  return {
    label,
    render: (p) => (
      <MetricBar
        value={formatQuantity(p[key], unit, {
          fallback: leaderLabel ? "—" : `0 ${unit}`,
        })}
        percent={percentOf(p[key], max)}
        color={color}
        leaderLabel={p.id === leader?.id && p[key] > 0 && leaderLabel}
      />
    ),
  };
}

function coverageRow(
  label: string,
  key: NumericKey,
  color: BarColor,
): MatrixRow {
  return {
    label,
    render: (p) => {
      const pct = percentOf(p[key], p.unitCount);
      return (
        <div className="space-y-1">
          <div className="text-fg text-xs font-semibold">
            {p[key]} of {p.unitCount} units{" "}
            <span className="text-fg-muted">({pct}%)</span>
          </div>
          <ProgressBar
            percent={pct}
            color={color}
            className="h-1 w-24 2xl:w-32"
          />
        </div>
      );
    },
  };
}

function matrixSections(
  tab: Exclude<CompareTab, "granular">,
  plants: ComparedPlant[],
): MatrixSection[] {
  const mono = (text: ReactNode) => (
    <span className="text-fg-2 font-mono text-xs">{text}</span>
  );

  switch (tab) {
    case "overview":
      return [
        [
          "1. Operational Capacity & Grid Delivery",
          [
            barRow(
              plants,
              "Nameplate Capacity",
              "totalCapacityMW",
              "MW",
              "amber",
              "Largest",
            ),
            barRow(
              plants,
              "Net Generation",
              "totalGenerationMWh",
              "MWh",
              "sky",
              "Top Gen",
            ),
            {
              label: "Annual Dispatch Hours",
              render: (p) => mono(formatQuantity(p.totalOperatingHours, "hrs")),
            },
            {
              label: "Capacity Factor",
              render: (p) => {
                if (!p.totalCapacityMW || !p.totalGenerationMWh)
                  return mono("—");
                const cf = percentOf(
                  p.totalGenerationMWh,
                  p.totalCapacityMW * 8760,
                );
                return (
                  <div className="space-y-1">
                    <span className="text-fg font-mono text-xs font-semibold">
                      {cf}%
                    </span>
                    <ProgressBar percent={cf} className="h-1 w-24 2xl:w-32" />
                  </div>
                );
              },
            },
          ],
        ],
        [
          "2. Thermodynamic & Carbon Intensity",
          [
            {
              label: labelWithIcon(
                "Carbon Intensity",
                <Gauge className="h-3.5 w-3.5 text-emerald-400" />,
              ),
              render: (p) => (
                <CarbonIntensityBadge
                  intensity={p.carbonIntensityLbsMWh}
                  showValue
                />
              ),
            },
            {
              label: labelWithIcon(
                "Heat Rate Efficiency",
                <Flame className="h-3.5 w-3.5 text-amber-400" />,
              ),
              render: (p) =>
                p.heatRateMMBtuMWh ? (
                  <div className="space-y-0.5">
                    <div className="text-fg font-mono text-xs font-semibold">
                      {p.heatRateMMBtuMWh.toFixed(2)} MMBtu/MWh
                    </div>
                    <span className="text-fg-muted text-xs">
                      {p.heatRateMMBtuMWh < 8
                        ? "High CCGT efficiency"
                        : p.heatRateMMBtuMWh < 12
                          ? "Standard steam rankine"
                          : "Subcritical thermal"}
                    </span>
                  </div>
                ) : (
                  mono("—")
                ),
            },
          ],
        ],
      ];

    case "emissions":
      return [
        [
          "1. Direct Stack Pollutant Mass",
          [
            barRow(plants, "Annual CO₂ Mass", "totalCo2Tons", "t", "rose"),
            barRow(plants, "Annual SO₂ Mass", "totalSo2Tons", "t", "amber"),
            barRow(plants, "Annual NOₓ Mass", "totalNoxTons", "t", "amber"),
          ],
        ],
        [
          "2. Clean Air Quality & Abatement Controls",
          [
            coverageRow("SO₂ Scrubbers (FGD)", "so2ControlledUnits", "emerald"),
            coverageRow(
              "NOₓ Catalytic Controls (SCR/SNCR)",
              "noxControlledUnits",
              "sky",
            ),
            coverageRow(
              "Particulate Controls (ESP/Baghouses)",
              "pmControlledUnits",
              "amber",
            ),
          ],
        ],
      ];

    case "fleet":
      return [
        [
          "1. Generation Units & Status",
          [
            {
              label: "Operating vs Total Units",
              render: (p) => (
                <span className="text-fg-muted text-xs">
                  <strong className="text-fg font-semibold">
                    {p.operatingUnitsCount}
                  </strong>{" "}
                  / {p.unitCount} total units
                </span>
              ),
            },
            {
              label: "Fuel Portfolio",
              render: (p) => (
                <div className="flex flex-wrap gap-1">
                  {p.primaryFuels.map((f) => (
                    <FuelBadge key={f} fuel={f} />
                  ))}
                  {p.secondaryFuels.map((f) => (
                    <Badge key={f} variant="secondary">
                      Backup: {f}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              label: "Owner / Operator",
              render: (p) => (
                <span className="text-fg-2 text-sm">
                  {cleanOwnerOperator(p.ownerOperator)}
                </span>
              ),
            },
            {
              label: "EPA Source Category",
              render: (p) => (
                <Badge variant="outline">{p.sourceCategory}</Badge>
              ),
            },
          ],
        ],
        [
          "2. Unit-Level Roster Comparison",
          [
            {
              label: "Generator Units",
              render: (p) => (
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {p.units.map((u) => (
                    <div
                      key={u.id}
                      className="border-edge/60 bg-surface/60 flex items-center justify-between rounded-md border px-2 py-1 text-sm"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-emerald-400">
                          #{u.unitId}
                        </span>
                        <span className="text-fg-muted">
                          {u.unitType ?? "Combustion"}
                        </span>
                      </span>
                      <span className="text-fg font-mono font-medium">
                        {formatQuantity(u.nameplateCapacityMW, "MW", {
                          digits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ),
            },
          ],
        ],
      ];
  }
}

function CompareMatrix({
  plants,
  tab,
  cleanestId,
  onInspectPlant,
  onRemovePlant,
}: {
  plants: ComparedPlant[];
  tab: Exclude<CompareTab, "granular">;
  cleanestId?: number;
  onInspectPlant: (id: number) => void;
  onRemovePlant: (id: number) => void;
}) {
  return (
    <DataPanel className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48 align-bottom sm:w-56">
              Benchmarking Metric
            </TableHead>
            {plants.map((plant) => (
              <TableHead
                key={plant.id}
                className="border-edge min-w-[220px] space-y-2 border-l p-3.5 align-top xl:min-w-[260px]"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-medium text-emerald-400">
                    #{plant.id}
                  </span>
                  <div className="flex items-center gap-1">
                    {cleanestId === plant.id && (
                      <Badge variant="success" className="py-0">
                        <Award className="h-3 w-3" />
                        Cleanest
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onInspectPlant(plant.id)}
                      className="h-6 gap-1 px-2"
                      title={`View full dossier for ${plant.name}`}
                    >
                      Dossier
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemovePlant(plant.id)}
                      className="h-6 w-6"
                      title={`Remove ${plant.name} from comparison`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-fg line-clamp-2 text-sm font-semibold sm:text-base">
                  {plant.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {plant.county && `${formatCountyShort(plant.county)}, `}
                  {plant.stateCode}
                  <span>•</span>
                  <Badge variant="sky" className="px-1.5 py-0 font-mono">
                    {plant.nercRegion}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {plant.primaryFuels.map((f) => (
                    <FuelBadge key={f} fuel={f} />
                  ))}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrixSections(tab, plants).flatMap(([title, rows]) => [
            <TableRow key={title} className="bg-surface/50 hover:bg-surface/50">
              <TableCell
                colSpan={plants.length + 1}
                className="text-fg px-3.5 py-2 text-xs font-semibold tracking-wider uppercase"
              >
                {title}
              </TableCell>
            </TableRow>,
            ...rows.map((row, i) => (
              <TableRow key={`${title}-${i}`}>
                <TableCell className="text-fg-2 p-3.5 font-medium">
                  {row.label}
                </TableCell>
                {plants.map((p) => (
                  <TableCell
                    key={p.id}
                    className="border-edge/60 border-l p-3.5"
                  >
                    {row.render(p)}
                  </TableCell>
                ))}
              </TableRow>
            )),
          ])}
        </TableBody>
      </Table>
    </DataPanel>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plants?: ComparedPlant[];
  isLoading: boolean;
  onClearSelection: () => void;
  onRemovePlant: (id: number) => void;
  onInspectPlant: (id: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<CompareTab>("overview");
  const cleanest = pickCleanestByCarbonIntensity(plants);
  const totalUnits = sum(plants, "unitCount");
  const totalScrubbed = sum(plants, "controlledUnitsCount");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="compare"
      closeLabel="Close Comparison"
      header={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-emerald-400">
              BENCHMARK MATRIX
            </span>
            <Badge variant="outline" className="font-mono">
              {plants.length} {plants.length === 1 ? "Facility" : "Facilities"}{" "}
              Selected
            </Badge>
            {cleanest && (
              <Badge variant="success">
                <Award className="h-3 w-3" />
                Cleanest: {cleanest.name}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg sm:text-xl">
            Cross-Facility Comparative Benchmark
          </DialogTitle>
          <p className="text-fg-muted mt-0.5 text-xs">
            Side-by-side performance audit across grid reliability,
            thermodynamic capacity, and emission rates.
          </p>
        </>
      }
      footer={
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="underline sm:mr-auto"
        >
          Clear comparison selection ({plants.length} plants)
        </Button>
      }
    >
      {isLoading ? (
        <InlineLoading
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
                <span className="block max-w-[120px] truncate text-emerald-400 xl:max-w-[200px]">
                  {cleanest?.name ?? "—"}
                </span>
              }
              subtext={
                cleanest?.carbonIntensityLbsMWh === 0
                  ? "Zero stack CO₂"
                  : formatQuantity(cleanest?.carbonIntensityLbsMWh, "lbs/MWh")
              }
            />
            <StatTile
              label="Joint Capacity"
              icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
              value={formatQuantity(sum(plants, "totalCapacityMW"), "MW")}
              subtext={`${totalUnits} combined units`}
            />
            <StatTile
              label="Joint Generation"
              icon={<Activity className="h-3.5 w-3.5 text-sky-400" />}
              value={formatQuantity(sum(plants, "totalGenerationMWh"), "MWh")}
              subtext="Annual grid supply"
            />
            <StatTile
              label="Joint CO₂ Mass"
              icon={<Flame className="h-3.5 w-3.5 text-rose-400" />}
              value={formatQuantity(sum(plants, "totalCo2Tons"), "t", {
                fallback: "0 t",
              })}
              subtext="Total direct stack output"
            />
            <StatTile
              label="Control Coverage"
              icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
              value={`${percentOf(totalScrubbed, totalUnits)}%`}
              subtext={`${totalScrubbed}/${totalUnits} units scrubbed`}
              className="col-span-2 sm:col-span-1"
            />
          </KpiStrip>

          <SegmentedControl
            variant="tabs"
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
            <GranularEmissionsWindow plants={plants} />
          ) : (
            <CompareMatrix
              plants={plants}
              tab={activeTab}
              cleanestId={cleanest?.id}
              onInspectPlant={onInspectPlant}
              onRemovePlant={onRemovePlant}
            />
          )}
        </>
      )}
    </Dialog>
  );
}
