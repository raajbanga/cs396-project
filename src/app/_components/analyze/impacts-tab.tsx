"use client";

import { ExportButton } from "~/components/ui/export-button";
import { Chart } from "~/components/ui/chart";
import { ReportTable, Section } from "~/components/ui/report";
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
  Toggle,
  valueColumn,
  type TabProps,
} from "./shared";

/** One mid-tone color per impact category, readable on both themes. */
const CATEGORY_COLORS = ["#b45309", "#2563eb", "#0d9488", "#a21caf"];

const POLLUTANT_LABELS: Record<string, string> = {
  co2: "CO₂",
  so2: "SO₂",
  nox: "NOₓ",
};

/** §4.6: CAMPD emissions × TRACI factors, one result per impact category in its own unit. */
export function ImpactsTab(props: TabProps) {
  const { filters, view, catalog } = props;
  const perMWh = view.perMWh === "1";
  const by = asDimension(view.impactBy) ?? "state";
  const impacts = catalog.variables.filter(
    (v) => v.group === "TRACI impact" && v.key.endsWith("PerMWh") === perMWh,
  );
  const { data, isLoading } = api.analysis.aggregate.useQuery({
    filters,
    variables: impacts.map((v) => v.key),
    by,
    limit: 100,
  });
  const rows = data?.rows ?? [];
  const head = [
    dimensionLabel(catalog, by),
    "Unit-years",
    ...impacts.map((v) => `${v.label} (${v.unit})`),
  ];
  const table = rows.map((r) => [
    r.group,
    r.n,
    ...impacts.map((v) => r.values[v.key] ?? null),
  ]);
  const version = catalog.factors[0]?.traciVersion;
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
          const top = [...rows]
            .filter((r) => r.values[v.key] != null)
            .sort((a, b) => b.values[v.key]! - a.values[v.key]!)
            .slice(0, 15);
          return (
            <Chart
              key={v.key}
              title={`${v.label} by ${dimensionLabel(catalog, by).toLowerCase()}`}
              subtitle={`${v.unit}; the 15 largest of ${formatNumber(data?.total)} groups.`}
              filename={`impact-${v.key}-by-${by}`}
              meta={traciMeta}
              isLoading={isLoading}
              height={340}
              data={[
                {
                  type: "bar",
                  orientation: "h",
                  y: top.map((r) => r.group),
                  x: top.map((r) => r.values[v.key] ?? null),
                  marker: {
                    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                  },
                  hovertemplate: `%{y}: %{x:,.4~g} ${v.unit}<extra></extra>`,
                },
              ]}
              layout={{
                yaxis: { autorange: "reversed", automargin: true },
                xaxis: { title: { text: v.unit } },
                margin: { l: 16, r: 16, t: 8, b: 48 },
              }}
              table={{
                head: [by, valueColumn(v)],
                rows: top.map((r) => [r.group, r.values[v.key]]),
              }}
            />
          );
        })}
      </div>

      <Section
        title="Results by group"
        note={`Each category is summed only over its own pollutants and keeps its own unit; categories are never added together. A unit-year is left out of a category when one of its pollutants was not reported. ${formatNumber(rows.length)} of ${formatNumber(data?.total)} groups, largest ${impacts[0]?.label.toLowerCase()} first.`}
        actions={
          <ExportButton
            name={`traci-${version}-impacts-by-${by}${perMWh ? "-per-mwh" : ""}`}
            title={`TRACI ${version} impacts by ${dimensionLabel(catalog, by).toLowerCase()}`}
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
            ...values.map((x) => formatStat(x as number | null)),
          ])}
          sortKeys={table.map((r) => r.map((c) => c))}
        />
      </Section>

      <Section
        title={`TRACI ${version} factors used`}
        note={`Matched by exact TRACI substance and the air medium; masses converted with 1 short ton = ${SHORT_TON_KG} kg. Impact = Σ mass (kg) × factor over the pollutants in a category.`}
      >
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
      </Section>
    </div>
  );
}
