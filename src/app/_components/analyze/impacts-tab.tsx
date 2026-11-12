"use client";

import { Chart } from "~/components/ui/chart";
import { InlineLoading, QueryError } from "~/components/ui/empty-state";
import { ExportButton } from "~/components/ui/export-button";
import { Disclosure, ReportTable, Section } from "~/components/ui/report";
import { formatStat } from "~/lib/analysis";
import { IMPACT_DISCLAIMER, SHORT_TON_KG } from "~/lib/traci";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  asDimension,
  bind,
  Controls,
  DimensionField,
  dimensionLabel,
  inSentence,
  Toggle,
  valueColumn,
  type TabProps,
} from "./shared";

const POLLUTANT_LABELS: Record<string, string> = {
  co2: "CO₂",
  so2: "SO₂",
  nox: "NOₓ",
};

const TOP = 15;

/** "2.23T", "915M": impact totals run to 13 digits, which no one reads. */
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});
const formatImpact = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : Math.abs(v) >= 1e4
      ? compact.format(v)
      : formatStat(v);

/** §4.6: CAMPD emissions × TRACI factors, one result per impact category in its own unit. */
export function ImpactsTab(props: TabProps) {
  const { filters, view, catalog } = props;
  const perMWh = view.perMWh === "1";
  const by = asDimension(view.impactBy) ?? "state";
  const impacts = catalog.variables.filter(
    (v) => v.group === "TRACI impact" && v.key.endsWith("PerMWh") === perMWh,
  );
  // Each category ranks its own largest groups: the top 15 for acidification are not the top 15
  // for global warming.
  const tops = api.useQueries((t) =>
    impacts.map((v) =>
      t.analysis.aggregate({ filters, variables: [v.key], by, limit: TOP }),
    ),
  );
  const version = catalog.factors[0]?.traciVersion;
  const groupName = inSentence(dimensionLabel(catalog, by));
  const traciMeta = {
    variables: impacts,
    traciFactors: catalog.factors,
    shortTonKg: SHORT_TON_KG,
    note: IMPACT_DISCLAIMER,
  };

  return (
    <div className="space-y-6">
      <p className="border-warn text-fg-2 max-w-4xl border-l-2 pl-4 text-sm">
        {IMPACT_DISCLAIMER}
      </p>

      <Controls>
        <DimensionField {...bind(props, "impactBy")} />
        <Toggle
          {...bind(props, "perMWh")}
          label="Result"
          off="Total"
          on="Per MWh of gross load"
        />
      </Controls>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {impacts.map((v, i) => {
          const q = tops[i]!;
          const rows = (q.data?.rows ?? []).filter(
            (r) => r.values[v.key] != null,
          );
          return (
            <Chart
              key={v.key}
              title={`${v.label} by ${groupName}`}
              subtitle={`${v.unit}; the ${Math.min(TOP, rows.length)} largest of ${formatNumber(q.data?.total)} groups.`}
              note={v.definition}
              filename={`impact-${v.key}-by-${by}`}
              meta={traciMeta}
              isLoading={q.isLoading}
              error={q.error}
              onRetry={() => void q.refetch()}
              height={340}
              data={[
                {
                  type: "bar",
                  orientation: "h",
                  y: rows.map((r) => r.group),
                  x: rows.map((r) => r.values[v.key] ?? null),
                  hovertemplate: `%{y}: %{x:,.4~g} ${v.unit}<extra></extra>`,
                },
              ]}
              layout={{
                yaxis: {
                  autorange: "reversed",
                  automargin: true,
                  type: "category",
                },
                xaxis: { title: { text: v.unit } },
                margin: { l: 16, r: 16, t: 8, b: 48 },
              }}
              table={{
                head: [by, valueColumn(v)],
                rows: rows.map((r) => [r.group, r.values[v.key]]),
              }}
            />
          );
        })}
      </div>

      <Disclosure
        title={`All results by ${groupName}`}
        hint="every category side by side, with a CSV download"
      >
        <ResultsTable {...props} impacts={impacts} traciMeta={traciMeta} />
      </Disclosure>

      <Disclosure
        title={`TRACI ${version} factors used`}
        hint="how each CAMPD pollutant maps to a TRACI substance and factor"
      >
        <p className="text-fg-muted max-w-3xl text-xs">
          Matched by exact TRACI substance and the air medium; masses converted
          with 1 short ton = {SHORT_TON_KG} kg. Impact = Σ mass (kg) × factor
          over the pollutants in a category.
        </p>
        <ReportTable
          head={[
            "CAMPD pollutant",
            "TRACI substance",
            "CAS",
            "Impact category",
            "Factor",
            "Unit per kg",
          ]}
          rows={catalog.factors.map((f) => [
            POLLUTANT_LABELS[f.pollutant] ?? f.pollutant,
            f.substance,
            f.cas,
            f.impactCategory,
            String(Number(f.factor.toPrecision(6))),
            f.factorUnit,
          ])}
        />
        <div className="text-fg-muted max-w-4xl space-y-1 text-xs">
          {impacts.map((v) => (
            <p key={v.key}>
              <span className="text-fg-2 font-medium">{v.label}:</span>{" "}
              {v.definition}
            </p>
          ))}
        </div>
      </Disclosure>
    </div>
  );
}

/** Every category per group (up to 100 groups), loaded only when opened. */
function ResultsTable({
  filters,
  view,
  catalog,
  impacts,
  traciMeta,
}: TabProps & {
  impacts: TabProps["catalog"]["variables"];
  traciMeta: Record<string, unknown>;
}) {
  const perMWh = view.perMWh === "1";
  const by = asDimension(view.impactBy) ?? "state";
  const q = api.analysis.aggregate.useQuery({
    filters,
    variables: impacts.map((v) => v.key),
    by,
    limit: 100,
  });
  if (q.error)
    return <QueryError error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <InlineLoading title="Loading results…" />;
  const version = catalog.factors[0]?.traciVersion;
  const head = [
    dimensionLabel(catalog, by),
    "Unit-years",
    ...impacts.map((v) => `${v.label} (${v.unit})`),
  ];
  const table = q.data.rows.map((r) => [
    r.group,
    r.n,
    ...impacts.map((v) => r.values[v.key] ?? null),
  ]);
  return (
    <Section
      title={`${formatNumber(q.data.rows.length)} of ${formatNumber(q.data.total)} groups`}
      note={`Each category is summed only over its own pollutants and keeps its own unit; categories are never added together. A unit-year is left out of a category when one of its pollutants was not reported. Largest ${impacts[0]?.label.toLowerCase()} first; click a column to sort. The download has full precision.`}
      actions={
        <ExportButton
          name={`traci-${version}-impacts-by-${by}${perMWh ? "-per-mwh" : ""}`}
          title={`TRACI ${version} impacts by ${inSentence(dimensionLabel(catalog, by))}`}
          table={{ head, rows: table }}
          meta={traciMeta}
        />
      }
    >
      <ReportTable
        sortable
        head={head}
        rows={table.map(([group, n, ...values]) => [
          group,
          formatNumber(n as number),
          ...values.map((x) => formatImpact(x as number | null)),
        ])}
        sortKeys={table.map((r) => r.map((c) => c))}
      />
    </Section>
  );
}
