"use client";

import { Chart } from "~/components/ui/chart";
import { ReportTable, Section } from "~/components/ui/report";
import { TryExamples } from "~/components/ui/try-examples";
import { formatPct, formatStat } from "~/lib/analysis";
import { cn, formatNumber } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import {
  asDimension,
  bind,
  combinedLabel,
  Controls,
  DimensionField,
  dimensionLabel,
  findInfo,
  variableLabel,
  VariableField,
  type TabProps,
} from "./shared";

type Result = RouterOutputs["analysis"]["compare"];

const EXAMPLES = [
  {
    label: "SCR vs no NOₓ control",
    variable: "noxRate",
    compareBy: "noxControl",
    groups: "SCR|None",
  },
  {
    label: "2015 vs 2024 CO₂ intensity",
    variable: "co2Intensity",
    compareBy: "year",
    groups: "2015|2024",
  },
  {
    label: "coal vs gas heat rate",
    variable: "heatRate",
    compareBy: "fuelClass",
    groups: "Coal|Natural Gas",
  },
  {
    label: "KY, WV, OH SO₂ intensity",
    variable: "so2Intensity",
    compareBy: "state",
    groups: "KY|WV|OH",
  },
];

const formatP = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
const significant = (p?: number | null) => p != null && p < 0.05;

/** The result in plain language: the size of the gap, whether tests support it, and what it can't show. */
function explain(result: Result, label: string, unit: string) {
  const [base, ...rest] = result.groups;
  if (!base) return [];
  const lines = rest.map((g) =>
    g.diffPct === null
      ? `${g.group} has no ${label} value to compare.`
      : `${g.group}: ${formatStat(g.value)} ${unit}, ${Math.abs(g.diffPct).toFixed(1)} % ${g.diffPct < 0 ? "lower" : "higher"} than ${base.group} (${formatStat(base.value)} ${unit}).`,
  );
  const { welch, mannWhitney, anova, kruskal } = result.tests;
  if (welch && mannWhitney) {
    lines.push(
      significant(welch.p) && significant(mannWhitney.p)
        ? `Both tests find the unit-year values differ between the two groups (Welch t-test p ${formatP(welch.p)}; Mann–Whitney p ${formatP(mannWhitney.p)}), so the gap is unlikely to be chance alone.`
        : significant(welch.p) || significant(mannWhitney.p)
          ? `The tests disagree (Welch p ${formatP(welch.p)}, Mann–Whitney p ${formatP(mannWhitney.p)}): the means and the typical values tell different stories, often because of a few extreme unit-years.`
          : `Neither test finds a difference at the 5 % level (Welch p ${formatP(welch.p)}, Mann–Whitney p ${formatP(mannWhitney.p)}).`,
    );
  } else if (anova && kruskal) {
    lines.push(
      significant(anova.p) || significant(kruskal.p)
        ? `At least one group differs from the others (ANOVA p ${formatP(anova.p)}; Kruskal–Wallis p ${formatP(kruskal.p)}).`
        : `No group differs at the 5 % level (ANOVA p ${formatP(anova.p)}; Kruskal–Wallis p ${formatP(kruskal.p)}).`,
    );
  }
  lines.push(
    "Groups differ in more than the attribute compared (size, age, fuel, hours run), so a difference is an association, not proof that the attribute causes it. Tests treat each unit-year as independent, which repeated years of the same unit are not, so p-values are optimistic.",
  );
  return lines;
}

/** §4.5: two or more groups along one dimension, with differences, confidence intervals, and tests. */
export function CompareTab(props: TabProps) {
  const { filters, view, setView, catalog } = props;
  const info = findInfo(catalog, view.variable);
  const by = asDimension(view.compareBy) ?? "noxControl";
  const groups = view.groups.split("|").filter(Boolean);
  const options = api.analysis.aggregate.useQuery({
    filters,
    variables: [view.variable],
    by,
    order: "label",
    limit: 80,
  });
  const result = api.analysis.compare.useQuery(
    { filters, variable: view.variable, by, groups },
    { enabled: groups.length >= 2, placeholderData: (prev) => prev },
  );
  const toggleGroup = (g: string) =>
    setView({
      groups: (groups.includes(g)
        ? groups.filter((x) => x !== g)
        : [...groups, g].slice(-8)
      ).join("|"),
    });
  const combined = combinedLabel(info);
  const unit = info?.unit ?? "";
  const rows = result.data?.groups ?? [];
  // §4.5 rankings: 1 = the largest value among the compared groups.
  const ranked = rows
    .filter((g) => g.value !== null)
    .sort((a, b) => b.value! - a.value!);
  const rankOf = (g: (typeof rows)[number]) =>
    g.value === null ? "—" : String(ranked.indexOf(g) + 1);
  const t = result.data?.tests;

  return (
    <div className="space-y-6">
      <Controls>
        <VariableField {...bind(props, "variable")} />
        <DimensionField
          label="Compare"
          value={by}
          onChange={(compareBy) => setView({ compareBy, groups: "" })}
          catalog={catalog}
        />
      </Controls>
      <TryExamples
        examples={EXAMPLES.map(({ label, ...patch }) => ({
          label,
          onSelect: () => setView(patch),
        }))}
      />

      <Section
        title={`${dimensionLabel(catalog, by)} groups`}
        note="Pick two to eight; the first one picked is the baseline for differences."
      >
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {(options.data?.rows ?? []).map((r) => {
            const on = groups.includes(r.group);
            return (
              <button
                key={r.group}
                type="button"
                aria-pressed={on}
                onClick={() => toggleGroup(r.group)}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
                  on
                    ? "border-primary/50 bg-primary/10 text-fg font-medium"
                    : "border-edge bg-surface text-fg-2 hover:bg-surface-2",
                )}
              >
                {on && (
                  <span className="bg-primary text-canvas flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[11px] tabular-nums">
                    {groups.indexOf(r.group) + 1}
                  </span>
                )}
                {r.group}
                <span className="text-fg-muted text-xs tabular-nums">
                  {formatNumber(r.n)}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {groups.length < 2 ? (
        <p className="text-fg-muted text-sm">
          Pick at least two groups to compare.
        </p>
      ) : (
        result.data &&
        info && (
          <>
            <Section title="Result">
              <ul className="border-primary/40 text-fg-2 max-w-4xl space-y-1.5 border-l-2 pl-4 text-sm">
                {explain(result.data, info.label, unit).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Section>
            <ReportTable
              sortable
              head={[
                dimensionLabel(catalog, by),
                "Rank",
                `${combined} (${unit})`,
                "Difference",
                "% difference",
                "Count",
                "Mean",
                "95 % CI of mean",
                "Median",
                "SD",
              ]}
              rows={rows.map((g, i) => [
                g.group,
                rankOf(g),
                formatStat(g.value),
                i === 0 ? "baseline" : formatStat(g.diff),
                i === 0 ? "—" : formatPct(g.diffPct),
                formatNumber(g.count),
                formatStat(g.mean),
                g.ci
                  ? `${formatStat(g.ci.low)} – ${formatStat(g.ci.high)}`
                  : "—",
                formatStat(g.median),
                formatStat(g.sd),
              ])}
            />
            <ReportTable
              head={["Test", "Question", "Statistic", "p-value"]}
              rows={[
                t?.welch && [
                  "Welch t-test",
                  "Do the two means differ?",
                  `t = ${formatStat(t.welch.t)}, df = ${formatStat(t.welch.df)}`,
                  formatP(t.welch.p),
                ],
                t?.mannWhitney && [
                  "Mann–Whitney U",
                  "Does one group tend to have larger values?",
                  `U = ${formatStat(t.mannWhitney.u)}, z = ${formatStat(t.mannWhitney.z)}`,
                  formatP(t.mannWhitney.p),
                ],
                t?.anova && [
                  "One-way ANOVA",
                  "Does any group mean differ?",
                  `F = ${formatStat(t.anova.f)} (${t.anova.df1}, ${t.anova.df2})`,
                  formatP(t.anova.p),
                ],
                t?.kruskal && [
                  "Kruskal–Wallis H",
                  "Does any group's distribution differ?",
                  `H = ${formatStat(t.kruskal.h)}, df = ${t.kruskal.df}`,
                  formatP(t.kruskal.p),
                ],
              ].filter((r): r is string[] => Boolean(r))}
            />
            <Chart
              title={`Mean ${info.label} per unit-year, with 95 % confidence intervals`}
              subtitle={`The table's ${combined.toLowerCase()} weights every unit-year by its size; the mean here counts each unit-year once.`}
              filename={`compare-${view.variable}-by-${by}`}
              meta={{ variables: [info], groups, tests: result.data.tests }}
              data={[
                {
                  type: "bar",
                  x: rows.map((g) => g.group),
                  y: rows.map((g) => g.mean),
                  error_y: {
                    type: "data",
                    symmetric: false,
                    array: rows.map((g) => (g.ci ? g.ci.high - g.ci.mean : 0)),
                    arrayminus: rows.map((g) =>
                      g.ci ? g.ci.mean - g.ci.low : 0,
                    ),
                  },
                  hovertemplate: `%{x}: mean %{y:,.4~g} ${unit}<extra></extra>`,
                },
              ]}
              layout={{
                xaxis: {
                  title: { text: dimensionLabel(catalog, by) },
                  type: "category",
                },
                yaxis: { title: { text: variableLabel(info) } },
              }}
              table={{
                head: [
                  "group",
                  "rank",
                  `${combined} (${unit})`,
                  "diff",
                  "diff_pct",
                  "count",
                  "mean",
                  "ci_low",
                  "ci_high",
                  "median",
                  "sd",
                ],
                rows: rows.map((g) => [
                  g.group,
                  rankOf(g),
                  g.value,
                  g.diff,
                  g.diffPct,
                  g.count,
                  g.mean,
                  g.ci?.low,
                  g.ci?.high,
                  g.median,
                  g.sd,
                ]),
              }}
            />
          </>
        )
      )}
    </div>
  );
}
