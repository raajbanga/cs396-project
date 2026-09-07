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
  MapPin,
  RefreshCw,
  Sparkles,
  Trees,
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

  // Aggregated metrics
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
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col p-6">
        <DialogHeader className="border-b border-zinc-800 pb-3">
          <div className="flex w-full flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
              <DialogTitle className="mt-1 text-xl font-bold text-white">
                {facility?.name ?? "Loading Facility Dossier..."}
              </DialogTitle>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span>Owner: {facility?.ownerOperator ?? "Unlisted"}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-zinc-500" />
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

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Quick KPI Stats Row */}
        {facility && (
          <div className="grid grid-cols-2 gap-2.5 pt-3 text-xs sm:grid-cols-5">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase">
                <Zap className="h-3 w-3 text-amber-400" />
                Nameplate Capacity
              </span>
              <div className="mt-1 font-mono text-base font-bold text-zinc-100">
                {totalCapacityMW > 0
                  ? `${Math.round(totalCapacityMW).toLocaleString()} MW`
                  : "—"}
              </div>
              <span className="text-[10px] text-zinc-400">
                {facility.units.length} total units
              </span>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase">
                <Activity className="h-3 w-3 text-emerald-400" />
                2022 Generation
              </span>
              <div className="mt-1 font-mono text-base font-bold text-zinc-100">
                {latestRecord?.grossGenerationMWh
                  ? `${Math.round(latestRecord.grossGenerationMWh).toLocaleString()} MWh`
                  : "—"}
              </div>
              <span className="text-[10px] text-zinc-400">
                {latestRecord?.operatingHours.toLocaleString() ?? 0} hrs
                dispatch
              </span>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase">
                <Flame className="h-3 w-3 text-amber-500" />
                2022 CO2 Mass
              </span>
              <div className="mt-1 font-mono text-base font-bold text-zinc-100">
                {latestRecord?.co2MassTons
                  ? `${Math.round(latestRecord.co2MassTons).toLocaleString()} t`
                  : "—"}
              </div>
              <span className="text-[10px] text-zinc-400">
                Direct stack emissions
              </span>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase">
                <Gauge className="h-3 w-3 text-emerald-400" />
                Carbon Intensity
              </span>
              <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                {latestRecord?.co2IntensityLbsMWh
                  ? `${Math.round(latestRecord.co2IntensityLbsMWh)} lbs/MWh`
                  : "—"}
              </div>
              <span className="text-[10px] text-zinc-400">
                {latestRecord?.heatRateMMBtuMWh
                  ? `${latestRecord.heatRateMMBtuMWh.toFixed(1)} MMBtu/MWh`
                  : "Thermal rate N/A"}
              </span>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase">
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
              <span className="text-[10px] text-zinc-400">
                PRD 3.3 Rule Engine
              </span>
            </div>
          </div>
        )}

        {/* What is Happening at This Plant? - Plain-English Storytelling Card */}
        {story && (
          <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-xs font-bold tracking-wider text-white uppercase">
                  What is Happening at This Plant?
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${story.roleInfo.badgeClass}`}
                title={story.roleInfo.description}
              >
                <span>{story.roleInfo.badgeLabel}</span>
              </span>
            </div>

            <p className="text-xs leading-relaxed font-medium text-zinc-100">
              {story.headline}
            </p>

            <div className="grid grid-cols-1 gap-3 pt-1 text-[11px] md:grid-cols-2">
              <div className="space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3">
                <span className="mb-1 block font-semibold text-sky-400">
                  ⚡ Grid & Operational Role
                </span>
                <p className="leading-relaxed text-zinc-300">
                  {story.gridStory}
                </p>
              </div>

              <div className="space-y-1 rounded-lg border border-zinc-800/60 bg-zinc-950/60 p-3">
                <span className="mb-1 block font-semibold text-emerald-400">
                  🌱 Emissions & Environmental Footprint
                </span>
                <p className="leading-relaxed text-zinc-300">
                  {story.environmentalStory}
                </p>
              </div>
            </div>

            {/* Tangible Real-World Equivalents Bar */}
            <div className="flex flex-wrap items-center gap-4 border-t border-zinc-800/60 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Home className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  Powers{" "}
                  <strong className="text-white">
                    {story.equivalents.homesPoweredFormatted}
                  </strong>
                </span>
              </div>
              {story.equivalents.carsDrivenRaw > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Car className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span>
                    Emissions equal{" "}
                    <strong className="text-white">
                      {story.equivalents.carsDrivenFormatted}
                    </strong>
                  </span>
                </div>
              )}
              {story.equivalents.treesNeededRaw > 0 && (
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Trees className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>
                    Offset requires{" "}
                    <strong className="text-white">
                      {story.equivalents.treesNeededFormatted}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-800 pt-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("units")}
            className={`cursor-pointer border-b-2 px-4 py-2 transition-colors ${
              activeTab === "units"
                ? "border-emerald-400 font-semibold text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Generation Fleet ({facility?.units.length ?? 0} Units)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("emissions")}
            className={`cursor-pointer border-b-2 px-4 py-2 transition-colors ${
              activeTab === "emissions"
                ? "border-emerald-400 font-semibold text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            CEMS Emissions Timeline ({facility?.annualRecords.length ?? 0}{" "}
            Years)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`flex cursor-pointer items-center gap-1.5 border-b-2 px-4 py-2 transition-colors ${
              activeTab === "audit"
                ? "border-emerald-400 font-semibold text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Physical Sanity Audits</span>
            {allAuditLogs.length > 0 && (
              <Badge
                variant="warning"
                className="px-1 py-0 font-mono text-[9px]"
              >
                {allAuditLogs.length}
              </Badge>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="mt-2 flex-1 space-y-4 overflow-y-auto pr-1 text-xs">
          {isLoading ? (
            <div className="py-20 text-center text-zinc-400">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
              <p className="text-xs">Loading comprehensive plant records...</p>
            </div>
          ) : activeTab === "units" ? (
            /* TAB 1: GENERATION FLEET UNITS */
            facility?.units.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-zinc-400">
                No generation units recorded for this facility.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-zinc-800 bg-zinc-900/60">
                      <TableHead className="w-20">Unit ID</TableHead>
                      <TableHead>Type & Fuels</TableHead>
                      <TableHead>Operating Status</TableHead>
                      <TableHead className="text-right">
                        Capacity (MW)
                      </TableHead>
                      <TableHead>Environmental Controls</TableHead>
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
                          className="hover:bg-zinc-900/40"
                        >
                          <TableCell className="font-mono text-xs font-bold text-emerald-400">
                            Unit {unit.unitId}
                          </TableCell>

                          <TableCell>
                            <div className="font-medium text-zinc-100">
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
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
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

                          <TableCell className="text-right font-mono font-bold text-zinc-200">
                            {unit.nameplateCapacityMW
                              ? `${unit.nameplateCapacityMW} MW`
                              : "—"}
                          </TableCell>

                          <TableCell className="max-w-xs">
                            <div className="space-y-1 text-[11px]">
                              {unit.noxControls && (
                                <div className="truncate text-zinc-300">
                                  <span className="font-semibold text-zinc-500">
                                    NOx:
                                  </span>{" "}
                                  {unit.noxControls}
                                </div>
                              )}
                              {unit.so2Controls && (
                                <div className="truncate text-zinc-300">
                                  <span className="font-semibold text-zinc-500">
                                    SO2:
                                  </span>{" "}
                                  {unit.so2Controls}
                                </div>
                              )}
                              {unit.pmControls && (
                                <div className="truncate text-zinc-400">
                                  <span className="font-semibold text-zinc-500">
                                    PM:
                                  </span>{" "}
                                  {unit.pmControls}
                                </div>
                              )}
                              {!unit.noxControls &&
                                !unit.so2Controls &&
                                !unit.pmControls && (
                                  <span className="text-zinc-600">
                                    Standard / Uncontrolled
                                  </span>
                                )}
                            </div>
                          </TableCell>

                          <TableCell className="text-right font-mono text-zinc-400">
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
            /* TAB 2: CEMS EMISSIONS TIMELINE */
            facility?.annualRecords.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center text-zinc-400">
                No annual emissions records synced yet. Run CAMPD sync to
                ingest.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-zinc-800 bg-zinc-900/60">
                      <TableHead className="w-16">Year</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Gross Generation</TableHead>
                      <TableHead>Heat Input</TableHead>
                      <TableHead>CO2 Mass</TableHead>
                      <TableHead>Carbon Intensity</TableHead>
                      <TableHead className="text-right">Heat Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="font-mono text-xs">
                    {facility?.annualRecords.map((r) => (
                      <TableRow key={r.id} className="hover:bg-zinc-900/40">
                        <TableCell className="font-bold text-white">
                          {r.year}
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          {r.operatingHours.toLocaleString()} hrs
                        </TableCell>
                        <TableCell className="font-semibold text-zinc-100">
                          {r.grossGenerationMWh.toLocaleString()} MWh
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {r.heatInputMMBtu.toLocaleString()} MMBtu
                        </TableCell>
                        <TableCell className="font-bold text-amber-400">
                          {r.co2MassTons.toLocaleString()} t
                        </TableCell>
                        <TableCell className="text-emerald-400">
                          {r.co2IntensityLbsMWh
                            ? `${Math.round(r.co2IntensityLbsMWh)} lbs/MWh`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-zinc-300">
                          {r.heatRateMMBtuMWh
                            ? `${r.heatRateMMBtuMWh.toFixed(2)} MMBtu/MWh`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : /* TAB 3: PHYSICAL SANITY & QUALITY AUDIT */
          allAuditLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-12 text-center">
              <CheckCircle2 className="mb-2 h-10 w-10 text-emerald-400" />
              <h4 className="text-sm font-bold text-emerald-300">
                Zero Sanity Violations Recorded
              </h4>
              <p className="mt-1 max-w-md text-xs text-zinc-400">
                All apportioned generation, heat input, and emissions data
                passed PRD Section 3.3 automated thermodynamic validation rules.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-zinc-800 bg-zinc-900/60">
                    <TableHead className="w-20">Severity</TableHead>
                    <TableHead>Rule Triggered</TableHead>
                    <TableHead>Audit Explanation</TableHead>
                    <TableHead className="w-24 text-right">Logged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAuditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge
                          variant={
                            log.severity === "ERROR" ? "destructive" : "warning"
                          }
                        >
                          {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-white">
                        {log.flagType}
                      </TableCell>
                      <TableCell className="max-w-lg text-zinc-300">
                        {log.details}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-zinc-500">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-zinc-800 pt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close Dossier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
