"use client";

import { Fragment, use, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge, FuelBadge } from "~/components/ui/badge";
import { DataPanel } from "~/components/ui/data-panel";
import { EmptyState, InlineLoading } from "~/components/ui/empty-state";
import { DialogHeader } from "~/components/ui/dialog";
import { DetailList, Section } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  localSortProps,
  SortableTableHead,
  TableRow,
} from "~/components/ui/table";
import { buildYearlyRollups, type YearlyRollup } from "~/lib/emissions-metrics";
import type { SortDirection } from "~/lib/facility-filters";
import {
  cleanOwnerOperator,
  formatCountyShort,
  generatePlantStory,
  getCarbonIntensityTier,
  hasAirQualityControls,
} from "~/lib/plant-narrative";
import {
  cn,
  datasetOriginLabel,
  formatNumber,
  formatQuantity,
  plural,
  sortRows,
  uniqueStrings,
  type SortValue,
} from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { CompareActions } from "./compare-view";
import { DetailLink } from "./detail-link";
import { SelectionContext } from "./selection-context";
import { AuditPanel, flagsOfRecords } from "./audit-logs-table";
import { GranularEmissionsWindow } from "./granular-emissions-window";

type FacilityDetail = NonNullable<RouterOutputs["facilities"]["getFacility"]>;
type PlantStory = ReturnType<typeof generatePlantStory>;
type DetailTab = "emissions" | "fleet" | "granular" | "audit";

/** The generated plant summary: role, dispatch, and footprint in plain sentences. */
function OverviewPanel({ story }: { story: PlantStory }) {
  return (
    <div className="gap-x-12 text-sm leading-relaxed lg:columns-2 [&>p]:mb-2 [&>p]:break-inside-avoid">
      <p className="text-fg">{story.headline}</p>
      <p className="text-fg-2">{story.gridStory}</p>
      <p className="text-fg-2">{story.environmentalStory}</p>
    </div>
  );
}

type FleetUnit = FacilityDetail["units"][number];
type FleetSort = "unitId" | "type" | "status" | "capacity" | "commissioned";
const FLEET_KEYS: Record<FleetSort, (u: FleetUnit) => SortValue> = {
  unitId: (u) => u.unitId,
  type: (u) => u.unitType,
  status: (u) => u.operatingStatus,
  capacity: (u) => u.nameplateCapacityMW,
  commissioned: (u) => u.commercialOpDate,
};

function FleetPanel({ units }: { units: FacilityDetail["units"] }) {
  const [sort, setSort] = useState({
    sortBy: "unitId" as FleetSort,
    sortDir: "asc" as SortDirection,
  });
  const head = localSortProps(sort, setSort, (f) => f === "capacity");
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
            <SortableTableHead
              label="Unit"
              sort="unitId"
              className="w-24"
              {...head}
            />
            <SortableTableHead label="Type and fuel" sort="type" {...head} />
            <SortableTableHead label="Status" sort="status" {...head} />
            <SortableTableHead
              label="Capacity"
              sort="capacity"
              className="text-right"
              {...head}
            />
            <TableHead>Controls</TableHead>
            <SortableTableHead
              label="Commissioned"
              sort="commissioned"
              className="w-28 text-right"
              {...head}
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortRows(units, FLEET_KEYS[sort.sortBy], sort.sortDir).map(
            (unit) => {
              const controls = [
                ["NOₓ", unit.noxControls],
                ["SO₂", unit.so2Controls],
              ].filter(([, value]) => value);
              return (
                <TableRow key={unit.id}>
                  <TableCell>
                    <DetailLink
                      view={{ kind: "unit", id: unit.id }}
                      className="text-primary font-medium"
                    >
                      Unit {unit.unitId}
                    </DetailLink>
                  </TableCell>
                  <TableCell>
                    <div className="text-fg">{unit.unitType ?? "—"}</div>
                    <div className="flex flex-wrap items-center gap-x-3">
                      {unit.primaryFuel && (
                        <FuelBadge fuel={unit.primaryFuel} />
                      )}
                      {unit.secondaryFuel && (
                        <span className="text-fg-muted text-xs">
                          Secondary: {unit.secondaryFuel}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-fg-2">
                    {unit.operatingStatus ?? "—"}
                  </TableCell>
                  <TableCell className="text-fg text-right tabular-nums">
                    {formatQuantity(unit.nameplateCapacityMW, "MW", {
                      digits: 2,
                    })}
                  </TableCell>
                  <TableCell className="max-w-xs space-y-0.5 text-xs">
                    {controls.length === 0 ? (
                      <span className="text-fg-muted">None listed</span>
                    ) : (
                      controls.map(([label, value]) => (
                        <div key={label} className="text-fg-2 truncate">
                          <span className="text-fg-muted">{label}</span> {value}
                        </div>
                      ))
                    )}
                  </TableCell>
                  <TableCell className="text-fg-muted text-right tabular-nums">
                    {unit.commercialOpDate ?? "—"}
                  </TableCell>
                </TableRow>
              );
            },
          )}
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
  rec: {
    grossGenerationMWh: number | null;
    co2MassTons: number | null;
    co2IntensityLbsMWh: number | null;
    heatRateMMBtuMWh: number | null;
  };
  hours: number | null;
  sub?: boolean;
}) {
  const numeric = cn(
    "text-right tabular-nums",
    sub ? "text-fg-2 text-xs" : "text-fg",
  );
  const muted = cn("text-fg-muted text-right tabular-nums", sub && "text-xs");
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
      <TableCell
        className={numeric}
        title={
          rec.co2IntensityLbsMWh != null
            ? getCarbonIntensityTier(rec.co2IntensityLbsMWh).description
            : undefined
        }
      >
        {formatNumber(rec.co2IntensityLbsMWh)}
      </TableCell>
      <TableCell className={muted}>
        {formatQuantity(rec.heatRateMMBtuMWh, "", { digits: 2 })}
      </TableCell>
      <TableCell className={muted}>
        {formatQuantity(hours, "", { fallback: sub ? "0" : "—" })}
      </TableCell>
    </>
  );
}

type EmissionsSort =
  "year" | "generation" | "co2" | "intensity" | "heatRate" | "hours";
type RollupRecord = YearlyRollup["records"][number];
/** Sort keys for year rows and, within a year, its unit rows ("year" keeps units by ID). */
const EMISSIONS_KEYS: Record<
  EmissionsSort,
  [(r: YearlyRollup) => SortValue, (r: RollupRecord) => SortValue]
> = {
  year: [(r) => r.year, (r) => r.unit?.unitId],
  generation: [(r) => r.grossGenerationMWh, (r) => r.grossGenerationMWh],
  co2: [(r) => r.co2MassTons, (r) => r.co2MassTons],
  intensity: [(r) => r.co2IntensityLbsMWh, (r) => r.co2IntensityLbsMWh],
  heatRate: [(r) => r.heatRateMMBtuMWh, (r) => r.heatRateMMBtuMWh],
  hours: [(r) => r.maxOperatingHours, (r) => r.operatingHours],
};

function EmissionsPanel({ rollups }: { rollups: YearlyRollup[] }) {
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState({
    sortBy: "year" as EmissionsSort,
    sortDir: "desc" as SortDirection,
  });
  const head = localSortProps(sort, setSort, () => true);
  const [yearKey, recordKey] = EMISSIONS_KEYS[sort.sortBy];

  if (rollups.length === 0) {
    return <EmptyState title="No annual emissions records available." />;
  }

  const toggleYear = (year: number) =>
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (!next.delete(year)) next.add(year);
      return next;
    });

  return (
    <DataPanel>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead
              label="Year"
              sort="year"
              className="w-56"
              {...head}
            />
            {(
              [
                ["Gross load (MWh)", "generation"],
                ["CO₂ (tons)", "co2"],
                ["CO₂ rate (lbs/MWh)", "intensity"],
                ["Heat rate (MMBtu/MWh)", "heatRate"],
                ["Operating time (hr)", "hours"],
              ] as const
            ).map(([label, key]) => (
              <SortableTableHead
                key={key}
                label={label}
                sort={key}
                className="text-right"
                {...head}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortRows(rollups, yearKey, sort.sortDir).map((rollup) => {
            const isExpanded = expandedYears.has(rollup.year);
            const expandable = rollup.records.length > 1;
            return (
              <Fragment key={rollup.year}>
                <TableRow
                  className={cn(expandable && "cursor-pointer")}
                  onClick={
                    expandable ? () => toggleYear(rollup.year) : undefined
                  }
                >
                  <TableCell className="text-fg">
                    <div className="flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                      {expandable ? (
                        isExpanded ? (
                          <ChevronDown className="text-fg-muted h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="text-fg-muted h-3.5 w-3.5" />
                        )
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {rollup.year}
                      <span className="text-fg-muted text-xs">
                        {plural(rollup.unitCount, "unit")}
                      </span>
                    </div>
                  </TableCell>
                  <EmissionCells
                    rec={rollup}
                    hours={rollup.maxOperatingHours}
                  />
                </TableRow>

                {isExpanded &&
                  sortRows(
                    rollup.records,
                    recordKey,
                    sort.sortBy === "year" ? "asc" : sort.sortDir,
                  ).map((rec) => (
                    <TableRow
                      key={rec.id}
                      className="bg-canvas/60 text-fg-2 text-xs"
                    >
                      <TableCell className="pl-9 text-xs">
                        <span className="text-fg-2">
                          Unit {rec.unit?.unitId ?? "—"}
                        </span>
                        {rec.dataset && (
                          <span
                            className="text-fg-muted ml-2"
                            title={rec.dataset.name}
                          >
                            {datasetOriginLabel(rec.dataset)}
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

/** §9 facility detail (in the detail dialog): identification, latest operating data and emissions, units, and flags. */
export function FacilityDetail({ facilityId }: { facilityId: number }) {
  const [activeTab, setActiveTab] = useState<DetailTab>("emissions");
  const { compareIds, toggleCompare } = use(SelectionContext);
  const { data: facility, isLoading } = api.facilities.getFacility.useQuery({
    id: facilityId,
  });

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
  const auditLogs = flagsOfRecords(facility?.annualRecords ?? []);
  const flagged = auditLogs.length > 0;
  const fuels = uniqueStrings(units.map((u) => u.primaryFuel));

  const story =
    facility &&
    generatePlantStory({
      ...facility,
      totalCapacityMW,
      primaryFuels: fuels,
      co2Tons: latest?.co2MassTons ?? 0,
      operatingHours: latest?.maxOperatingHours ?? 0,
      grossGenerationMWh: latest?.grossGenerationMWh ?? 0,
      carbonIntensity: latest?.co2IntensityLbsMWh ?? null,
      hasControls: units.some(hasAirQualityControls),
      year: latest?.year,
    });

  if (isLoading) return <InlineLoading title="Loading facility…" />;
  if (!facility || !story) {
    return (
      <EmptyState
        title={`No facility with ORISPL ID ${facilityId} in the database`}
        description="It may not have been retrieved or uploaded yet."
      />
    );
  }

  const mapsUrl =
    facility.latitude && facility.longitude
      ? `https://maps.google.com/?q=${facility.latitude},${facility.longitude}`
      : null;
  const location = `${facility.county ? `${formatCountyShort(facility.county)}, ` : ""}${facility.stateCode}`;
  const identification: [string, React.ReactNode][] = [
    ["ORISPL facility ID", facility.id],
    ["Location", location],
    [
      "Coordinates",
      mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex items-center gap-1 hover:underline"
        >
          {facility.latitude?.toFixed(4)}, {facility.longitude?.toFixed(4)}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        "—"
      ),
    ],
    ["Owner / operator", cleanOwnerOperator(facility.ownerOperator)],
    ["Grid region (NERC)", facility.nercRegion ?? "—"],
    ["EPA region", facility.epaRegion ?? "—"],
    ["Source category", facility.sourceCategory ?? "—"],
    ["Operating role", story.roleInfo.badgeLabel],
    [
      "Primary fuels",
      fuels.length ? (
        <span className="flex flex-wrap gap-x-3">
          {fuels.map((f) => (
            <FuelBadge key={f} fuel={f} />
          ))}
        </span>
      ) : (
        "—"
      ),
    ],
    [
      "Units, capacity",
      `${plural(units.length, "unit")}, ${formatQuantity(totalCapacityMW, "MW", { digits: 1 })}`,
    ],
  ];

  return (
    <div className="space-y-8">
      <DialogHeader
        context={`Facility ${facility.id}`}
        title={facility.name}
        lead={`${cleanOwnerOperator(facility.ownerOperator)} · ${location}`}
        actions={
          <CompareActions
            isInCompare={compareIds.includes(facility.id)}
            onToggle={() => toggleCompare(facility.id)}
          />
        }
      />

      <Section title="Identification">
        <DetailList items={identification} className="lg:grid-cols-3" />
      </Section>

      <Section
        title={`Operating data and emissions, ${latest?.year ?? "no years"}`}
        note="Latest reporting year, summed over the facility's units. Every year is in the table below."
      >
        <KpiStrip>
          <StatTile
            variant="card"
            label="Gross load"
            value={formatQuantity(latest?.grossGenerationMWh, "MWh")}
            subtext={`${formatQuantity(latest?.maxOperatingHours, "hr")} operating, busiest unit`}
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
            subtext={`${formatQuantity(latest?.co2IntensityLbsMWh, "lbs/MWh")}`}
          />
          <StatTile
            variant="card"
            label="Equivalent to"
            value={story.equivalents.homesPoweredFormatted}
            subtext={
              story.equivalents.carsDrivenRaw > 0
                ? `CO₂ of ${story.equivalents.carsDrivenFormatted}`
                : "at full capacity"
            }
          />
          <StatTile
            variant="card"
            label="Data-quality flags"
            value={flagged ? auditLogs.length : "None"}
            valueClassName={flagged ? "text-warn" : undefined}
            subtext="across all years"
            className="col-span-2 sm:col-span-1"
          />
        </KpiStrip>
        <div className="pt-2">
          <OverviewPanel story={story} />
        </div>
      </Section>

      <div className="space-y-4">
        <SegmentedControl
          variant="tabs"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            {
              value: "emissions",
              label: `Annual records (${plural(rollups.length, "year")})`,
            },
            { value: "fleet", label: `Units (${units.length})` },
            { value: "granular", label: "Hourly and daily (live API)" },
            {
              value: "audit",
              label: (
                <>
                  Data-quality flags
                  {flagged && (
                    <Badge variant="warning">{auditLogs.length}</Badge>
                  )}
                </>
              ),
            },
          ]}
        />
        {activeTab === "emissions" ? (
          <>
            <p className="text-fg-muted text-xs">
              One row per reporting year; open a year for its units and the
              dataset each record came from.
            </p>
            <EmissionsPanel key={facility.id} rollups={rollups} />
          </>
        ) : activeTab === "fleet" ? (
          <FleetPanel units={units} />
        ) : activeTab === "granular" ? (
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
        ) : (
          <AuditPanel logs={auditLogs} />
        )}
      </div>
    </div>
  );
}
