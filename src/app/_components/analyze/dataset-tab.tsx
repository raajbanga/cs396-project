"use client";

import { ProgressBar } from "~/components/ui/metric-bar";
import { ReportTable, Section } from "~/components/ui/report";
import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import type { VariableInfo } from "~/lib/analysis";
import { formatNumber } from "~/lib/utils";
import { combinedLabel, type TabProps } from "./shared";

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

/** §4.1: the size of the selection, its missing values, and the variables available. */
export function DatasetTab({ catalog, summary }: TabProps) {
  if (!summary) return null;
  const { records, years } = summary;
  const missing = new Map(summary.missing.map((m) => [m.key, m.missing]));
  return (
    <div className="space-y-10">
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

      <Section
        title="Grouping fields"
        note="Every analysis can be grouped and compared by these fields; the number is how many distinct values the selection has. Fuel class and the control classes simplify the reported values."
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

      {KINDS.map(({ group, note }) => {
        const variables = catalog.variables.filter((v) => v.group === group);
        return (
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
              rows={variables.map((v) => {
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
        );
      })}
    </div>
  );
}
