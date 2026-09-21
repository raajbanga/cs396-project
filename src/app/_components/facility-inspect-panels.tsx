"use client";

import React from "react";
import {
  Car,
  ChevronDown,
  ChevronRight,
  Home,
  Leaf,
  Sparkles,
  Zap,
} from "lucide-react";
import { AuditSeverityBadge, Badge } from "~/components/ui/badge";
import { CarbonIntensityBadge } from "~/components/ui/carbon-intensity-badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState } from "~/components/ui/empty-state";
import { FuelBadge } from "~/components/ui/fuel-badge";
import { PlantRoleBadge } from "~/components/ui/plant-role-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { type YearlyRollup } from "~/lib/annual-rollups";
import {
  isOperatingStatus,
  type generatePlantStory,
} from "~/lib/plant-narrative";
import { type RouterOutputs } from "~/trpc/react";

type FacilityDetailData = NonNullable<
  RouterOutputs["facilities"]["getFacility"]
>;
type PlantStory = ReturnType<typeof generatePlantStory>;
type AuditLog = NonNullable<
  FacilityDetailData["annualRecords"][number]["auditLogs"]
>[number];

export function InspectOverviewPanel({ story }: { story: PlantStory | null }) {
  if (!story) {
    return (
      <EmptyState
        title="Generating plant operational profile..."
        className="text-xs"
      />
    );
  }

  return (
    <div className="border-edge bg-surface/40 space-y-3 rounded-lg border p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span className="text-fg text-xs font-semibold tracking-wider uppercase">
            Plant Overview & Role
          </span>
        </div>
        <PlantRoleBadge roleInfo={story.roleInfo} />
      </div>

      <p className="text-fg text-sm leading-relaxed font-medium">
        {story.headline}
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="border-edge/60 bg-canvas/60 space-y-1 rounded-md border p-3">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sky-400">
            <Zap className="h-3.5 w-3.5" />
            Grid & Operational Dispatch
          </span>
          <p className="text-fg-2 text-sm leading-relaxed">{story.gridStory}</p>
        </div>

        <div className="border-edge/60 bg-canvas/60 space-y-1 rounded-md border p-3">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Leaf className="h-3.5 w-3.5" />
            Environmental Footprint
          </span>
          <p className="text-fg-2 text-sm leading-relaxed">
            {story.environmentalStory}
          </p>
        </div>
      </div>

      <div className="border-edge/60 flex flex-wrap items-center gap-3 border-t pt-2.5 text-xs">
        <div className="text-fg-2 flex items-center gap-1.5">
          <Home className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>
            Powers{" "}
            <strong className="text-fg">
              {story.equivalents.homesPoweredFormatted}
            </strong>
          </span>
        </div>
        {story.equivalents.carsDrivenRaw > 0 && (
          <div className="text-fg-2 flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            <span>
              Emissions ≈{" "}
              <strong className="text-fg">
                {story.equivalents.carsDrivenFormatted}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function InspectFleetPanel({
  units,
}: {
  units: FacilityDetailData["units"];
}) {
  if (units.length === 0) {
    return (
      <EmptyState title="No generation units recorded for this facility." />
    );
  }

  return (
    <DataPanel>
      <Table>
        <TableHeader>
          <TableRow className="border-edge bg-surface/60 border-b">
            <TableHead className="w-24">Unit ID</TableHead>
            <TableHead>Type & Primary Fuel</TableHead>
            <TableHead>Operating Status</TableHead>
            <TableHead className="text-right">Capacity (MW)</TableHead>
            <TableHead>Air Quality Controls</TableHead>
            <TableHead className="w-28 text-right">Commissioned</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((unit) => {
            const isOperating = isOperatingStatus(unit.operatingStatus);
            return (
              <TableRow key={unit.id} className="hover:bg-surface/40">
                <TableCell className="font-mono text-xs font-medium text-emerald-400">
                  Unit {unit.unitId}
                </TableCell>

                <TableCell>
                  <div className="text-fg font-medium">
                    {unit.unitType ?? "Combustion Generator"}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {unit.primaryFuel && <FuelBadge fuel={unit.primaryFuel} />}
                    {unit.secondaryFuel && (
                      <Badge variant="secondary">
                        Sec: {unit.secondaryFuel}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <Badge variant={isOperating ? "success" : "secondary"}>
                    {unit.operatingStatus ?? "Operating"}
                  </Badge>
                </TableCell>

                <TableCell className="text-fg text-right font-mono font-semibold">
                  {unit.nameplateCapacityMW
                    ? `${unit.nameplateCapacityMW} MW`
                    : "—"}
                </TableCell>

                <TableCell className="max-w-xs">
                  <div className="space-y-0.5 text-xs">
                    {unit.noxControls && (
                      <div className="text-fg-2 truncate">
                        <span className="text-fg-muted font-medium">NOₓ:</span>{" "}
                        {unit.noxControls}
                      </div>
                    )}
                    {unit.so2Controls && (
                      <div className="text-fg-2 truncate">
                        <span className="text-fg-muted font-medium">SO₂:</span>{" "}
                        {unit.so2Controls}
                      </div>
                    )}
                    {!unit.noxControls && !unit.so2Controls && (
                      <span className="text-fg-muted text-xs italic">
                        No controls listed
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-fg-muted text-right font-mono text-xs">
                  {unit.commercialOpDate ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

export function InspectEmissionsPanel({
  facilityId,
  facility,
  yearlyRollups,
  collapsedYears,
  onToggleYear,
}: {
  facilityId: number | null;
  facility: FacilityDetailData | null | undefined;
  yearlyRollups: YearlyRollup[];
  collapsedYears: Set<string>;
  onToggleYear: (year: number) => void;
}) {
  if (yearlyRollups.length === 0) {
    return <EmptyState title="No annual emissions records available." />;
  }

  return (
    <DataPanel>
      <Table>
        <TableHeader>
          <TableRow className="border-edge bg-surface/60 border-b">
            <TableHead className="w-40">Reporting Year</TableHead>
            <TableHead className="text-right">Generation (MWh)</TableHead>
            <TableHead className="text-right">CO₂ Mass (tons)</TableHead>
            <TableHead className="text-right">Intensity (lbs/MWh)</TableHead>
            <TableHead className="text-right">Thermal Heat Rate</TableHead>
            <TableHead className="text-right">Operating Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {yearlyRollups.map((rollup) => {
            const isExpanded = !collapsedYears.has(
              `${facilityId}:${rollup.year}`,
            );
            const hasMultipleUnits = rollup.records.length > 1;

            return (
              <React.Fragment key={rollup.year}>
                <TableRow
                  className={`hover:bg-surface/40 ${
                    hasMultipleUnits ? "cursor-pointer" : ""
                  }`}
                  onClick={() => {
                    if (hasMultipleUnits) onToggleYear(rollup.year);
                  }}
                >
                  <TableCell className="text-fg font-mono font-medium">
                    <div className="flex items-center gap-1.5">
                      {hasMultipleUnits && (
                        <span className="text-fg-muted">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                      <span>{rollup.year}</span>
                      <Badge
                        variant="outline"
                        className="px-1 py-0 font-sans text-[10px]"
                      >
                        {rollup.unitCount}{" "}
                        {rollup.unitCount === 1 ? "unit" : "units"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-fg text-right font-mono font-semibold">
                    {rollup.grossGenerationMWh
                      ? Math.round(rollup.grossGenerationMWh).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-fg text-right font-mono font-semibold">
                    {rollup.co2MassTons
                      ? Math.round(rollup.co2MassTons).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <CarbonIntensityBadge
                      intensity={rollup.co2IntensityLbsMWh}
                      showValue
                    />
                  </TableCell>
                  <TableCell className="text-fg-muted text-right font-mono text-xs">
                    {rollup.heatRateMMBtuMWh
                      ? `${rollup.heatRateMMBtuMWh.toFixed(1)} MMBtu/MWh`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-fg-muted text-right font-mono text-xs">
                    {rollup.maxOperatingHours
                      ? `${Math.round(rollup.maxOperatingHours).toLocaleString()} hrs`
                      : "—"}
                  </TableCell>
                </TableRow>

                {isExpanded &&
                  rollup.records.map((rec) => {
                    const unit =
                      rec.unit ??
                      facility?.units.find((u) => u.id === rec.unitInternalId);
                    return (
                      <TableRow
                        key={rec.id}
                        className="border-edge/40 bg-surface/25 text-fg-2 hover:bg-surface/40 border-b text-xs"
                      >
                        <TableCell className="pl-8 font-mono text-xs">
                          <span className="font-semibold text-emerald-400">
                            Unit {unit?.unitId ?? "—"}
                          </span>
                          {unit?.primaryFuel && (
                            <span className="text-fg-muted ml-1.5 text-[10px]">
                              ({unit.primaryFuel})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-fg-2 text-right font-mono text-xs">
                          {rec.grossGenerationMWh
                            ? Math.round(
                                rec.grossGenerationMWh,
                              ).toLocaleString()
                            : "0"}
                        </TableCell>
                        <TableCell className="text-fg-2 text-right font-mono text-xs">
                          {rec.co2MassTons
                            ? Math.round(rec.co2MassTons).toLocaleString()
                            : "0"}
                        </TableCell>
                        <TableCell className="text-right">
                          <CarbonIntensityBadge
                            intensity={rec.co2IntensityLbsMWh}
                            showValue
                          />
                        </TableCell>
                        <TableCell className="text-fg-muted text-right font-mono text-[11px]">
                          {rec.heatRateMMBtuMWh
                            ? `${rec.heatRateMMBtuMWh.toFixed(1)} MMBtu/MWh`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-fg-muted text-right font-mono text-[11px]">
                          {rec.operatingHours
                            ? `${rec.operatingHours.toLocaleString()} hrs`
                            : "0 hrs"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

export function InspectAuditPanel({ auditLogs }: { auditLogs: AuditLog[] }) {
  if (auditLogs.length === 0) {
    return (
      <EmptyState
        variant="success"
        title="All Physical Sanity Checks Clean"
        description="No thermodynamic anomalies or reporting violations detected for this plant."
      />
    );
  }

  return (
    <DataPanel>
      <Table>
        <TableHeader>
          <TableRow className="border-edge bg-surface/60 border-b">
            <TableHead className="w-24">Severity</TableHead>
            <TableHead>Rule Triggered</TableHead>
            <TableHead>Audit Explanation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditLogs.map((log) => (
            <TableRow key={log.id} className="hover:bg-surface/40">
              <TableCell>
                <AuditSeverityBadge severity={log.severity} />
              </TableCell>
              <TableCell className="text-fg font-mono text-xs font-semibold">
                {log.flagType}
              </TableCell>
              <TableCell className="text-fg-2 max-w-md text-xs">
                {log.details}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataPanel>
  );
}
