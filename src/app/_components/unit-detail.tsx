"use client";

import { use } from "react";
import { Badge, FuelBadge } from "~/components/ui/badge";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { DialogHeader } from "~/components/ui/dialog";
import { DetailList, ReportTable, Section } from "~/components/ui/report";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { cleanOwnerOperator, formatCountyShort } from "~/lib/plant-narrative";
import {
  datasetOriginLabel,
  formatNumber,
  formatQuantity,
  plural,
} from "~/lib/utils";
import { api } from "~/trpc/react";
import { CompareActions } from "./compare-view";
import { DetailLink } from "./detail-link";
import { SelectionContext } from "./selection-context";
import { AuditPanel, flagsOfRecords } from "./audit-logs-table";

/** §8.4 / §9 unit detail (in the detail dialog): identification, fuel and controls, and every reporting year (2015 on). */
export function UnitDetail({ unitInternalId }: { unitInternalId: string }) {
  const { compareUnitIds, toggleUnitCompare } = use(SelectionContext);
  const { data: unit, isLoading } = api.facilities.getUnit.useQuery({
    id: unitInternalId,
  });

  if (isLoading) return <InlineLoading title="Loading unit…" />;
  if (!unit) {
    return (
      <EmptyState
        title="This unit is not in the database"
        description="It may not have been retrieved or uploaded yet."
      />
    );
  }

  const records = unit.annualRecords;
  const latest = records[0];
  const auditLogs = flagsOfRecords(records, unit.unitId);
  const clean = (v: string | null | undefined) =>
    v ? v.replaceAll("|", " · ") : "—";

  const identification: [string, React.ReactNode][] = [
    [
      "Facility",
      <DetailLink key="f" view={{ kind: "facility", id: unit.facilityId }}>
        {unit.facility.name} ({unit.facilityId})
      </DetailLink>,
    ],
    ["EPA unit ID", unit.unitId],
    ["Unit type", clean(unit.unitType)],
    ["Operating status", clean(unit.operatingStatus)],
    ["Commissioned", clean(unit.commercialOpDate)],
    ["Retired", clean(unit.retirementDate)],
    [
      "Nameplate capacity",
      formatQuantity(unit.nameplateCapacityMW, "MW", { digits: 1 }),
    ],
    [
      "Max heat input rate",
      formatQuantity(unit.maxHourlyHIRate, "MMBtu/hr", { digits: 1 }),
    ],
    ["Programs", clean(unit.programCode)],
  ];
  const fuelAndControls: [string, React.ReactNode][] = [
    [
      "Primary fuel",
      unit.primaryFuel ? <FuelBadge fuel={unit.primaryFuel} /> : "—",
    ],
    ["Secondary fuel", clean(unit.secondaryFuel)],
    ["SO₂ controls", clean(unit.so2Controls)],
    ["NOₓ controls", clean(unit.noxControls)],
    ["PM controls", clean(unit.pmControls)],
    ["Hg controls", clean(unit.hgControls)],
  ];

  return (
    <div className="space-y-8">
      <DialogHeader
        context={
          <>
            <DetailLink
              view={{ kind: "facility", id: unit.facilityId }}
              className="hover:text-fg"
            >
              {unit.facility.name}
            </DetailLink>{" "}
            · Unit
          </>
        }
        title={`${unit.facility.name}, unit ${unit.unitId}`}
        lead={`${cleanOwnerOperator(unit.facility.ownerOperator)} · ${formatCountyShort(unit.facility.county)}, ${unit.facility.stateCode}`}
        actions={
          <CompareActions
            isInCompare={compareUnitIds.includes(unit.id)}
            onToggle={() => toggleUnitCompare(unit.id)}
          />
        }
      />

      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
        <Section title="Identification">
          <DetailList items={identification} className="sm:grid-cols-1" />
        </Section>
        <Section title="Fuel and controls">
          <DetailList items={fuelAndControls} className="sm:grid-cols-1" />
        </Section>
      </div>

      <Section
        title={`Latest year, ${latest?.year ?? "none"}`}
        note={
          records.length
            ? `${plural(records.length, "reporting year")} stored, ${records.at(-1)!.year}–${records[0]!.year}.`
            : undefined
        }
      >
        <KpiStrip>
          <StatTile
            variant="card"
            label="Operating time"
            value={formatQuantity(latest?.operatingHours, "hr")}
          />
          <StatTile
            variant="card"
            label="Gross load"
            value={formatQuantity(latest?.grossGenerationMWh, "MWh")}
          />
          <StatTile
            variant="card"
            label="Heat input"
            value={formatQuantity(latest?.heatInputMMBtu, "MMBtu")}
            subtext={`${formatQuantity(latest?.heatRateMMBtuMWh, "MMBtu/MWh", { digits: 2 })} heat rate`}
          />
          <StatTile
            variant="card"
            label="CO₂"
            value={formatQuantity(latest?.co2MassTons, "t")}
            subtext={formatQuantity(latest?.co2IntensityLbsMWh, "lbs/MWh")}
          />
          <StatTile
            variant="card"
            label="SO₂, NOₓ"
            value={`${formatNumber(latest?.so2MassTons, 1)} t, ${formatNumber(latest?.noxMassTons, 1)} t`}
            className="col-span-2 sm:col-span-1"
          />
        </KpiStrip>
      </Section>

      <Section
        title="Operating data and emissions by year"
        note="One row per reporting year (§8.3 historical search), with the dataset each record came from. Flag counts are in the year column; hover for details."
      >
        {records.length === 0 ? (
          <EmptyState title="No annual records for this unit." />
        ) : (
          <ReportTable
            sortable
            sortKeys={records.map((r) => [
              r.year,
              ...Array<undefined>(10),
              r.dataset?.importedAt,
            ])}
            head={[
              "Year",
              "Op. hours",
              "Gross MWh",
              "Heat MMBtu",
              "Steam klb",
              "CO₂ t",
              "SO₂ t",
              "NOₓ t",
              "lbs/MWh",
              "MMBtu/MWh",
              "Controls, programs",
              "Source",
            ]}
            rows={records.map((r) => [
              <span key="y" className="text-fg">
                {r.year}
                {r.auditLogs.length > 0 && (
                  <Badge
                    variant="warning"
                    className="ml-1.5"
                    title={r.auditLogs.map((l) => l.details).join("\n")}
                  >
                    {r.auditLogs.length}
                  </Badge>
                )}
              </span>,
              formatNumber(r.operatingHours),
              formatNumber(r.grossGenerationMWh),
              formatNumber(r.heatInputMMBtu),
              formatNumber(r.steamLoadKlb),
              formatNumber(r.co2MassTons),
              formatNumber(r.so2MassTons, 1),
              formatNumber(r.noxMassTons, 1),
              formatNumber(r.co2IntensityLbsMWh),
              formatQuantity(r.heatRateMMBtuMWh, "", { digits: 2 }),
              <YearControls key="c" record={r} />,
              <span
                key="s"
                title={
                  r.dataset
                    ? `${datasetOriginLabel(r.dataset)}\n${r.dataset.name}${r.supersededUpload ? `\nReplaced upload: ${r.supersededUpload.originalFilename}` : ""}`
                    : undefined
                }
              >
                {r.dataset
                  ? `${r.dataset.source === "API" ? "API" : "Upload"}, ${r.dataset.importedAt.toLocaleDateString()}${r.supersededUpload ? " (replaced upload)" : ""}`
                  : "—"}
              </span>,
            ])}
          />
        )}
      </Section>

      <Section title="Data-quality flags">
        <AuditPanel logs={auditLogs} />
      </Section>
    </div>
  );
}

/** The controls and programs a unit reported for one year (§7: stored per annual record). */
function YearControls({
  record,
}: {
  record: {
    so2Controls: string | null;
    noxControls: string | null;
    pmControls: string | null;
    hgControls: string | null;
    programCode: string | null;
  };
}) {
  const parts = [
    ["SO₂", record.so2Controls],
    ["NOₓ", record.noxControls],
    ["PM", record.pmControls],
    ["Hg", record.hgControls],
  ].filter((p): p is [string, string] => Boolean(p[1]));
  const text = parts.map(([k, v]) => `${k}: ${v}`).join("\n");
  return (
    <span
      className="block max-w-[10rem] truncate"
      title={[text, record.programCode && `Programs: ${record.programCode}`]
        .filter(Boolean)
        .join("\n")}
    >
      {parts.length ? parts.map(([k]) => k).join(" · ") : "None"}
      {record.programCode && (
        <span className="text-fg-muted"> · {record.programCode}</span>
      )}
    </span>
  );
}
