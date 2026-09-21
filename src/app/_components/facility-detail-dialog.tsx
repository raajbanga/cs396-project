"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Flame,
  Gauge,
  MapPin,
  Scale,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DialogTitle } from "~/components/ui/dialog";
import { KpiStrip } from "~/components/ui/kpi-strip";
import { StatTile } from "~/components/ui/stat-tile";
import { buildYearlyRollups } from "~/lib/annual-rollups";
import {
  cleanOwnerOperator,
  formatCountyShort,
  generatePlantStory,
  hasAirQualityControls,
} from "~/lib/plant-narrative";
import { type RouterOutputs } from "~/trpc/react";
import {
  InspectAuditPanel,
  InspectEmissionsPanel,
  InspectFleetPanel,
  InspectOverviewPanel,
} from "./facility-inspect-panels";
import { GranularEmissionsWindow } from "./granular-emissions-window";
import {
  PlantAnalysisTabs,
  PlantDialogFooter,
  PlantDialogHeader,
  PlantDialogLoading,
  PlantDialogScrollBody,
  PlantDialogShell,
} from "./plant-dialog-shell";

type FacilityDetailData = NonNullable<
  RouterOutputs["facilities"]["getFacility"]
>;

interface FacilityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: number | null;
  facility?: FacilityDetailData | null;
  isLoading: boolean;
  onToggleCompare?: (id: number) => void;
  isInCompare?: boolean;
}

export function FacilityDetailDialog({
  open,
  onOpenChange,
  facilityId,
  facility,
  isLoading,
  onToggleCompare,
  isInCompare,
}: FacilityDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "emissions" | "fleet" | "granular" | "audit"
  >("overview");
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());

  const toggleYearExpanded = (year: number) => {
    const key = `${facilityId}:${year}`;
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalCapacityMW =
    facility?.units.reduce((acc, u) => acc + (u.nameplateCapacityMW ?? 0), 0) ??
    0;

  const yearlyRollups = useMemo(
    () => buildYearlyRollups(facility?.annualRecords),
    [facility?.annualRecords],
  );

  const latestRollup = yearlyRollups[0];
  const allAuditLogs =
    facility?.annualRecords.flatMap((r) => r.auditLogs ?? []) ?? [];

  const primaryFuels = Array.from(
    new Set(facility?.units.map((u) => u.primaryFuel).filter(Boolean)),
  ) as string[];

  const hasControls = facility?.units.some(hasAirQualityControls) ?? false;

  const story = facility
    ? generatePlantStory({
        name: facility.name,
        county: facility.county,
        stateCode: facility.stateCode,
        nercRegion: facility.nercRegion,
        sourceCategory: facility.sourceCategory,
        ownerOperator: facility.ownerOperator,
        totalCapacityMW,
        unitCount: facility.units.length,
        primaryFuels,
        co2Tons: latestRollup?.co2MassTons ?? 0,
        operatingHours: latestRollup?.maxOperatingHours ?? 0,
        grossGenerationMWh: latestRollup?.grossGenerationMWh ?? 0,
        carbonIntensity: latestRollup?.co2IntensityLbsMWh ?? null,
        hasControls,
        year: latestRollup?.year,
      })
    : null;

  const mapsUrl =
    facility?.latitude && facility?.longitude
      ? `https://maps.google.com/?q=${facility.latitude},${facility.longitude}`
      : null;

  const availableYears =
    yearlyRollups.length > 0
      ? yearlyRollups.map((r) => r.year)
      : [2022, 2021, 2020];

  return (
    <PlantDialogShell
      open={open}
      onOpenChange={onOpenChange}
      size="inspect"
      header={
        <PlantDialogHeader>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-medium text-emerald-400">
                  ORISPL #{facility?.id ?? facilityId}
                </span>
                {facility?.nercRegion && (
                  <Badge variant="sky" className="font-mono text-xs">
                    Grid: {facility.nercRegion}
                  </Badge>
                )}
                {facility?.epaRegion && (
                  <Badge variant="outline" className="font-mono text-xs">
                    EPA Region {facility.epaRegion}
                  </Badge>
                )}
                {facility?.sourceCategory && (
                  <Badge variant="secondary">{facility.sourceCategory}</Badge>
                )}
              </div>

              {onToggleCompare && facility && (
                <Button
                  variant={isInCompare ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onToggleCompare(facility.id)}
                  className="h-6 gap-1 px-2.5 text-xs"
                >
                  <Scale className="h-3 w-3 text-emerald-400" />
                  <span>
                    {isInCompare ? "In Comparison" : "Add to Compare"}
                  </span>
                </Button>
              )}
            </div>

            <DialogTitle className="mt-1">
              {facility?.name ?? "Loading Facility Dossier..."}
            </DialogTitle>

            <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span>
                Owner: {cleanOwnerOperator(facility?.ownerOperator ?? null)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="text-fg-muted h-3 w-3" />
                {facility?.county
                  ? `${formatCountyShort(facility.county)}, `
                  : ""}
                {facility?.stateCode}
              </span>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-sky-400 underline hover:text-sky-300"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </PlantDialogHeader>
      }
      footer={
        <PlantDialogFooter className="flex items-center justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="font-medium"
          >
            Close Facility Dossier
          </Button>
        </PlantDialogFooter>
      }
    >
      <PlantDialogScrollBody>
        {facility && (
          <KpiStrip>
            <StatTile
              label="Capacity"
              icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
              value={
                totalCapacityMW > 0
                  ? `${Math.round(totalCapacityMW).toLocaleString()} MW`
                  : "—"
              }
              subtext={`${facility.units.length} total units`}
            />
            <StatTile
              label="Generation"
              icon={<Activity className="h-3.5 w-3.5 text-emerald-400" />}
              value={
                latestRollup?.grossGenerationMWh
                  ? `${Math.round(latestRollup.grossGenerationMWh).toLocaleString()} MWh`
                  : "—"
              }
              subtext={
                latestRollup
                  ? `${Math.round(latestRollup.maxOperatingHours).toLocaleString()} dispatch hrs`
                  : "—"
              }
            />
            <StatTile
              label="CO₂ Mass"
              icon={<Flame className="h-3.5 w-3.5 text-amber-500" />}
              value={
                latestRollup?.co2MassTons
                  ? `${Math.round(latestRollup.co2MassTons).toLocaleString()} t`
                  : "—"
              }
              subtext={
                latestRollup?.heatInputMMBtu
                  ? `${Math.round(latestRollup.heatInputMMBtu).toLocaleString()} MMBtu`
                  : "Direct stack output"
              }
            />
            <StatTile
              label="Intensity"
              icon={<Gauge className="h-3.5 w-3.5 text-emerald-400" />}
              value={
                latestRollup?.co2IntensityLbsMWh
                  ? `${Math.round(latestRollup.co2IntensityLbsMWh)} lbs/MWh`
                  : "—"
              }
              valueClassName="text-emerald-400"
              subtext={
                latestRollup?.heatRateMMBtuMWh
                  ? `${latestRollup.heatRateMMBtuMWh.toFixed(1)} MMBtu/MWh`
                  : "Heat rate N/A"
              }
            />
            <StatTile
              label="Sanity Audit"
              icon={
                allAuditLogs.length > 0 ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                )
              }
              value={
                allAuditLogs.length > 0 ? (
                  <span className="text-amber-400">
                    {allAuditLogs.length} Flagged
                  </span>
                ) : (
                  <span className="text-emerald-400">Clean</span>
                )
              }
              subtext="Thermodynamic audit"
              className="col-span-2 sm:col-span-1"
            />
          </KpiStrip>
        )}

        <PlantAnalysisTabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "overview", label: "Plant Overview" },
            {
              value: "emissions",
              label: `Emissions & Air Quality (${yearlyRollups.length} ${yearlyRollups.length === 1 ? "Yr" : "Yrs"})`,
            },
            {
              value: "fleet",
              label: `Fleet & Generation Units (${facility?.units.length ?? 0})`,
            },
            { value: "granular", label: "Granular Time Series" },
            {
              value: "audit",
              label: (
                <>
                  Sanity Audits{" "}
                  {allAuditLogs.length > 0 && (
                    <Badge
                      variant="warning"
                      className="px-1.5 py-0 font-mono text-xs"
                    >
                      {allAuditLogs.length}
                    </Badge>
                  )}
                </>
              ),
            },
          ]}
        />

        <div className="space-y-4 pt-1">
          {isLoading ? (
            <PlantDialogLoading title="Loading comprehensive plant records..." />
          ) : activeTab === "overview" ? (
            <InspectOverviewPanel story={story} />
          ) : activeTab === "fleet" ? (
            <InspectFleetPanel units={facility?.units ?? []} />
          ) : activeTab === "emissions" ? (
            <InspectEmissionsPanel
              facilityId={facilityId}
              facility={facility}
              yearlyRollups={yearlyRollups}
              collapsedYears={collapsedYears}
              onToggleYear={toggleYearExpanded}
            />
          ) : activeTab === "granular" ? (
            facility ? (
              <GranularEmissionsWindow
                facilityId={facility.id}
                facilityName={facility.name}
                units={facility.units}
                availableYears={availableYears}
              />
            ) : null
          ) : activeTab === "audit" ? (
            <InspectAuditPanel auditLogs={allAuditLogs} />
          ) : null}
        </div>
      </PlantDialogScrollBody>
    </PlantDialogShell>
  );
}
