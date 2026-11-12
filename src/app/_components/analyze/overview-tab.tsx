"use client";

import { ProgressBar } from "~/components/ui/metric-bar";
import { ReportTable, Section } from "~/components/ui/report";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import type { VariableInfo } from "~/lib/analysis";
import { formatNumber } from "~/lib/utils";
import { MapChart, RankingChart, TrendChart } from "./charts";
import { bind, combinedLabel, VariableField, type TabProps } from "./shared";

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
  const { records, years } = summary;
  return (
    <div className="space-y-6">
      <KpiStrip className="lg:grid-cols-4">
        <StatTile
          variant="card"
          label="Unit-years"
          value={formatNumber(records)}
        />
        <StatTile
          variant="card"
          label="Facilities"
          value={formatNumber(summary.facilities)}
        />
        <StatTile
          variant="card"
          label="Units"
          value={formatNumber(summary.units)}
        />
        <StatTile
          variant="card"
          label="Reporting years"
          value={formatNumber(years.length)}
          subtext={years.length ? `${years[0]}–${years.at(-1)}` : "—"}
        />
      </KpiStrip>

      <VariableField {...bind(props, "variable")} label="Show" />
      <TrendChart {...props} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MapChart {...props} />
        <RankingChart {...props} />
      </div>

      <DataQuality {...props} />
    </div>
  );
}

/** §4.1 missing-value summary and the variables available, collapsed under one heading. */
function DataQuality({ catalog, summary }: TabProps) {
  if (!summary) return null;
  const { records } = summary;
  const missing = new Map(summary.missing.map((m) => [m.key, m.missing]));
  const worst = [...summary.missing].sort((a, b) => b.missing - a.missing)[0];
  return (
    <details className="border-edge group rounded-md border">
      <summary className="hover:bg-surface flex cursor-pointer items-baseline gap-3 px-4 py-3">
        <span className="text-fg font-semibold">
          Data quality and variables
        </span>
        <span className="text-fg-muted text-xs">
          {catalog.variables.length} variables, missing values per variable,
          grouping fields
          {worst && records
            ? `; most missing: ${catalog.variables.find((v) => v.key === worst.key)?.label} (${((worst.missing / records) * 100).toFixed(0)} %)`
            : ""}
        </span>
      </summary>
      <div className="space-y-8 px-4 pt-2 pb-5">
        <Section
          title="Grouping fields"
          note="Every analysis can be grouped and compared by these fields; the number is how many distinct values the selection has."
        >
          <KpiStrip className="lg:grid-cols-9">
            {summary.distinct.map((d) => (
              <StatTile
                key={d.key}
                label={
                  catalog.dimensions.find((x) => x.key === d.key)?.label ??
                  d.key
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
                      <span className="text-fg-muted">
                        {share.toFixed(1)} %
                      </span>
                    </div>,
                    <span key="d" className="text-fg-muted whitespace-normal">
                      {v.definition}
                    </span>,
                  ];
                })}
            />
          </Section>
        ))}
      </div>
    </details>
  );
}
