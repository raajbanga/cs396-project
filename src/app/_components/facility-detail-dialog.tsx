"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flame,
  Gauge,
  Home,
  Leaf,
  MapPin,
  RefreshCw,
  Scale,
  Sparkles,
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
import { PlantRoleBadge } from "~/components/ui/plant-role-badge";
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
  computeCo2IntensityLbsMWh,
  computeHeatRateMMBtuMWh,
} from "~/lib/emissions-metrics";
import {
  cleanOwnerOperator,
  formatCountyShort,
  generatePlantStory,
} from "~/lib/plant-narrative";
import { type RouterOutputs } from "~/trpc/react";

type FacilityDetailData = NonNullable<
  RouterOutputs["facilities"]["getFacility"]
>;
type FacilityAnnualRecord = FacilityDetailData["annualRecords"][number];

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
  const [activeTab, setActiveTab] = useState<"units" | "emissions" | "audit">(
    "units",
  );
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  const toggleYearExpanded = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const totalCapacityMW =
    facility?.units.reduce((acc, u) => acc + (u.nameplateCapacityMW ?? 0), 0) ??
    0;

  const yearlyRollups = useMemo(() => {
    if (!facility?.annualRecords?.length) return [];
    const map = new Map<
      number,
      {
        year: number;
        grossGenerationMWh: number;
        co2MassTons: number;
        so2MassTons: number;
        noxMassTons: number;
        heatInputMMBtu: number;
        operatingHours: number;
        maxOperatingHours: number;
        unitCount: number;
        records: FacilityAnnualRecord[];
      }
    >();

    for (const rec of facility.annualRecords) {
      let entry = map.get(rec.year);
      if (!entry) {
        entry = {
          year: rec.year,
          grossGenerationMWh: 0,
          co2MassTons: 0,
          so2MassTons: 0,
          noxMassTons: 0,
          heatInputMMBtu: 0,
          operatingHours: 0,
          maxOperatingHours: 0,
          unitCount: 0,
          records: [],
        };
        map.set(rec.year, entry);
      }
      entry.grossGenerationMWh += rec.grossGenerationMWh;
      entry.co2MassTons += rec.co2MassTons;
      entry.so2MassTons += rec.so2MassTons;
      entry.noxMassTons += rec.noxMassTons;
      entry.heatInputMMBtu += rec.heatInputMMBtu;
      entry.operatingHours += rec.operatingHours;
      if (rec.operatingHours > entry.maxOperatingHours) {
        entry.maxOperatingHours = rec.operatingHours;
      }
      entry.unitCount += 1;
      entry.records.push(rec);
    }

    return Array.from(map.values())
      .sort((a, b) => b.year - a.year)
      .map((entry) => ({
        ...entry,
        co2IntensityLbsMWh: computeCo2IntensityLbsMWh(
          entry.co2MassTons,
          entry.grossGenerationMWh,
        ),
        heatRateMMBtuMWh: computeHeatRateMMBtuMWh(
          entry.heatInputMMBtu,
          entry.grossGenerationMWh,
          1,
        ),
      }));
  }, [facility?.annualRecords]);

  // Automatically expand all reporting years so unit breakdown is visible immediately
  useEffect(() => {
    if (yearlyRollups.length > 0) {
      setExpandedYears(new Set(yearlyRollups.map((r) => r.year)));
    }
  }, [yearlyRollups]);

  const latestRollup = yearlyRollups[0];
  const allAuditLogs =
    facility?.annualRecords.flatMap((r) => r.auditLogs ?? []) ?? [];

  const primaryFuels = Array.from(
    new Set(facility?.units.map((u) => u.primaryFuel).filter(Boolean)),
  ) as string[];

  const hasControls =
    facility?.units.some((u) => Boolean(u.so2Controls ?? u.noxControls)) ??
    false;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative flex h-[90dvh] max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden p-3.5 sm:h-auto sm:max-h-[90vh] sm:p-6">
        <DialogClose onClose={() => onOpenChange(false)} />

        {/* Dialog Header */}
        <DialogHeader className="border-edge shrink-0 border-b pr-10 pb-3">
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
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="-mr-1 min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
          {/* Top 5 Key Stats Strip */}
          {facility && (
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5 sm:gap-2.5">
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
            </div>
          )}

          {/* Plant Overview & Real-World Impact */}
          {story && (
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
                  <p className="text-fg-2 text-sm leading-relaxed">
                    {story.gridStory}
                  </p>
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

              {/* Tangible Human Equivalents */}
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
          )}

          {/* Clean Segmented Tab Switcher */}
          <div className="border-edge bg-surface/95 sticky top-0 z-10 flex border-b pt-1 text-xs font-medium backdrop-blur-md sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("units")}
              className={`cursor-pointer border-b-2 px-3.5 py-2 transition-colors ${
                activeTab === "units"
                  ? "text-fg border-emerald-400 font-semibold"
                  : "text-fg-muted hover:text-fg border-transparent"
              }`}
            >
              Fleet Units ({facility?.units.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("emissions")}
              className={`cursor-pointer border-b-2 px-3.5 py-2 transition-colors ${
                activeTab === "emissions"
                  ? "text-fg border-emerald-400 font-semibold"
                  : "text-fg-muted hover:text-fg border-transparent"
              }`}
            >
              Annual Timeline ({yearlyRollups.length}{" "}
              {yearlyRollups.length === 1 ? "Yr" : "Yrs"})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-2 transition-colors ${
                activeTab === "audit"
                  ? "text-fg border-emerald-400 font-semibold"
                  : "text-fg-muted hover:text-fg border-transparent"
              }`}
            >
              <span>Sanity Audits</span>
              {allAuditLogs.length > 0 && (
                <Badge
                  variant="warning"
                  className="px-1.5 py-0 font-mono text-xs"
                >
                  {allAuditLogs.length}
                </Badge>
              )}
            </button>
          </div>

          {/* Tab Content Panes */}
          <div className="space-y-4 pt-1">
            {isLoading ? (
              <div className="text-fg-muted py-20 text-center">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
                <p className="text-xs sm:text-sm">
                  Loading comprehensive plant records...
                </p>
              </div>
            ) : activeTab === "units" ? (
              /* TAB 1: FLEET UNITS */
              facility?.units.length === 0 ? (
                <div className="border-edge text-fg-muted rounded-lg border border-dashed p-8 text-center text-xs">
                  No generation units recorded for this facility.
                </div>
              ) : (
                <div className="border-edge bg-canvas overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-edge bg-surface/60 border-b">
                        <TableHead className="w-24">Unit ID</TableHead>
                        <TableHead>Type & Primary Fuel</TableHead>
                        <TableHead>Operating Status</TableHead>
                        <TableHead className="text-right">
                          Capacity (MW)
                        </TableHead>
                        <TableHead>Air Quality Controls</TableHead>
                        <TableHead className="w-28 text-right">
                          Commissioned
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facility?.units.map((unit) => {
                        const isOperating = (unit.operatingStatus ?? "")
                          .toLowerCase()
                          .includes("op");
                        return (
                          <TableRow
                            key={unit.id}
                            className="hover:bg-surface/40"
                          >
                            <TableCell className="font-mono text-xs font-medium text-emerald-400">
                              Unit {unit.unitId}
                            </TableCell>

                            <TableCell>
                              <div className="text-fg font-medium">
                                {unit.unitType ?? "Combustion Generator"}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 pt-1">
                                {unit.primaryFuel && (
                                  <FuelBadge fuel={unit.primaryFuel} />
                                )}
                                {unit.secondaryFuel && (
                                  <Badge variant="secondary">
                                    Sec: {unit.secondaryFuel}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={isOperating ? "success" : "secondary"}
                              >
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
                                    <span className="text-fg-muted font-medium">
                                      NOx:
                                    </span>{" "}
                                    {unit.noxControls}
                                  </div>
                                )}
                                {unit.so2Controls && (
                                  <div className="text-fg-2 truncate">
                                    <span className="text-fg-muted font-medium">
                                      SO₂:
                                    </span>{" "}
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
                </div>
              )
            ) : activeTab === "emissions" ? (
              /* TAB 2: ANNUAL EMISSIONS */
              yearlyRollups.length === 0 ? (
                <div className="border-edge text-fg-muted rounded-lg border border-dashed p-8 text-center text-xs">
                  No annual emissions records available.
                </div>
              ) : (
                <div className="border-edge bg-canvas overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-edge bg-surface/60 border-b">
                        <TableHead className="w-40">Reporting Year</TableHead>
                        <TableHead className="text-right">
                          Generation (MWh)
                        </TableHead>
                        <TableHead className="text-right">
                          CO₂ Mass (tons)
                        </TableHead>
                        <TableHead className="text-right">
                          Intensity (lbs/MWh)
                        </TableHead>
                        <TableHead className="text-right">
                          Thermal Heat Rate
                        </TableHead>
                        <TableHead className="text-right">
                          Operating Hours
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {yearlyRollups.map((rollup) => {
                        const isExpanded = expandedYears.has(rollup.year);
                        const hasMultipleUnits = rollup.records.length > 1;

                        return (
                          <React.Fragment key={rollup.year}>
                            <TableRow
                              className={`hover:bg-surface/40 ${
                                hasMultipleUnits ? "cursor-pointer" : ""
                              }`}
                              onClick={() => {
                                if (hasMultipleUnits) {
                                  toggleYearExpanded(rollup.year);
                                }
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
                                  ? Math.round(
                                      rollup.grossGenerationMWh,
                                    ).toLocaleString()
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-fg text-right font-mono font-semibold">
                                {rollup.co2MassTons
                                  ? Math.round(
                                      rollup.co2MassTons,
                                    ).toLocaleString()
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

                            {/* Expanded Unit-Level Breakdown */}
                            {isExpanded &&
                              rollup.records.map((rec) => {
                                const unit =
                                  rec.unit ??
                                  facility?.units.find(
                                    (u) => u.id === rec.unitInternalId,
                                  );
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
                                        ? Math.round(
                                            rec.co2MassTons,
                                          ).toLocaleString()
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
                </div>
              )
            ) : activeTab === "audit" ? (
              /* TAB 3: SANITY AUDITS */
              allAuditLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                  <p className="text-sm font-semibold text-emerald-400">
                    All Physical Sanity Checks Clean
                  </p>
                  <p className="text-fg-muted mt-0.5 text-xs">
                    No thermodynamic anomalies or reporting violations detected
                    for this plant.
                  </p>
                </div>
              ) : (
                <div className="border-edge bg-canvas overflow-hidden rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-edge bg-surface/60 border-b">
                        <TableHead className="w-24">Severity</TableHead>
                        <TableHead>Rule Triggered</TableHead>
                        <TableHead>Audit Explanation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allAuditLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-surface/40">
                          <TableCell>
                            <Badge
                              variant={
                                log.severity === "ERROR"
                                  ? "destructive"
                                  : "warning"
                              }
                              className="px-2 py-0.5 font-mono text-xs"
                            >
                              {log.severity}
                            </Badge>
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
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="border-edge mt-auto flex items-center justify-end border-t pt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="font-medium"
          >
            Close Facility Dossier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
