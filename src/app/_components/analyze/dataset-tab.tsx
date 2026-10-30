"use client";

import { KpiStrip, StatTile } from "~/components/ui/stat-tile";
import { ReportTable, Section } from "~/components/ui/report";
import { AGGREGATION_LABELS } from "~/lib/analysis";
import { formatNumber } from "~/lib/utils";
import { dimensionLabel, type TabProps } from "./shared";

const percent = (part: number, whole: number) =>
  whole ? `${((part / whole) * 100).toFixed(1)} %` : "—";

/** §4.1: the size of the selection, its missing values, and the variables available. */
export function DatasetTab({ catalog, summary }: TabProps) {
  if (!summary) return null;
  const { records, years } = summary;
  const yearSpan = years.length ? `${years[0]}–${years.at(-1)}` : "—";
  return (
    <div className="space-y-8">
      <KpiStrip>
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
          subtext={yearSpan}
        />
      </KpiStrip>

      <Section
        title="Variables and missing values"
        note="A value is missing when the source did not report it or, for a derived value, when an input is missing or would divide by zero. Missing values are excluded from statistics, never counted as 0. Groups combine values as shown under Combined."
      >
        <ReportTable
          sortable
          head={[
            "Variable",
            "Kind",
            "Unit",
            "Combined",
            "Missing",
            "% missing",
            "Definition",
          ]}
          rows={catalog.variables.map((v) => {
            const missing =
              summary.missing.find((m) => m.key === v.key)?.missing ?? 0;
            return [
              v.label,
              v.group,
              v.unit,
              AGGREGATION_LABELS[v.aggregation],
              formatNumber(missing),
              percent(missing, records),
              <span key="d" title={v.definition}>
                {v.definition}
              </span>,
            ];
          })}
          sortKeys={catalog.variables.map((v) => [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            v.definition,
          ])}
        />
      </Section>

      <Section
        title="Grouping fields"
        note="Categories the selection can be grouped and compared by, with how many distinct values each has here. Fuel class and the control classes simplify the reported values."
      >
        <ReportTable
          head={["Field", "Distinct values"]}
          rows={summary.distinct.map((d) => [
            dimensionLabel(catalog, d.key),
            formatNumber(d.count),
          ])}
        />
      </Section>
    </div>
  );
}
