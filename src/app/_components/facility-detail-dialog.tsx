"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Car,
  CheckCircle2,
  ExternalLink,
  Flame,
  Gauge,
  Home,
  Leaf,
  MapPin,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { generatePlantStory } from "~/lib/plant-narrative";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { getFuelTheme } from "~/lib/map-utils";
import { type RouterOutputs } from "~/trpc/react";

export type FacilityDetailData = NonNullable<
  RouterOutputs["facilities"]["getFacility"]
>;
export type FacilityUnit = FacilityDetailData["units"][number];
export type FacilityAnnualRecord = FacilityDetailData["annualRecords"][number];
export type FacilityAuditLog = NonNullable<
  FacilityAnnualRecord["auditLogs"]
>[number];

interface FacilityDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: number | null;
  facility?: FacilityDetailData | null;
  isLoading: boolean;
}

export function FacilityDetailDialog({
  open,
  onOpenChange,
  facilityId,
  facility,
  isLoading,
}: FacilityDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<"units" | "emissions" | "audit">(
    "units",
  );

  const totalCapacityMW =
    facility?.units.reduce((acc, u) => acc + (u.nameplateCapacityMW ?? 0), 0) ??
    0;

  const latestRecord = facility?.annualRecords?.[0];
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
        co2Tons: latestRecord?.co2MassTons ?? 0,
        operatingHours: latestRecord?.operatingHours ?? 0,
        grossGenerationMWh: latestRecord?.grossGenerationMWh ?? 0,
        carbonIntensity: latestRecord?.co2IntensityLbsMWh ?? null,
        hasControls,
      })
    : null;

  const mapsUrl =
    facility?.latitude && facility?.longitude
      ? `https://maps.google.com/?q=${facility.latitude},${facility.longitude}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative flex h-[90dvh] max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden p-3.5 sm:h-auto sm:max-h-[90vh] sm:p-6">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg sm:right-5 sm:top-5"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader className="shrink-0 border-b border-edge pb-3 pr-10">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-400">
                ORISPL #{facility?.id ?? facilityId}
              </span>
              {facility?.nercRegion && (
                <Badge variant="sky" className="font-mono text-[10px]">
                  Grid: {facility.nercRegion}
                </Badge>
              )}
              {facility?.epaRegion && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  EPA Region {facility.epaRegion}
                </Badge>
              )}
              {facility?.sourceCategory && (
                <Badge variant="secondary" className="text-[10px]">
                  {facility.sourceCategory}
                </Badge>
              )}
            </div>
            <DialogTitle className="mt-1">
              {facility?.name ?? "Loading Facility Dossier..."}
            </DialogTitle>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span>Owner: {facility?.ownerOperator ?? "Unlisted"}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-fg-muted" />
                {facility?.county ? `${facility.county} Co., ` : ""}
                {facility?.stateCode}
              </span>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-sky-400 underline hover:text-sky-300"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="-mr-1 min-h-0 flex-1 space-y-3.5 overflow-y-auto py-2 pr-1 sm:space-y-4">
          {/* KPI Stats Row */}
          {facility && (
            <div className="grid grid-cols-2 gap-2 pt-2 text-xs sm:grid-cols-5 sm:gap-2.5">
              <div className="rounded-lg border border-edge bg-canvas p-2.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-fg-muted">
                  <Zap className="h-3 w-3 text-amber-400" />
                  Nameplate Capacity
                </span>
                <div className="mt-1 font-mono text-base font-bold text-fg">
                  {totalCapacityMW > 0
                    ? `${Math.round(totalCapacityMW).toLocaleString()} MW`
                    : "—"}
                </div>
                <span className="text-[10px] text-fg-muted">
                  {facility.units.length} total units
                </span>
              </div>

              <div className="rounded-lg border border-edge bg-canvas p-2.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-fg-muted">
                  <Activity className="h-3 w-3 text-emerald-400" />
                  2022 Generation
                </span>
                <div className="mt-1 font-mono text-base font-bold text-fg">
                  {latestRecord?.grossGenerationMWh
                    ? `${Math.round(latestRecord.grossGenerationMWh).toLocaleString()} MWh`
                    : "—"}
                </div>
                <span className="text-[10px] text-fg-muted">
                  {latestRecord?.operatingHours.toLocaleString() ?? 0} hrs dispatch
                </span>
              </div>

              <div className="rounded-lg border border-edge bg-canvas p-2.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-fg-muted">
                  <Flame className="h-3 w-3 text-amber-500" />
                  2022 CO₂ Mass
                </span>
                <div className="mt-1 font-mono text-base font-bold text-fg">
                  {latestRecord?.co2MassTons
                    ? `${Math.round(latestRecord.co2MassTons).toLocaleString()} t`
                    : "—"}
                </div>
                <span className="text-[10px] text-fg-muted">
                  Direct stack emissions
                </span>
              </div>

              <div className="rounded-lg border border-edge bg-canvas p-2.5">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-fg-muted">
                  <Gauge className="h-3 w-3 text-emerald-400" />
                  Carbon Intensity
                </span>
                <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                  {latestRecord?.co2IntensityLbsMWh
                    ? `${Math.round(latestRecord.co2IntensityLbsMWh)} lbs/MWh`
                    : "—"}
                </div>
                <span className="text-[10px] text-fg-muted">
                  {latestRecord?.heatRateMMBtuMWh
                    ? `${latestRecord.heatRateMMBtuMWh.toFixed(1)} MMBtu/MWh`
                    : "Thermal rate N/A"}
                </span>
              </div>

              <div className="col-span-2 rounded-lg border border-edge bg-canvas p-2.5 sm:col-span-1">
                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-fg-muted">
                  {allAuditLogs.length > 0 ? (
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  )}
                  Data Sanity Status
                </span>
                <div className="mt-1 text-sm font-bold">
                  {allAuditLogs.length > 0 ? (
                    <span className="font-mono text-amber-400">
                      {allAuditLogs.length} Flagged
                    </span>
                  ) : (
                    <span className="text-emerald-400">Verified Clean</span>
                  )}
                </div>
                <span className="text-[10px] text-fg-muted">
                  PRD 3.3 Rule Engine
                </span>
              </div>
            </div>
          )}

          {/* Plant Overview & Role Card */}
          {story && (
            <div className="space-y-2.5 rounded-lg border border-edge/80 bg-surface/30 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg">
                    Plant Overview & Role
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${story.roleInfo.badgeClass}`}
                  title={story.roleInfo.description}
                >
                  <span>{story.roleInfo.badgeLabel}</span>
                </span>
              </div>

              <p className="text-xs font-medium leading-relaxed text-fg-2">
                {story.headline}
              </p>

              <div className="grid grid-cols-1 gap-2 pt-0.5 text-[11px] sm:grid-cols-2">
                <div className="space-y-1 rounded-md border border-edge/60 bg-canvas/50 p-2.5">
                  <span className="mb-0.5 flex items-center gap-1.5 font-semibold text-sky-400">
                    <Zap className="h-3 w-3" />
                    Grid & Operational Role
                  </span>
                  <p className="leading-relaxed text-fg-muted">
                    {story.gridStory}
                  </p>
                </div>

                <div className="space-y-1 rounded-md border border-edge/60 bg-canvas/50 p-2.5">
                  <span className="mb-0.5 flex items-center gap-1.5 font-semibold text-emerald-400">
                    <Leaf className="h-3 w-3" />
                    Emissions & Footprint
                  </span>
                  <p className="leading-relaxed text-fg-muted">
                    {story.environmentalStory}
                  </p>
                </div>
              </div>

              {/* Real-World Equivalents */}
              <div className="flex flex-wrap items-center gap-3 border-t border-edge/60 pt-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-fg-2">
                  <Home className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    Powers{" "}
                    <strong className="text-fg">
                      {story.equivalents.homesPoweredFormatted}
                    </strong>
                  </span>
                </div>
                {story.equivalents.carsDrivenRaw > 0 && (
                  <div className="flex items-center gap-1.5 text-fg-2">
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

          {/* Tab Switcher */}
          <div className="sticky top-0 z-10 flex overflow-x-auto whitespace-nowrap border-b border-edge bg-surface/95 pt-1 text-xs font-medium backdrop-blur-md sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("units")}
              className={`cursor-pointer border-b-2 px-3.5 py-2 transition-colors ${
                activeTab === "units"
                  ? "border-emerald-400 font-semibold text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              Generation Fleet ({facility?.units.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("emissions")}
              className={`cursor-pointer border-b-2 px-3.5 py-2 transition-colors ${
                activeTab === "emissions"
                  ? "border-emerald-400 font-semibold text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              Emissions Timeline ({facility?.annualRecords.length ?? 0} Yrs)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-3.5 py-2 transition-colors ${
                activeTab === "audit"
                  ? "border-emerald-400 font-semibold text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              <span>Sanity Audits</span>
              {allAuditLogs.length > 0 && (
                <Badge
                  variant="warning"
                  className="px-1.5 py-0 font-mono text-[10px]"
                >
                  {allAuditLogs.length}
                </Badge>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="space-y-4 pt-2 text-xs">
            {isLoading ? (
              <div className="py-20 text-center text-fg-muted">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
                <p className="text-xs">Loading comprehensive plant records...</p>
              </div>
            ) : activeTab === "units" ? (
              facility?.units.length === 0 ? (
                <div className="rounded-lg border border-dashed border-edge p-8 text-center text-fg-muted">
                  No generation units recorded for this facility.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-edge bg-canvas">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-edge bg-surface/60">
                        <TableHead className="w-20">Unit ID</TableHead>
                        <TableHead>Type & Fuels</TableHead>
                        <TableHead>Operating Status</TableHead>
                        <TableHead className="text-right">Capacity (MW)</TableHead>
                        <TableHead>Environmental Controls</TableHead>
                        <TableHead className="w-28 text-right">Commissioned</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facility?.units.map((unit) => {
                        const isOperating = (unit.operatingStatus ?? "")
                          .toLowerCase()
                          .includes("op");
                        return (
                          <TableRow key={unit.id} className="hover:bg-surface/40">
                            <TableCell className="font-mono text-xs font-bold text-emerald-400">
                              Unit {unit.unitId}
                            </TableCell>

                            <TableCell>
                              <div className="font-medium text-fg">
                                {unit.unitType ?? "Combustion Generator"}
                              </div>
                              <div className="flex flex-wrap items-center gap-1 pt-1">
                                {unit.primaryFuel && (
                                  <Badge
                                    variant={getFuelTheme(unit.primaryFuel).variant}
                                    className="text-[10px]"
                                  >
                                    {unit.primaryFuel}
                                  </Badge>
                                )}
                                {unit.secondaryFuel && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Sec: {unit.secondaryFuel}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={isOperating ? "success" : "secondary"}
                                className="text-[10px]"
                              >
                                {unit.operatingStatus ?? "Operating"}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right font-mono font-bold text-fg-2">
                              {unit.nameplateCapacityMW
                                ? `${unit.nameplateCapacityMW} MW`
                                : "—"}
                            </TableCell>

                            <TableCell className="max-w-xs">
                              <div className="space-y-1 text-[11px]">
                                {unit.noxControls && (
                                  <div className="truncate text-fg-2">
                                    <span className="font-semibold text-fg-muted">
                                      NOx:
                                    </span>{" "}
                                    {unit.noxControls}
                                  </div>
                                )}
                                {unit.so2Controls && (
                                  <div className="truncate text-fg-2">
                                    <span className="font-semibold text-fg-muted">
                                      SO2:
                                    </span>{" "}
                                    {unit.so2Controls}
                                  </div>
                                )}
                                {!unit.noxControls && !unit.so2Controls && (
                                  <span className="text-fg-muted italic">
                                    No controls listed
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right font-mono text-[11px] text-fg-muted">
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
              facility?.annualRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed border-edge p-8 text-center text-fg-muted">
                  No annual emissions records available.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-edge bg-canvas">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-edge bg-surface/60">
                        <TableHead className="w-16">Year</TableHead>
                        <TableHead className="text-right">Generation (MWh)</TableHead>
                        <TableHead className="text-right">CO₂ (tons)</TableHead>
                        <TableHead className="text-right">Intensity (lbs/MWh)</TableHead>
                        <TableHead className="text-right">Heat Rate</TableHead>
                        <TableHead className="text-right">Op. Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facility?.annualRecords.map((rec) => (
                        <TableRow key={rec.id} className="hover:bg-surface/40">
                          <TableCell className="font-mono font-bold text-fg">
                            {rec.year}
                          </TableCell>
                          <TableCell className="text-right font-mono text-fg-2">
                            {rec.grossGenerationMWh
                              ? Math.round(rec.grossGenerationMWh).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-fg-2">
                            {rec.co2MassTons
                              ? Math.round(rec.co2MassTons).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-emerald-400">
                            {rec.co2IntensityLbsMWh
                              ? `${Math.round(rec.co2IntensityLbsMWh)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-fg-muted">
                            {rec.heatRateMMBtuMWh
                              ? `${rec.heatRateMMBtuMWh.toFixed(1)}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-fg-muted">
                            {rec.operatingHours
                              ? rec.operatingHours.toLocaleString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : activeTab === "audit" ? (
              allAuditLogs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-400">
                    All thermodynamic checks passed
                  </p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    No sanity violations detected for this facility.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-edge bg-canvas">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-edge bg-surface/60">
                        <TableHead className="w-20">Severity</TableHead>
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
                          <TableCell className="font-mono text-xs font-semibold text-fg">
                            {log.flagType}
                          </TableCell>
                          <TableCell className="max-w-md text-xs text-fg-muted">
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

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
