"use client";

import { Activity, Building2, Flame, Gauge, Scale, Zap } from "lucide-react";
import { Badge, CarbonIntensityBadge, FuelBadge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Dialog, DialogTitle } from "~/components/ui/dialog";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  cleanOwnerOperator,
  formatCountyShort,
  isOperatingStatus,
} from "~/lib/plant-narrative";
import { DATASET_SOURCE_LABELS, formatQuantity } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";
import { AuditPanel } from "./audit-logs-table";
import { ReportTable, Section } from "./data-upload-dialog";

type UnitDetail = NonNullable<RouterOutputs["facilities"]["getUnit"]>;

const num = (value: number | null | undefined, digits = 0) =>
  formatQuantity(value, "", { digits, fallback: "0" });

/** §8.4 unit page: identification, fuel + controls, and the unit's history across every reporting year. */
export function UnitDetailDialog({
  unitInternalId,
  unit,
  isLoading,
  onClose,
  onInspectFacility,
  onToggleCompare,
  isInCompare,
}: {
  unitInternalId: string | null;
  unit?: UnitDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onInspectFacility: (facilityId: number) => void;
  onToggleCompare: (unitInternalId: string) => void;
  isInCompare: boolean;
}) {
  const records = unit?.annualRecords ?? [];
  const latest = records[0];
  const auditLogs = records.flatMap((r) => r.auditLogs);

  const identification: [string, string | null | undefined][] = unit
    ? [
        ["Unit type", unit.unitType],
        ["Operating status", unit.operatingStatus],
        ["Commissioned", unit.commercialOpDate],
        ["Retired", unit.retirementDate],
        [
          "Nameplate capacity",
          formatQuantity(unit.nameplateCapacityMW, "MW", { digits: 1 }),
        ],
        [
          "Max heat input rate",
          formatQuantity(unit.maxHourlyHIRate, "MMBtu/hr", { digits: 1 }),
        ],
        ["Programs", unit.programCode],
      ]
    : [];
  const fuelAndControls: [string, string | null | undefined][] = unit
    ? [
        ["Primary fuel", unit.primaryFuel],
        ["Secondary fuel", unit.secondaryFuel],
        ["SO₂ controls", unit.so2Controls],
        ["NOₓ controls", unit.noxControls],
        ["PM controls", unit.pmControls],
        ["Hg controls", unit.hgControls],
      ]
    : [];

  const details = (pairs: [string, string | null | undefined][]) => (
    <dl className="border-edge bg-canvas grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
      {pairs.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-fg-muted text-xs">{label}</dt>
          <dd className="text-fg-2 break-words">
            {value?.replaceAll("|", " · ") ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <Dialog
      open={unitInternalId !== null}
      onOpenChange={(open) => !open && onClose()}
      size="inspect"
      closeLabel="Close Unit Record"
      header={
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-emerald-400">
                ORISPL #{unit?.facilityId ?? "…"} · UNIT {unit?.unitId ?? "…"}
              </span>
              {unit?.primaryFuel && <FuelBadge fuel={unit.primaryFuel} />}
              {unit?.operatingStatus && (
                <Badge
                  variant={
                    isOperatingStatus(unit.operatingStatus)
                      ? "success"
                      : "secondary"
                  }
                >
                  {unit.operatingStatus}
                </Badge>
              )}
            </div>
            {unit && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInspectFacility(unit.facilityId)}
                  className="h-6 gap-1 px-2.5"
                >
                  <Building2 className="h-3 w-3 text-emerald-400" />
                  Facility Dossier
                </Button>
                <Button
                  variant={isInCompare ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onToggleCompare(unit.id)}
                  className="h-6 gap-1 px-2.5"
                >
                  <Scale className="h-3 w-3 text-emerald-400" />
                  {isInCompare ? "In Comparison" : "Add to Compare"}
                </Button>
              </div>
            )}
          </div>
          <DialogTitle>
            {unit
              ? `${unit.facility.name} · Unit ${unit.unitId}`
              : "Loading Unit Record..."}
          </DialogTitle>
          {unit && (
            <div className="text-fg-muted mt-1 text-xs">
              Owner: {cleanOwnerOperator(unit.facility.ownerOperator)} •{" "}
              {formatCountyShort(unit.facility.county)},{" "}
              {unit.facility.stateCode}
            </div>
          )}
        </>
      }
    >
      {isLoading || !unit ? (
        <InlineLoading title="Loading unit history..." className="py-20" />
      ) : (
        <>
          <KpiStrip>
            <StatTile
              label="Capacity"
              icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
              value={formatQuantity(unit.nameplateCapacityMW, "MW", {
                digits: 1,
              })}
              subtext={unit.unitType ?? "Unit type N/A"}
            />
            <StatTile
              label={`Gross Load ${latest?.year ?? ""}`}
              icon={<Activity className="h-3.5 w-3.5 text-emerald-400" />}
              value={formatQuantity(latest?.grossGenerationMWh, "MWh")}
              subtext={formatQuantity(latest?.operatingHours, "operating hrs")}
            />
            <StatTile
              label={`CO₂ ${latest?.year ?? ""}`}
              icon={<Flame className="h-3.5 w-3.5 text-amber-500" />}
              value={formatQuantity(latest?.co2MassTons, "t")}
              subtext={formatQuantity(latest?.heatInputMMBtu, "MMBtu")}
            />
            <StatTile
              label="Intensity"
              icon={<Gauge className="h-3.5 w-3.5 text-emerald-400" />}
              value={formatQuantity(latest?.co2IntensityLbsMWh, "lbs/MWh")}
              valueClassName="text-emerald-400"
              subtext={formatQuantity(latest?.heatRateMMBtuMWh, "MMBtu/MWh", {
                digits: 2,
                fallback: "Heat rate N/A",
              })}
            />
            <StatTile
              label="History"
              value={`${records.length} ${records.length === 1 ? "year" : "years"}`}
              subtext={
                records.length
                  ? `${records.at(-1)!.year}–${records[0]!.year}`
                  : "No records"
              }
              className="col-span-2 sm:col-span-1"
            />
          </KpiStrip>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section title="Identification">{details(identification)}</Section>
            <Section title="Fuel & Controls">
              {details(fuelAndControls)}
            </Section>
          </div>

          <Section
            title="Operating Data & Emissions by Year"
            note="One row per reporting year, with the dataset each record came from."
          >
            {records.length === 0 ? (
              <EmptyState title="No annual records for this unit." />
            ) : (
              <ReportTable
                head={[
                  "Year",
                  "Op. hrs",
                  "Gross MWh",
                  "Heat MMBtu",
                  "Steam klb",
                  "CO₂ t",
                  "SO₂ t",
                  "NOₓ t",
                  "lbs/MWh",
                  "MMBtu/MWh",
                  "Source",
                ]}
                rows={records.map((r) => [
                  <span key="y" className="text-fg font-semibold">
                    {r.year}
                    {r.auditLogs.length > 0 && (
                      <Badge
                        variant="warning"
                        className="ml-1.5 px-1 py-0 font-sans"
                        title={r.auditLogs.map((l) => l.details).join("\n")}
                      >
                        {r.auditLogs.length}
                      </Badge>
                    )}
                  </span>,
                  num(r.operatingHours),
                  num(r.grossGenerationMWh),
                  num(r.heatInputMMBtu),
                  num(r.steamLoadKlb),
                  num(r.co2MassTons),
                  num(r.so2MassTons, 1),
                  num(r.noxMassTons, 1),
                  <CarbonIntensityBadge
                    key="i"
                    intensity={r.co2IntensityLbsMWh}
                    showValue
                  />,
                  formatQuantity(r.heatRateMMBtuMWh, "", { digits: 2 }),
                  <span key="s" className="font-sans" title={r.dataset?.name}>
                    {r.dataset
                      ? `${DATASET_SOURCE_LABELS[r.dataset.source] ?? r.dataset.source} · ${new Date(r.dataset.importedAt).toLocaleDateString()}`
                      : "—"}
                  </span>,
                ])}
              />
            )}
          </Section>

          <Section title="Sanity Audits">
            <AuditPanel logs={auditLogs} />
          </Section>
        </>
      )}
    </Dialog>
  );
}
