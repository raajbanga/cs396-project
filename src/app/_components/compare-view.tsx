"use client";

import { use, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  Badge,
  CarbonIntensityBadge,
  FuelBadge,
  SourceBadge,
} from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { DialogHeader } from "~/components/ui/dialog";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { MetricBar, percentOf, ProgressBar } from "~/components/ui/metric-bar";
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
import { api, type RouterOutputs } from "~/trpc/react";
import { SelectionContext, selectionLabel } from "./selection-context";
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

/** A plant's value as a bar scaled against the largest plant for that metric. */
function barRow(
  plants: ComparedPlant[],
  label: string,
  key: NumericKey,
  unit: string,
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
        leaderLabel={p.id === leader?.id && p[key] > 0 && leaderLabel}
      />
    ),
  };
}

function coverageRow(label: string, key: NumericKey): MatrixRow {
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
          <ProgressBar percent={pct} className="h-1 w-24 2xl:w-32" />
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
    <span className="text-fg-2 tabular-nums">{text}</span>
  );

  switch (tab) {
    case "overview":
      return [
        [
          "Capacity and generation",
          [
            barRow(
              plants,
              "Nameplate capacity",
              "totalCapacityMW",
              "MW",
              "Largest",
            ),
            barRow(plants, "Gross load", "totalGenerationMWh", "MWh", "Most"),
            {
              label: "Operating time",
              render: (p) => mono(formatQuantity(p.totalOperatingHours, "hr")),
            },
            {
              label: "Capacity factor",
              render: (p) => {
                if (!p.totalCapacityMW || !p.totalGenerationMWh)
                  return mono("—");
                const cf = percentOf(
                  p.totalGenerationMWh,
                  p.totalCapacityMW * 8760,
                );
                return (
                  <div className="space-y-1">
                    <span className="text-fg text-sm tabular-nums">{cf}%</span>
                    <ProgressBar percent={cf} className="h-1 w-24 2xl:w-32" />
                  </div>
                );
              },
            },
          ],
        ],
        [
          "Efficiency",
          [
            {
              label: "CO₂ rate",
              render: (p) => (
                <CarbonIntensityBadge
                  intensity={p.carbonIntensityLbsMWh}
                  showValue
                />
              ),
            },
            {
              label: "Heat rate",
              render: (p) =>
                p.heatRateMMBtuMWh ? (
                  <div className="space-y-0.5">
                    <div className="text-fg text-sm tabular-nums">
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
          "Emissions",
          [
            barRow(plants, "CO₂", "totalCo2Tons", "t"),
            barRow(plants, "SO₂", "totalSo2Tons", "t"),
            barRow(plants, "NOₓ", "totalNoxTons", "t"),
          ],
        ],
        [
          "Units with controls",
          [
            coverageRow("SO₂ (scrubbers, FGD)", "so2ControlledUnits"),
            coverageRow("NOₓ (SCR, SNCR, burners)", "noxControlledUnits"),
            coverageRow("Particulates (ESP, baghouse)", "pmControlledUnits"),
          ],
        ],
      ];

    case "fleet":
      return [
        [
          "Units and fuels",
          [
            {
              label: "Operating units",
              render: (p) => (
                <span className="text-fg-2 text-sm">
                  {p.operatingUnitsCount} of {p.unitCount}
                </span>
              ),
            },
            {
              label: "Fuels",
              render: (p) => (
                <div className="flex flex-col gap-0.5">
                  {p.primaryFuels.map((f) => (
                    <FuelBadge key={f} fuel={f} />
                  ))}
                  {p.secondaryFuels.length > 0 && (
                    <span className="text-fg-muted text-xs">
                      Secondary: {p.secondaryFuels.join(", ")}
                    </span>
                  )}
                </div>
              ),
            },
            {
              label: "Owner / operator",
              render: (p) => (
                <span className="text-fg-2 text-sm">
                  {cleanOwnerOperator(p.ownerOperator)}
                </span>
              ),
            },
            {
              label: "Source category",
              render: (p) => (
                <span className="text-fg-2 text-sm">{p.sourceCategory}</span>
              ),
            },
          ],
        ],
        [
          "Unit roster",
          [
            {
              label: "Units",
              render: (p) => (
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {p.units.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="text-fg">Unit {u.unitId}</span>{" "}
                        <span className="text-fg-muted">
                          {u.unitType ?? ""}
                        </span>
                      </span>
                      <span className="text-fg-2 tabular-nums">
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
  cleanestKey,
  onInspectPlant,
  onRemovePlant,
}: {
  plants: ComparedPlant[];
  tab: Exclude<CompareTab, "granular">;
  cleanestKey?: string;
  onInspectPlant: (plant: ComparedPlant) => void;
  onRemovePlant: (plant: ComparedPlant) => void;
}) {
  return (
    <DataPanel className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48 align-bottom sm:w-56">
              <span className="sr-only">Metric</span>
            </TableHead>
            {plants.map((plant) => (
              <TableHead
                key={plant.key}
                className="border-edge h-auto min-w-[220px] space-y-1 border-l px-3 py-3 align-top font-normal xl:min-w-[260px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onInspectPlant(plant)}
                    className="text-fg line-clamp-2 cursor-pointer text-left text-sm font-medium hover:underline"
                    title={`Open the details of ${plant.name}`}
                  >
                    {plant.name}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemovePlant(plant)}
                    className="h-6 w-6"
                    title={`Remove ${plant.name} from comparison`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="text-fg-muted text-xs">
                  {plant.id} ·{" "}
                  {plant.county && `${formatCountyShort(plant.county)}, `}
                  {plant.stateCode}
                  {plant.nercRegion && ` · ${plant.nercRegion}`}
                </div>
                {cleanestKey === plant.key && (
                  <Badge variant="success">Lowest CO₂ rate</Badge>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrixSections(tab, plants).flatMap(([title, rows]) => [
            <TableRow key={title} className="hover:bg-transparent">
              <TableCell
                colSpan={plants.length + 1}
                className="text-fg bg-canvas/60 px-3 py-2 text-sm font-semibold"
              >
                {title}
              </TableCell>
            </TableRow>,
            ...rows.map((row, i) => (
              <TableRow key={`${title}-${i}`}>
                <TableCell className="text-fg-2 px-3 py-3">
                  {row.label}
                </TableCell>
                {plants.map((p) => (
                  <TableCell
                    key={p.key}
                    className="border-edge/60 border-l px-3 py-3"
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

/** §8.3 facility comparison: 2–4 facilities or units side by side, in the detail dialog. */
export function CompareView() {
  const [activeTab, setActiveTab] = useState<CompareTab>("overview");
  const {
    compareIds,
    compareUnitIds,
    toggleCompare,
    toggleUnitCompare,
    clearCompare,
    inspect,
  } = use(SelectionContext);
  const canCompare = compareIds.length + compareUnitIds.length >= 2;
  const { data: plants = [], isLoading } =
    api.facilities.compareFacilities.useQuery(
      { ids: compareIds, unitIds: compareUnitIds },
      { enabled: canCompare, placeholderData: (prev) => prev },
    );
  const cleanest = pickCleanestByCarbonIntensity(plants);
  const totalUnits = sum(plants, "unitCount");
  const totalScrubbed = sum(plants, "controlledUnitsCount");

  return (
    <div className="space-y-8">
      <DialogHeader
        context="Comparison"
        title={`${selectionLabel(compareIds, compareUnitIds) || "Nothing"} side by side`}
        lead="Capacity, generation, emissions, and efficiency for each one's latest reporting year. Click a name for its full details."
        actions={
          <>
            <SourceBadge kind="db" />
            <Button variant="outline" size="sm" onClick={clearCompare}>
              Clear selection
            </Button>
          </>
        }
      />
      {isLoading && canCompare ? (
        <InlineLoading title="Comparing…" />
      ) : !canCompare ? (
        <EmptyState
          title="Pick at least two facilities or units to compare."
          description="Tick up to four rows in Explore, or use “Add to compare” in a facility or unit."
        />
      ) : (
        <>
          <KpiStrip>
            <StatTile
              label="Lowest CO₂ rate"
              value={cleanest?.name ?? "—"}
              subtext={
                cleanest?.carbonIntensityLbsMWh === 0
                  ? "Zero stack CO₂"
                  : formatQuantity(cleanest?.carbonIntensityLbsMWh, "lbs/MWh")
              }
            />
            <StatTile
              label="Capacity, combined"
              value={formatQuantity(sum(plants, "totalCapacityMW"), "MW")}
              subtext={`${totalUnits} units`}
            />
            <StatTile
              label="Gross load, combined"
              value={formatQuantity(sum(plants, "totalGenerationMWh"), "MWh")}
              subtext="latest years"
            />
            <StatTile
              label="CO₂, combined"
              value={formatQuantity(sum(plants, "totalCo2Tons"), "t", {
                fallback: "0 t",
              })}
              subtext="latest years"
            />
            <StatTile
              label="Units with controls"
              value={`${percentOf(totalScrubbed, totalUnits)}%`}
              subtext={`${totalScrubbed} of ${totalUnits}`}
              className="col-span-2 sm:col-span-1"
            />
          </KpiStrip>

          <SegmentedControl
            variant="tabs"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: "overview", label: "Overview" },
              { value: "emissions", label: "Emissions and controls" },
              { value: "fleet", label: "Units and fuels" },
              { value: "granular", label: "Hourly and daily (live API)" },
            ]}
          />

          {activeTab === "granular" ? (
            <GranularEmissionsWindow plants={plants} />
          ) : (
            <CompareMatrix
              plants={plants}
              tab={activeTab}
              cleanestKey={cleanest?.key}
              onInspectPlant={(p) =>
                inspect(
                  p.unitInternalId
                    ? { kind: "unit", id: p.unitInternalId }
                    : { kind: "facility", id: p.id },
                )
              }
              onRemovePlant={(p) =>
                p.unitInternalId
                  ? toggleUnitCompare(p.unitInternalId)
                  : toggleCompare(p.id)
              }
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Header actions of a single facility or unit: tick it for comparison, and once two or more are
 * picked, switch the dialog to the comparison.
 */
export function CompareActions({
  isInCompare,
  onToggle,
}: {
  isInCompare: boolean;
  onToggle: () => void;
}) {
  const { compareIds, compareUnitIds, inspect } = use(SelectionContext);
  const count = compareIds.length + compareUnitIds.length;
  return (
    <>
      <SourceBadge kind="db" />
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        aria-pressed={isInCompare}
      >
        {isInCompare ? "Remove from compare" : "Add to compare"}
      </Button>
      {count >= 2 && (
        <Button size="sm" onClick={() => inspect({ kind: "compare" })}>
          Compare {count}
        </Button>
      )}
    </>
  );
}
