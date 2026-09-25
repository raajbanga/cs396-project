"use client";

import { Fragment, useMemo, useState } from "react";
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
  Scale,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  Badge,
  CarbonIntensityBadge,
  FuelBadge,
  PlantRoleBadge,
} from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { DataPanel } from "~/components/ui/data-panel";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
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
import { buildYearlyRollups, type YearlyRollup } from "~/lib/emissions-metrics";
import {
  cleanOwnerOperator,
  formatCountyShort,
  generatePlantStory,
  hasAirQualityControls,
  isOperatingStatus,
} from "~/lib/plant-narrative";
import { cn, formatQuantity } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import { AuditPanel } from "./audit-logs-table";
import { GranularEmissionsWindow } from "./granular-emissions-window";

type FacilityDetail = NonNullable<RouterOutputs["facilities"]["getFacility"]>;
type PlantStory = ReturnType<typeof generatePlantStory>;
type DetailTab = "overview" | "emissions" | "fleet" | "granular" | "audit";

function OverviewPanel({ story }: { story: PlantStory }) {
  const sections = [
    {
      icon: Zap,
      tone: "text-sky-400",
      title: "Grid & Operational Dispatch",
      text: story.gridStory,
    },
    {
      icon: Leaf,
      tone: "text-emerald-400",
      title: "Environmental Footprint",
      text: story.environmentalStory,
    },
  ];
  return (
    <div className="border-edge bg-surface/40 space-y-3 rounded-lg border p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-fg flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          Plant Overview & Role
        </span>
        <PlantRoleBadge roleInfo={story.roleInfo} />
      </div>
      <p className="text-fg text-sm leading-relaxed font-medium">
        {story.headline}
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {sections.map(({ icon: Icon, tone, title, text }) => (
          <div
            key={title}
            className="border-edge/60 bg-canvas/60 space-y-1 rounded-md border p-3"
          >
            <span
              className={cn(
                "mb-1 flex items-center gap-1.5 text-xs font-semibold",
                tone,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {title}
            </span>
            <p className="text-fg-2 text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <div className="border-edge/60 text-fg-2 flex flex-wrap items-center gap-3 border-t pt-2.5 text-xs">
        <span className="flex items-center gap-1.5">
          <Home className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          Powers{" "}
          <strong className="text-fg">
            {story.equivalents.homesPoweredFormatted}
          </strong>
        </span>
        {story.equivalents.carsDrivenRaw > 0 && (
          <span className="flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            Emissions ≈{" "}
            <strong className="text-fg">
              {story.equivalents.carsDrivenFormatted}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}

function FleetPanel({ units }: { units: FacilityDetail["units"] }) {
  if (units.length === 0) {
    return (
      <EmptyState title="No generation units recorded for this facility." />
    );
  }
  return (
    <DataPanel>
      <Table>
        <TableHeader>
          <TableRow>
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
            const controls = [
              ["NOₓ", unit.noxControls],
              ["SO₂", unit.so2Controls],
            ].filter(([, value]) => value);
            return (
              <TableRow key={unit.id}>
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
                  <Badge
                    variant={
                      isOperatingStatus(unit.operatingStatus)
                        ? "success"
                        : "secondary"
                    }
                  >
                    {unit.operatingStatus ?? "Operating"}
                  </Badge>
                </TableCell>
                <TableCell className="text-fg text-right font-mono font-semibold">
                  {formatQuantity(unit.nameplateCapacityMW, "MW", {
                    digits: 2,
                  })}
                </TableCell>
                <TableCell className="max-w-xs space-y-0.5 text-xs">
                  {controls.length === 0 ? (
                    <span className="text-fg-muted italic">
                      No controls listed
                    </span>
                  ) : (
                    controls.map(([label, value]) => (
                      <div key={label} className="text-fg-2 truncate">
                        <span className="text-fg-muted font-medium">
                          {label}:
                        </span>{" "}
                        {value}
                      </div>
                    ))
                  )}
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

/** Generation, CO₂, intensity, heat-rate, and hours cells shared by year and unit rows. */
function EmissionCells({
  rec,
  hours,
  sub,
}: {
  rec: Pick<
    YearlyRollup,
    | "grossGenerationMWh"
    | "co2MassTons"
    | "co2IntensityLbsMWh"
    | "heatRateMMBtuMWh"
  >;
  hours: number;
  sub?: boolean;
}) {
  const numeric = cn(
    "text-right font-mono",
    sub ? "text-fg-2 text-xs" : "text-fg font-semibold",
  );
  const muted = cn(
    "text-fg-muted text-right font-mono",
    sub ? "text-[11px]" : "text-xs",
  );
  return (
    <>
      <TableCell className={numeric}>
        {formatQuantity(rec.grossGenerationMWh, "", {
          fallback: sub ? "0" : "—",
        })}
      </TableCell>
      <TableCell className={numeric}>
        {formatQuantity(rec.co2MassTons, "", { fallback: sub ? "0" : "—" })}
      </TableCell>
      <TableCell className="text-right">
        <CarbonIntensityBadge intensity={rec.co2IntensityLbsMWh} showValue />
      </TableCell>
      <TableCell className={muted}>
        {formatQuantity(rec.heatRateMMBtuMWh, "MMBtu/MWh", { digits: 1 })}
      </TableCell>
      <TableCell className={muted}>
        {formatQuantity(hours, "hrs", { fallback: sub ? "0 hrs" : "—" })}
      </TableCell>
    </>
  );
}

function EmissionsPanel({ rollups }: { rollups: YearlyRollup[] }) {
  const [collapsedYears, setCollapsedYears] = useState<Set<number>>(new Set());

  if (rollups.length === 0) {
    return <EmptyState title="No annual emissions records available." />;
  }

  const toggleYear = (year: number) =>
    setCollapsedYears((prev) => {
      const next = new Set(prev);
      if (!next.delete(year)) next.add(year);
      return next;
    });

  return (
    <DataPanel>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Reporting Year</TableHead>
            <TableHead className="text-right">Generation (MWh)</TableHead>
            <TableHead className="text-right">CO₂ Mass (tons)</TableHead>
            <TableHead className="text-right">Intensity (lbs/MWh)</TableHead>
            <TableHead className="text-right">Thermal Heat Rate</TableHead>
            <TableHead className="text-right">Operating Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rollups.map((rollup) => {
            const isExpanded = !collapsedYears.has(rollup.year);
            const expandable = rollup.records.length > 1;
            return (
              <Fragment key={rollup.year}>
                <TableRow
                  className={cn(expandable && "cursor-pointer")}
                  onClick={
                    expandable ? () => toggleYear(rollup.year) : undefined
                  }
                >
                  <TableCell className="text-fg font-mono font-medium">
                    <div className="flex items-center gap-1.5">
                      {expandable &&
                        (isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <ChevronRight className="text-fg-muted h-3.5 w-3.5" />
                        ))}
                      {rollup.year}
                      <Badge
                        variant="outline"
                        className="px-1 py-0 font-sans text-[10px]"
                      >
                        {rollup.unitCount}{" "}
                        {rollup.unitCount === 1 ? "unit" : "units"}
                      </Badge>
                    </div>
                  </TableCell>
                  <EmissionCells
                    rec={rollup}
                    hours={rollup.maxOperatingHours}
                  />
                </TableRow>

                {isExpanded &&
                  rollup.records.map((rec) => (
                    <TableRow
                      key={rec.id}
                      className="bg-surface/25 text-fg-2 text-xs"
                    >
                      <TableCell className="pl-8 font-mono text-xs">
                        <span className="font-semibold text-emerald-400">
                          Unit {rec.unit?.unitId ?? "—"}
                        </span>
                        {rec.unit?.primaryFuel && (
                          <span className="text-fg-muted ml-1.5 text-[10px]">
                            ({rec.unit.primaryFuel})
                          </span>
                        )}
                      </TableCell>
                      <EmissionCells
                        rec={{
                          ...rec,
                          co2IntensityLbsMWh: rec.co2IntensityLbsMWh ?? null,
                          heatRateMMBtuMWh: rec.heatRateMMBtuMWh ?? null,
                        }}
                        hours={rec.operatingHours}
                        sub
                      />
                    </TableRow>
                  ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </DataPanel>
  );
}

export function FacilityDetailDialog({
  facilityId,
  facility,
  isLoading,
  onClose,
  onToggleCompare,
  isInCompare,
}: {
  facilityId: number | null;
  facility?: FacilityDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onToggleCompare: (id: number) => void;
  isInCompare: boolean;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const rollups = useMemo(
    () => buildYearlyRollups(facility?.annualRecords),
    [facility?.annualRecords],
  );
  const latest = rollups[0];
  const units = facility?.units ?? [];
  const totalCapacityMW = units.reduce(
    (acc, u) => acc + (u.nameplateCapacityMW ?? 0),
    0,
  );
  const auditLogs = facility?.annualRecords.flatMap((r) => r.auditLogs) ?? [];
  const flagged = auditLogs.length > 0;

  const story =
    facility &&
    generatePlantStory({
      ...facility,
      totalCapacityMW,
      primaryFuels: [
        ...new Set(
          units.map((u) => u.primaryFuel).filter((f): f is string => !!f),
        ),
      ],
      co2Tons: latest?.co2MassTons ?? 0,
      operatingHours: latest?.maxOperatingHours ?? 0,
      grossGenerationMWh: latest?.grossGenerationMWh ?? 0,
      carbonIntensity: latest?.co2IntensityLbsMWh ?? null,
      hasControls: units.some(hasAirQualityControls),
      year: latest?.year,
    });

  const mapsUrl =
    facility?.latitude && facility.longitude
      ? `https://maps.google.com/?q=${facility.latitude},${facility.longitude}`
      : null;

  const panel = () => {
    if (isLoading || !facility || !story) {
      return (
        <InlineLoading
          title="Loading comprehensive plant records..."
          className="py-20"
        />
      );
    }
    switch (activeTab) {
      case "overview":
        return <OverviewPanel story={story} />;
      case "fleet":
        return <FleetPanel units={units} />;
      case "emissions":
        return <EmissionsPanel key={facility.id} rollups={rollups} />;
      case "granular":
        return (
          <GranularEmissionsWindow
            plants={[
              {
                id: facility.id,
                name: facility.name,
                units,
                availableYears: rollups.map((r) => r.year),
              },
            ]}
          />
        );
      case "audit":
        return <AuditPanel logs={auditLogs} />;
    }
  };

  return (
    <Dialog
      open={facilityId !== null}
      onOpenChange={(open) => !open && onClose()}
      size="inspect"
      closeLabel="Close Facility Dossier"
      header={
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-emerald-400">
                ORISPL #{facility?.id ?? facilityId}
              </span>
              {facility?.nercRegion && (
                <Badge variant="sky" className="font-mono">
                  Grid: {facility.nercRegion}
                </Badge>
              )}
              {facility?.epaRegion && (
                <Badge variant="outline" className="font-mono">
                  EPA Region {facility.epaRegion}
                </Badge>
              )}
              {facility?.sourceCategory && (
                <Badge variant="secondary">{facility.sourceCategory}</Badge>
              )}
            </div>
            {facility && (
              <Button
                variant={isInCompare ? "secondary" : "outline"}
                size="sm"
                onClick={() => onToggleCompare(facility.id)}
                className="h-6 gap-1 px-2.5"
              >
                <Scale className="h-3 w-3 text-emerald-400" />
                {isInCompare ? "In Comparison" : "Add to Compare"}
              </Button>
            )}
          </div>

          <DialogTitle>
            {facility?.name ?? "Loading Facility Dossier..."}
          </DialogTitle>

          <div className="text-fg-muted mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span>Owner: {cleanOwnerOperator(facility?.ownerOperator)}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {facility?.county && `${formatCountyShort(facility.county)}, `}
              {facility?.stateCode}
            </span>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-sky-400 underline hover:text-sky-300"
              >
                Google Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </>
      }
    >
      {facility && (
        <KpiStrip>
          <StatTile
            label="Capacity"
            icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
            value={formatQuantity(totalCapacityMW, "MW")}
            subtext={`${units.length} total units`}
          />
          <StatTile
            label="Generation"
            icon={<Activity className="h-3.5 w-3.5 text-emerald-400" />}
            value={formatQuantity(latest?.grossGenerationMWh, "MWh")}
            subtext={
              latest
                ? formatQuantity(latest.maxOperatingHours, "dispatch hrs")
                : "—"
            }
          />
          <StatTile
            label="CO₂ Mass"
            icon={<Flame className="h-3.5 w-3.5 text-amber-500" />}
            value={formatQuantity(latest?.co2MassTons, "t")}
            subtext={formatQuantity(latest?.heatInputMMBtu, "MMBtu", {
              fallback: "Direct stack output",
            })}
          />
          <StatTile
            label="Intensity"
            icon={<Gauge className="h-3.5 w-3.5 text-emerald-400" />}
            value={formatQuantity(latest?.co2IntensityLbsMWh, "lbs/MWh")}
            valueClassName="text-emerald-400"
            subtext={formatQuantity(latest?.heatRateMMBtuMWh, "MMBtu/MWh", {
              digits: 1,
              fallback: "Heat rate N/A",
            })}
          />
          <StatTile
            label="Sanity Audit"
            icon={
              flagged ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              )
            }
            value={flagged ? `${auditLogs.length} Flagged` : "Clean"}
            valueClassName={flagged ? "text-amber-400" : "text-emerald-400"}
            subtext="Thermodynamic audit"
            className="col-span-2 sm:col-span-1"
          />
        </KpiStrip>
      )}

      <SegmentedControl
        variant="tabs"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "overview", label: "Plant Overview" },
          {
            value: "emissions",
            label: `Emissions & Air Quality (${rollups.length} ${rollups.length === 1 ? "Yr" : "Yrs"})`,
          },
          {
            value: "fleet",
            label: `Fleet & Generation Units (${units.length})`,
          },
          { value: "granular", label: "Granular Time Series" },
          {
            value: "audit",
            label: (
              <>
                Sanity Audits{" "}
                {flagged && (
                  <Badge variant="warning" className="px-1.5 py-0 font-mono">
                    {auditLogs.length}
                  </Badge>
                )}
              </>
            ),
          },
        ]}
      />

      <div className="space-y-4 pt-1">{panel()}</div>
    </Dialog>
  );
}
