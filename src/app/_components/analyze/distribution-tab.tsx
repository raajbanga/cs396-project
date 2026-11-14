"use client";

import { InlineLoading, QueryError } from "~/components/ui/empty-state";
import { ExportButton } from "~/components/ui/export-button";
import { Disclosure, ReportTable, Section } from "~/components/ui/report";
import { Takeaways } from "~/components/ui/takeaways";
import { TryExamples } from "~/components/ui/try-examples";
import { formatStat } from "~/lib/analysis";
import { PERCENTILES, type Summary } from "~/lib/stats";
import {
  groupMedianSentence,
  outlierSentence,
  spreadSentences,
} from "~/lib/takeaways";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import { DistributionChart } from "./charts";
import {
  asDimension,
  bind,
  combinedLabel,
  Controls,
  DimensionField,
  dimensionLabel,
  findInfo,
  inSentence,
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

/** The full §4.2 set, as table columns. */
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

/**
 * §4.2 + §4.4 histogram/box plot: how one variable is spread, overall and per group, and which
 * unit-years are unusual. Headline numbers first, the picture next, the full table after.
 */
export function DistributionTab(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const by = asDimension(view.by);
  const q = api.analysis.describe.useQuery(
    { filters, variable: view.variable, by },
    { placeholderData: (prev) => prev },
  );
  const { data } = q;
  const combined = combinedLabel(info);
  const groupName = by ? dimensionLabel(catalog, by) : "Group";
  const head = [
    groupName,
    combined,
    "Count",
    "Missing",
    ...STAT_COLUMNS.map(([h]) => h),
  ];
  const row = (label: string, g: Summary & { value: number | null }) => [
    label,
    g.value,
    g.count,
    g.missing,
    ...STAT_COLUMNS.map(([, f]) => f(g)),
  ];
  const rows = data
    ? [
        row("All selected", data.overall),
        ...(by ? data.groups.map((g) => row(g.group, g)) : []),
      ]
    : [];
  const o = data?.overall;
  const unusual = data?.unusual;

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

      {q.error ? (
        <QueryError error={q.error} onRetry={() => void q.refetch()} />
      ) : !data || !o || !info ? (
        <InlineLoading title="Computing statistics…" />
      ) : (
        <div
          className={
            q.isFetching
              ? "space-y-6 opacity-60 transition-opacity"
              : "space-y-6"
          }
        >
          <Takeaways
            items={[
              `${formatNumber(o.count)} unit-years have a value${o.missing ? ` (${formatNumber(o.missing)} don't report one)` : ""}; ${combined.toLowerCase()} ${formatStat(o.value)} ${info.unit}.`,
              ...spreadSentences(o, info.unit),
              by &&
                groupMedianSentence(
                  data.groups.map((g) => ({
                    group: g.group,
                    median: g.median,
                  })),
                  info.unit,
                ),
              unusual && outlierSentence(unusual, o.count, o.median),
            ]}
          />

          <DistributionChart {...props} />

          <Disclosure
            title={
              by ? `Statistics by ${inSentence(groupName)}` : "All statistics"
            }
            hint="Mean, median, spread, quartiles, and percentiles, with a download"
          >
            <Section
              title=""
              note={`${info.definition} ${by ? `${formatNumber(data.groups.length)} of ${formatNumber(data.totalGroups)} groups, ${by === "year" ? "in year order" : `largest ${combined.toLowerCase()} first`}. ` : ""}Missing values are left out, never counted as 0. Click a column to sort.`}
              actions={
                <ExportButton
                  name={`statistics-${view.variable}${by ? `-by-${by}` : ""}`}
                  title={`${info.label} statistics${by ? ` by ${inSentence(groupName)}` : ""}`}
                  table={{ head, rows }}
                  meta={{ variables: [info] }}
                />
              }
            >
              <div className="max-h-[480px] overflow-y-auto">
                <ReportTable
                  sortable
                  head={head}
                  rows={rows.map(([group, ...nums]) => [
                    group,
                    ...nums.map((n) => formatStat(n as number | null)),
                  ])}
                  sortKeys={rows.map((r) => r.map((c) => c))}
                />
              </div>
            </Section>
          </Disclosure>

          {unusual && (
            <Disclosure
              title="Unusual observations"
              hint={`${formatNumber(unusual.above + unusual.below)} unit-years far from the rest`}
            >
              <Section
                title=""
                note={`${formatNumber(unusual.below)} unit-years below and ${formatNumber(unusual.above)} above Tukey's far-out fences (Q1 − 3 × IQR to Q3 + 3 × IQR: ${formatStat(unusual.low)} to ${formatStat(unusual.high)} ${info.unit}). They are reported values, not errors; the Audit flags tab on Explore lists records that break physical rules.`}
              >
                {unusual.extreme.length > 0 && (
                  <ReportTable
                    head={[
                      "Most extreme unit-years",
                      `${info.label} (${info.unit})`,
                      "× median",
                    ]}
                    rows={unusual.extreme.map((u) => [
                      u.label,
                      formatStat(u.value),
                      o.median ? `${formatStat(u.value / o.median)}×` : "—",
                    ])}
                  />
                )}
              </Section>
            </Disclosure>
          )}
        </div>
      )}
    </div>
  );
}
