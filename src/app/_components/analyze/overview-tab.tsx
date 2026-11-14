"use client";

import { ProgressBar } from "~/components/ui/metric-bar";
import { Disclosure, ReportTable, Section } from "~/components/ui/report";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import type { VariableInfo } from "~/lib/analysis";
import { GLOSS_CLASS } from "~/components/ui/glossed-text";
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
  Controls,
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
      <Controls>
        <VariableField {...bind(props, "variable")} label="Show" />
      </Controls>
      <OverviewTakeaways {...props} />
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

type Reasons = NonNullable<TabProps["summary"]>["reasons"];

/** Why one variable is missing in the selection, from the selection's reason counts. */
function whyMissing(v: VariableInfo, r: Reasons) {
  const why: string[] = [];
  if (r.idle)
    why.push(
      `${formatNumber(r.idle)} unit-years didn't run (0 hours) and report nothing`,
    );
  if (v.group === "Year over year")
    why.push(
      `${formatNumber(r.noPrevYear)} have no previous year to compare (the first year, or a new unit), and others miss the value in one of the two years`,
    );
  if (/co2|globalWarming/i.test(v.key) && r.noCo2Program)
    why.push(
      `${formatNumber(r.noCo2Program)} ran under NOₓ-only programs, which don't require CO₂ reporting`,
    );
  if (
    (v.group === "Derived" && v.key !== "noxRate") ||
    /^load|PerMWh$/.test(v.key) ||
    v.key === "grossGenerationMWh"
  )
    if (r.noLoad)
      why.push(
        `${formatNumber(r.noLoad)} report no electricity (gross load)${r.steamOnly ? `, ${formatNumber(r.steamOnly)} of them steam-only cogeneration units` : ""}, so a per-MWh rate is undefined`,
      );
  return why.length ? `Mostly: ${why.join("; ")}.` : undefined;
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
      <Takeaways
        items={[
          "Missing values are gaps in what EPA collects, not errors, and are left out of every statistic (never counted as 0):",
          summary.reasons.idle > 0 &&
            `${formatNumber(summary.reasons.idle)} unit-years were listed for a year they didn't run (0 operating hours) and report no values at all. Analyze leaves these out by default (the "Operating time > 0" filter).`,
          summary.reasons.noCo2Program > 0 &&
            `${formatNumber(summary.reasons.noCo2Program)} ran under NOₓ-only programs (SIP NOₓ, CSAPR NOₓ), which require NOₓ and heat input but not CO₂; CO₂ is reported under the Acid Rain Program and RGGI.`,
          summary.reasons.noLoad > 0 &&
            `${formatNumber(summary.reasons.noLoad)} report no gross load${summary.reasons.steamOnly ? ` (${formatNumber(summary.reasons.steamOnly)} are cogeneration units that sell steam instead)` : ""}, so every per-MWh rate is undefined for them.`,
          summary.reasons.noPrevYear > 0 &&
            `${formatNumber(summary.reasons.noPrevYear)} have no previous year to compare against (the first year selected, or a new unit), so year-over-year changes are missing.`,
        ]}
      />
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
                  <span
                    key="n"
                    title={whyMissing(v, summary.reasons)}
                    className={n ? GLOSS_CLASS : undefined}
                  >
                    {formatNumber(n)}
                  </span>,
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
