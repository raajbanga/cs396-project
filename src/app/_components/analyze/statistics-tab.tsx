"use client";

import { ExportButton } from "~/components/ui/export-button";
import { ReportTable, Section } from "~/components/ui/report";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { TryExamples } from "~/components/ui/try-examples";
import { formatStat } from "~/lib/analysis";
import { PERCENTILES, type Summary } from "~/lib/stats";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  asDimension,
  bind,
  combinedLabel,
  Controls,
  DimensionField,
  dimensionLabel,
  findInfo,
  VariableField,
  type TabProps,
} from "./shared";

/** The four example questions of Phase 2 §4.2. */
const EXAMPLES = [
  { label: "average CO₂ by state", variable: "co2MassTons", by: "state" },
  {
    label: "median NOₓ intensity by fuel",
    variable: "noxIntensity",
    by: "fuelClass",
  },
  { label: "total SO₂ by year", variable: "so2MassTons", by: "year" },
  {
    label: "average heat rate by unit type",
    variable: "heatRate",
    by: "unitType",
  },
];

const STAT_COLUMNS: [string, (s: Summary) => number | null][] = [
  ["Mean", (s) => s.mean],
  ["Median", (s) => s.median],
  ["SD", (s) => s.sd],
  ["Min", (s) => s.min],
  ["Q1", (s) => s.q1],
  ["Q3", (s) => s.q3],
  ["Max", (s) => s.max],
  ["IQR", (s) => s.iqr],
  ...PERCENTILES.map((p): [string, (s: Summary) => number | null] => [
    `P${p}`,
    (s) => s.percentiles[p],
  ]),
];

/** §4.2: one variable's descriptive statistics, overall and per group. */
export function StatisticsTab(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const by = asDimension(view.by);
  const { data, isFetching } = api.analysis.describe.useQuery(
    { filters, variable: view.variable, by },
    { placeholderData: (prev) => prev },
  );
  const combined = combinedLabel(info);
  const unusual = data?.unusual;
  const head = [
    by ? dimensionLabel(catalog, by) : "Group",
    combined,
    "Count",
    "Missing",
    ...STAT_COLUMNS.map(([h]) => h),
  ];
  const rows = (data?.groups ?? []).map((g) => [
    g.group,
    g.value,
    g.count,
    g.missing,
    ...STAT_COLUMNS.map(([, f]) => f(g)),
  ]);

  return (
    <div className="space-y-6">
      <Controls>
        <VariableField {...bind(props, "variable")} />
        <DimensionField {...bind(props, "by")} none="No grouping" />
      </Controls>
      <TryExamples
        examples={EXAMPLES.map((e) => ({
          label: e.label,
          onSelect: () => setView({ variable: e.variable, by: e.by }),
        }))}
      />

      {data && info && (
        <div
          className={isFetching ? "opacity-60 transition-opacity" : undefined}
        >
          <Section
            title={`${info.label} (${info.unit})`}
            note={`${info.definition} Statistics describe unit-years; ${combined.toLowerCase()} combines the whole selection.`}
          >
            <KpiStrip className="lg:grid-cols-7">
              <StatTile
                label={combined}
                value={formatStat(data.overall.value)}
              />
              <StatTile
                label="Count"
                value={formatNumber(data.overall.count)}
                subtext={`${formatNumber(data.overall.missing)} missing`}
              />
              {STAT_COLUMNS.map(([label, f]) => (
                <StatTile
                  key={label}
                  label={label}
                  value={formatStat(f(data.overall))}
                />
              ))}
            </KpiStrip>
          </Section>
        </div>
      )}

      {unusual && info && (
        <Section
          title="Unusual observations"
          note={`Unit-years beyond Tukey's far-out fences, Q1 − 3 × IQR and Q3 + 3 × IQR (${formatStat(unusual.low)} to ${formatStat(unusual.high)} ${info.unit}): ${formatNumber(unusual.below)} below and ${formatNumber(unusual.above)} above. They are reported values, not errors, but worth a look before trusting a mean; the Audit flags tab on Explore lists records that break physical rules.`}
        >
          {unusual.extreme.length > 0 && (
            <ReportTable
              head={[
                "Most extreme unit-years",
                `${info.label} (${info.unit})`,
                "× median",
              ]}
              rows={unusual.extreme.map((o) => [
                o.label,
                formatStat(o.value),
                data?.overall.median
                  ? `${formatStat(o.value / data.overall.median)}×`
                  : "—",
              ])}
            />
          )}
        </Section>
      )}

      {by && data && (
        <Section
          title={`By ${dimensionLabel(catalog, by).toLowerCase()}`}
          note={`${formatNumber(data.groups.length)} of ${formatNumber(data.totalGroups)} groups, ${by === "year" ? "in year order" : `largest ${combined.toLowerCase()} first`}. Click a column to sort.`}
          actions={
            <ExportButton
              name={`statistics-${view.variable}-by-${by}`}
              title={`${info?.label} statistics by ${dimensionLabel(catalog, by).toLowerCase()}`}
              table={{ head, rows }}
              meta={{ variables: [info] }}
            />
          }
        >
          <ReportTable
            sortable
            head={head}
            rows={rows.map(([group, ...nums]) => [
              group,
              ...nums.map((n) => formatStat(n as number | null)),
            ])}
            sortKeys={rows.map((r) => r.map((c) => c))}
          />
        </Section>
      )}
    </div>
  );
}
