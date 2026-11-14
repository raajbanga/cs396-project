"use client";

import { ProgressBar } from "~/components/ui/metric-bar";
import { Disclosure, ReportTable, Section } from "~/components/ui/report";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import type { VariableInfo } from "~/lib/analysis";
import { Takeaways } from "~/components/ui/takeaways";
import { formatStat } from "~/lib/analysis";
import {
  leaderSentence,
  measureName,
  shareSentence,
  trendSentence,
} from "~/lib/takeaways";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import { MapChart, RankingChart, TrendChart } from "./charts";
import {
  bind,
  combinedLabel,
  findInfo,
  VariableField,
  type TabProps,
} from "./shared";

const KINDS: { group: VariableInfo["group"]; note: string }[] = [
  { group: "Measured", note: "As reported to CAMPD." },
  {
    group: "Derived",
    note: "Rates computed per unit-year; missing when an input is missing or a denominator is 0.",
  },
  {
    group: "Year over year",
    note: "The same unit against its previous reporting year.",
  },
  {
    group: "TRACI impact",
    note: "EPA TRACI 2.2 potential impacts; see the Impacts tab for the factors.",
  },
];

/**
 * §4.1 + §4.4: what the selection holds and how it changed. Size first, then one variable over
 * time, by state, and by its largest emitters; the missing-value summary and variable
 * definitions are one click away.
 */
export function OverviewTab(props: TabProps) {
  const { summary } = props;
  if (!summary) return null;
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <VariableField {...bind(props, "variable")} label="Show" />
        <OverviewTakeaways {...props} />
      </div>
      <TrendChart {...props} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MapChart {...props} />
        <RankingChart {...props} />
      </div>

      <DataQuality {...props} />
    </div>
  );
}

/**
 * The answer first: what the selection is, how the variable changed, which fuel dominates it, and
 * how much the largest facility accounts for. Shares only make sense for totals, so rates and
 * means get the trend alone.
 */
function OverviewTakeaways({ filters, view, catalog, summary }: TabProps) {
  const info = findInfo(catalog, view.variable);
  const variables = [view.variable];
  const sum = info?.aggregation === "sum";
  const years = api.analysis.aggregate.useQuery({
    filters,
    variables,
    by: "year",
  });
  const fuels = api.analysis.aggregate.useQuery(
    { filters, variables, by: "fuelClass", limit: 30 },
    { enabled: sum },
  );
  // The ranking chart's own query: shared from the cache.
  const top = api.analysis.aggregate.useQuery(
    { filters, variables, by: "facility", order: "desc", limit: 15 },
    { enabled: sum },
  );
  if (!summary || !info) return null;
  const value = (r: { values: Record<string, number | null> }) =>
    r.values[view.variable] ?? null;
  const yearRows = years.data?.rows ?? [];
  const total = yearRows.reduce((t, r) => t + (value(r) ?? 0), 0);
  const span = summary.years.length
    ? summary.years.length === 1
      ? ` in ${summary.years[0]}`
      : `, ${summary.years[0]}–${summary.years.at(-1)}`
    : "";
  return (
    <Takeaways
      items={[
        `${formatNumber(summary.records)} unit-years from ${formatNumber(summary.facilities)} facilities and ${formatNumber(summary.units)} units${span}.`,
        sum &&
          total > 0 &&
          `${measureName(info.label, "sum")}: ${formatStat(total)} ${info.unit}.`,
        trendSentence({
          label: info.label,
          unit: info.unit,
          aggregation: info.aggregation,
          points: yearRows.map((r) => ({
            year: Number(r.group),
            value: value(r),
          })),
        }),
        sum &&
          shareSentence(
            (fuels.data?.rows ?? []).map((r) => ({
              group: r.group,
              value: value(r),
              n: r.n,
            })),
          ),
        sum &&
          top.data?.rows[0] &&
          leaderSentence(
            { group: top.data.rows[0].group, value: value(top.data.rows[0]) },
            total,
          ),
      ]}
    />
  );
}

/** §4.1 missing-value summary and the variables available, collapsed under one heading. */
function DataQuality({ catalog, summary }: TabProps) {
  if (!summary) return null;
  const { records } = summary;
  const missing = new Map(summary.missing.map((m) => [m.key, m.missing]));
  const worst = [...summary.missing].sort((a, b) => b.missing - a.missing)[0];
  return (
    <Disclosure
      title="Data quality and variables"
      hint={`${catalog.variables.length} variables, missing values per variable, grouping fields${
        worst && records
          ? `; most missing: ${catalog.variables.find((v) => v.key === worst.key)?.label} (${((worst.missing / records) * 100).toFixed(0)} %)`
          : ""
      }`}
    >
      <Section
        title="Grouping fields"
        note="Every analysis can be grouped and compared by these fields; the number is how many distinct values the selection has."
      >
        <KpiStrip className="lg:grid-cols-9">
          {summary.distinct.map((d) => (
            <StatTile
              key={d.key}
              label={
                catalog.dimensions.find((x) => x.key === d.key)?.label ?? d.key
              }
              value={formatNumber(d.count)}
            />
          ))}
        </KpiStrip>
      </Section>
      {KINDS.map(({ group, note }) => (
        <Section
          key={group}
          title={`${group} variables`}
          note={`${note} Missing values are left out of every statistic, never counted as 0.`}
        >
          <ReportTable
            head={[
              "Variable",
              "Unit",
              "Groups combine as",
              "Missing",
              "",
              "Definition",
            ]}
            wrap={[5]}
            rows={catalog.variables
              .filter((v) => v.group === group)
              .map((v) => {
                const n = missing.get(v.key) ?? 0;
                const share = records ? (n / records) * 100 : 0;
                return [
                  <span key="l" className="text-fg font-medium">
                    {v.label}
                  </span>,
                  v.unit,
                  combinedLabel(v),
                  formatNumber(n),
                  <div key="m" className="flex w-28 items-center gap-2">
                    <ProgressBar percent={share} className="w-16" />
                    <span className="text-fg-muted">{share.toFixed(1)} %</span>
                  </div>,
                  <span key="d" className="text-fg-muted whitespace-normal">
                    {v.definition}
                  </span>,
                ];
              })}
          />
        </Section>
      ))}
    </Disclosure>
  );
}
