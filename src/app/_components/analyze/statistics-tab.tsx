"use client";

import { Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ReportTable, Section } from "~/components/ui/report";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { TryExamples } from "~/components/ui/try-examples";
import { AGGREGATION_LABELS, formatStat } from "~/lib/analysis";
import { downloadCsv } from "~/lib/csv";
import { PERCENTILES, type Summary } from "~/lib/stats";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  asDimension,
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
export function StatisticsTab({ filters, view, setView, catalog }: TabProps) {
  const info = findInfo(catalog, view.variable);
  const by = asDimension(view.by);
  const { data, isFetching } = api.analysis.describe.useQuery(
    { filters, variable: view.variable, by },
    { placeholderData: (prev) => prev },
  );
  const combined = info ? AGGREGATION_LABELS[info.aggregation] : "Value";
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
        <VariableField
          value={view.variable}
          onChange={(variable) => setView({ variable })}
          catalog={catalog}
        />
        <DimensionField
          value={view.by}
          onChange={(by) => setView({ by })}
          catalog={catalog}
          none="No grouping"
        />
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
            <KpiStrip className="lg:grid-cols-6">
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

      {by && data && (
        <Section
          title={`By ${dimensionLabel(catalog, by).toLowerCase()}`}
          note={`${formatNumber(data.groups.length)} of ${formatNumber(data.totalGroups)} groups, ${by === "year" ? "in year order" : `largest ${combined.toLowerCase()} first`}. Click a column to sort.`}
        >
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `statistics-${view.variable}-by-${by}.csv`,
                  head,
                  rows,
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </div>
          <ReportTable
            sortable
            head={head}
            rows={rows.map(([group, ...nums]) => [
              group,
              ...nums.map((n) => formatStat(n as number | null)),
            ])}
            sortKeys={rows.map((r) =>
              r.map((c) => c),
            )}
          />
        </Section>
      )}
    </div>
  );
}
