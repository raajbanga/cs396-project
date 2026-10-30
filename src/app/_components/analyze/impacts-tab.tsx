"use client";

import { ExportButton } from "~/components/ui/export-button";
import { Chart } from "~/components/ui/chart";
import { Field, ReportTable, Section } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { formatStat } from "~/lib/analysis";
import { IMPACT_DISCLAIMER, SHORT_TON_KG } from "~/lib/traci";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  asDimension,
  Controls,
  DimensionField,
  dimensionLabel,
  type TabProps,
} from "./shared";

const POLLUTANT_LABELS: Record<string, string> = {
  co2: "CO₂",
  so2: "SO₂",
  nox: "NOₓ",
};

/** §4.6: CAMPD emissions × TRACI factors, one result per impact category in its own unit. */
export function ImpactsTab({ filters, view, setView, catalog }: TabProps) {
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
      <p className="border-warn/40 text-fg-2 max-w-4xl rounded-md border px-3 py-2 text-sm">
        {IMPACT_DISCLAIMER}
      </p>

      <Controls>
        <DimensionField
          value={view.impactBy}
          onChange={(impactBy) => setView({ impactBy })}
          catalog={catalog}
        />
        <Field label="Result">
          <SegmentedControl
            value={perMWh ? "1" : "0"}
            onChange={(v) => setView({ perMWh: v === "1" ? "1" : "" })}
            options={[
              { value: "0", label: "Total" },
              { value: "1", label: "Per MWh of gross load" },
            ]}
          />
        </Field>
      </Controls>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {impacts.map((v) => {
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
                  hovertemplate: `%{y}: %{x:,.4~g} ${v.unit}<extra></extra>`,
                },
              ]}
              layout={{
                yaxis: { autorange: "reversed", automargin: true },
                xaxis: { title: { text: v.unit } },
                margin: { l: 16, r: 16, t: 8, b: 48 },
              }}
              table={{
                head: [by, `${v.key} (${v.unit})`],
                rows: top.map((r) => [r.group, r.values[v.key]]),
              }}
            />
          );
        })}
      </div>

      <Section
        title="Results by group"
        note={`Each category is summed only over its own pollutants and keeps its own unit; categories are never added together. A unit-year is left out of a category when one of its pollutants was not reported. ${formatNumber(rows.length)} of ${formatNumber(data?.total)} groups, largest ${impacts[0]?.label.toLowerCase()} first.`}
      >
        <div className="flex justify-end">
          <ExportButton
            name={`traci-${version}-impacts-by-${by}${perMWh ? "-per-mwh" : ""}`}
            title={`TRACI ${version} impacts by ${dimensionLabel(catalog, by).toLowerCase()}`}
            table={{ head, rows: table }}
            meta={traciMeta}
          />
        </div>
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
            String(f.factor),
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
