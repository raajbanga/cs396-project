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
  cleanOwnerOperator,
  formatCountyShort,
  generatePlantStory,
} from "~/lib/plant-narrative";
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
        <DialogClose onClose={() => onOpenChange(false)} />

        {/* Dialog Header */}
        <DialogHeader className="shrink-0 border-b border-edge pb-3 pr-10">
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
                  <Badge variant="secondary">
                    {facility.sourceCategory}
                  </Badge>
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
                  <span>{isInCompare ? "In Comparison" : "Add to Compare"}</span>
                </Button>
              )}
            </div>

            <DialogTitle className="mt-1">
              {facility?.name ?? "Loading Facility Dossier..."}
            </DialogTitle>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
              <span>Owner: {cleanOwnerOperator(facility?.ownerOperator ?? null)}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-fg-muted" />
                {facility?.county ? `${formatCountyShort(facility.county)}, ` : ""}
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
                  latestRecord?.grossGenerationMWh
                    ? `${Math.round(latestRecord.grossGenerationMWh).toLocaleString()} MWh`
                    : "—"
                }
                subtext={`${latestRecord?.operatingHours.toLocaleString() ?? 0} dispatch hrs`}
              />

              <StatTile
                label="CO₂ Mass"
                icon={<Flame className="h-3.5 w-3.5 text-amber-500" />}
                value={
                  latestRecord?.co2MassTons
                    ? `${Math.round(latestRecord.co2MassTons).toLocaleString()} t`
                    : "—"
                }
                subtext="Direct stack output"
              />

              <StatTile
                label="Intensity"
                icon={<Gauge className="h-3.5 w-3.5 text-emerald-400" />}
                value={
                  latestRecord?.co2IntensityLbsMWh
                    ? `${Math.round(latestRecord.co2IntensityLbsMWh)} lbs/MWh`
                    : "—"
                }
                valueClassName="text-emerald-400"
                subtext={
                  latestRecord?.heatRateMMBtuMWh
                    ? `${latestRecord.heatRateMMBtuMWh.toFixed(1)} MMBtu/MWh`
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
            <div className="space-y-3 rounded-lg border border-edge bg-surface/40 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-fg">
                    Plant Overview & Role
                  </span>
                </div>
                <PlantRoleBadge roleInfo={story.roleInfo} />
              </div>

              <p className="text-sm font-medium leading-relaxed text-fg">
                {story.headline}
              </p>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1 rounded-md border border-edge/60 bg-canvas/60 p-3">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                    <Zap className="h-3.5 w-3.5" />
                    Grid & Operational Dispatch
                  </span>
                  <p className="text-sm leading-relaxed text-fg-2">
                    {story.gridStory}
                  </p>
                </div>

                <div className="space-y-1 rounded-md border border-edge/60 bg-canvas/60 p-3">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <Leaf className="h-3.5 w-3.5" />
                    Environmental Footprint
                  </span>
                  <p className="text-sm leading-relaxed text-fg-2">
                    {story.environmentalStory}
                  </p>
                </div>
              </div>

              {/* Tangible Human Equivalents */}
              <div className="flex flex-wrap items-center gap-3 border-t border-edge/60 pt-2.5 text-xs">
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

          {/* Clean Segmented Tab Switcher */}
          <div className="sticky top-0 z-10 flex border-b border-edge bg-surface/95 pt-1 text-xs font-medium backdrop-blur-md sm:text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("units")}
              className={`cursor-pointer border-b-2 px-3.5 py-2 transition-colors ${
                activeTab === "units"
                  ? "border-emerald-400 font-semibold text-fg"
                  : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              Fleet Units ({facility?.units.length ?? 0})
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
              Annual Timeline ({facility?.annualRecords.length ?? 0} Yrs)
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
              <div className="py-20 text-center text-fg-muted">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-emerald-400" />
                <p className="text-xs sm:text-sm">
                  Loading comprehensive plant records...
                </p>
              </div>
            ) : activeTab === "units" ? (
              /* TAB 1: FLEET UNITS */
              facility?.units.length === 0 ? (
                <div className="rounded-lg border border-dashed border-edge p-8 text-center text-xs text-fg-muted">
                  No generation units recorded for this facility.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-edge bg-canvas">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-edge bg-surface/60">
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
                          <TableRow key={unit.id} className="hover:bg-surface/40">
                            <TableCell className="font-mono text-xs font-medium text-emerald-400">
                              Unit {unit.unitId}
                            </TableCell>

                            <TableCell>
                              <div className="font-medium text-fg">
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
                              <Badge variant={isOperating ? "success" : "secondary"}>
                                {unit.operatingStatus ?? "Operating"}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right font-mono font-semibold text-fg">
                              {unit.nameplateCapacityMW
                                ? `${unit.nameplateCapacityMW} MW`
                                : "—"}
                            </TableCell>

                            <TableCell className="max-w-xs">
                              <div className="space-y-0.5 text-xs">
                                {unit.noxControls && (
                                  <div className="truncate text-fg-2">
                                    <span className="font-medium text-fg-muted">
                                      NOx:
                                    </span>{" "}
                                    {unit.noxControls}
                                  </div>
                                )}
                                {unit.so2Controls && (
                                  <div className="truncate text-fg-2">
                                    <span className="font-medium text-fg-muted">
                                      SO₂:
                                    </span>{" "}
                                    {unit.so2Controls}
                                  </div>
                                )}
                                {!unit.noxControls && !unit.so2Controls && (
                                  <span className="text-fg-muted italic text-xs">
                                    No controls listed
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right font-mono text-xs text-fg-muted">
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
              facility?.annualRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed border-edge p-8 text-center text-xs text-fg-muted">
                  No annual emissions records available.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-edge bg-canvas">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-edge bg-surface/60">
                        <TableHead className="w-16">Year</TableHead>
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
                      {facility?.annualRecords.map((rec) => (
                        <TableRow key={rec.id} className="hover:bg-surface/40">
                          <TableCell className="font-mono font-medium text-fg">
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
                          <TableCell className="text-right">
                            <CarbonIntensityBadge
                              intensity={rec.co2IntensityLbsMWh}
                              showValue
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-fg-muted">
                            {rec.heatRateMMBtuMWh
                              ? `${rec.heatRateMMBtuMWh.toFixed(1)} MMBtu/MWh`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-fg-muted">
                            {rec.operatingHours
                              ? `${rec.operatingHours.toLocaleString()} hrs`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
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
                  <p className="mt-0.5 text-xs text-fg-muted">
                    No thermodynamic anomalies or reporting violations detected for this plant.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-edge bg-canvas">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-edge bg-surface/60">
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
                          <TableCell className="font-mono text-xs font-semibold text-fg">
                            {log.flagType}
                          </TableCell>
                          <TableCell className="max-w-md text-xs text-fg-2">
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
        <DialogFooter className="mt-auto flex items-center justify-end border-t border-edge pt-3">
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
