"use client";

import { Chart } from "~/components/ui/chart";
import { ExportButton } from "~/components/ui/export-button";
import { Field, ReportTable, Section } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { formatStat } from "~/lib/analysis";
import type { PredictView } from "~/lib/analysis-state";
import { getFuelTheme } from "~/lib/map-utils";
import { featureLabel } from "~/lib/model";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Controls } from "../analyze/shared";
import type { Model } from "./predict-view";

const KIND_ORDER = ["baseline", "ridge", "tree"];

const metric = (m: Model, split: string, key: string) =>
  m.metrics[split]?.[key] ?? null;

/** The comparison table's columns: which split and metric, and which direction is better. */
const METRICS: {
  key: string;
  label: string;
  get: (m: Model) => number | null;
  lowerIsBetter?: boolean;
  format: (v: number | null) => string;
}[] = [
  {
    key: "validation_mae",
    label: "Val. MAE (t)",
    get: (m) => metric(m, "validation", "mae"),
    lowerIsBetter: true,
    format: formatStat,
  },
  {
    key: "validation_r2",
    label: "Val. R²",
    get: (m) => metric(m, "validation", "r2"),
    format: formatStat,
  },
  {
    key: "test_mae",
    label: "Test MAE (t)",
    get: (m) => metric(m, "test", "mae"),
    lowerIsBetter: true,
    format: formatStat,
  },
  {
    key: "test_rmse",
    label: "Test RMSE (t)",
    get: (m) => metric(m, "test", "rmse"),
    lowerIsBetter: true,
    format: formatStat,
  },
  {
    key: "test_r2",
    label: "Test R²",
    get: (m) => metric(m, "test", "r2"),
    format: formatStat,
  },
  {
    key: "test_mape_pct",
    label: "Test MAPE",
    get: (m) => metric(m, "test", "mape"),
    lowerIsBetter: true,
    format: (v) => (v === null ? "—" : `${formatStat(v)} %`),
  },
  {
    key: "validation_r2_without_activity",
    label: "Val. R², no same-year activity",
    get: (m) => metric(m, "validation_without_activity", "r2"),
    format: formatStat,
  },
];

/** Tuned settings in words: "α = 10", "depth 16, leaves ≥ 20". */
const settings = (m: Model) => {
  const p = m.params as Record<string, number>;
  if (m.kind === "ridge") return `α = ${p.alpha}`;
  if (m.kind === "tree")
    return `depth ${p.max_depth}, leaves ≥ ${p.min_samples_leaf}`;
  return "median of training years";
};

/** §5.3–§5.4: every model against the baseline on validation and test years, with its evidence. */
export function ModelsTab({
  models,
  view,
  setView,
}: {
  models: Model[];
  view: PredictView;
  setView: (patch: Partial<PredictView>) => void;
}) {
  const sorted = [...models].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  const chosen = sorted.find((m) => m.kind === view.model) ?? sorted[0]!;
  const [from, to] = chosen.testYears.split("-").map(Number);
  const { data, isLoading } = api.prediction.testPredictions.useQuery({
    from: from!,
    to: to!,
  });
  const points = data ?? [];
  const fuels = [...new Set(points.map((p) => p.fuel))];
  const maxActual = Math.max(1, ...points.map((p) => p.actual));
  const base = sorted.find((m) => m.kind === "baseline");
  const gains = sorted
    .filter((m) => m !== base && base)
    .map((m) => {
      const b = metric(base!, "test", "mae");
      const t = metric(m, "test", "mae");
      return b && t !== null
        ? `${m.name} ${((1 - t / b) * 100).toFixed(0)} %`
        : null;
    })
    .filter(Boolean);
  const importance = Object.entries(chosen.artifact.importance)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 15);

  return (
    <div className="space-y-8">
      <Section
        title="Model comparison"
        note={`Target: ${chosen.target}. Chronological split: trained on ${chosen.trainYears}, tuned on ${chosen.validationYears}, then refit on both and tested once on ${chosen.testYears}. Against the baseline, test MAE is lower by: ${gains.join("; ")}. “Val.” is validation; the last column refits without same-year heat input, load, and hours. MAPE counts only unit-years of at least 1 ton (smaller ones make percentages explode). The best value in each column is in bold.`}
        actions={
          <ExportButton
            name="model-comparison"
            title="NOₓ model comparison"
            table={{
              head: ["model", "settings", ...METRICS.map((m) => m.key)],
              rows: sorted.map((m) => [
                m.id,
                settings(m),
                ...METRICS.map((c) => c.get(m)),
              ]),
            }}
            meta={{ models: sorted.map(({ artifact: _a, ...m }) => m) }}
          />
        }
      >
        <ReportTable
          head={["Model", "Settings", ...METRICS.map((m) => m.label)]}
          rows={sorted.map((m) => [
            <span key="n" className="text-fg font-medium">
              {m.name}
            </span>,
            settings(m),
            ...METRICS.map((c) => {
              const v = c.get(m);
              const values = sorted.map(c.get).filter((x) => x !== null);
              const best = c.lowerIsBetter
                ? Math.min(...values)
                : Math.max(...values);
              const text = c.format(v);
              return v === best && values.length > 1 ? (
                <span key={c.key} className="text-fg font-semibold">
                  {text}
                </span>
              ) : (
                text
              );
            }),
          ])}
        />
        <p className="text-fg-muted max-w-4xl text-xs">
          Leakage rules: no same-year NOₓ, NOₓ rate, or value computed from them
          is an input; the previous year's NOₓ rate is allowed because it is
          known before the year starts. Same-year heat input, gross load, and
          operating time are inputs (the scenarios change them), so the last
          column refits without them: what remains is genuine prediction from
          unit attributes, controls, and history.
        </p>
      </Section>

      <Controls>
        <Field group label="Model">
          <SegmentedControl
            value={chosen.kind}
            onChange={(model) => setView({ model })}
            options={sorted.map((m) => ({ value: m.kind, label: m.name }))}
          />
        </Field>
      </Controls>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Chart
          title={`Predicted vs actual NOₓ, ${chosen.testYears}`}
          subtitle={`An even sample of ${formatNumber(points.length)} test unit-years, log scales. On the dashed line the prediction is exact; predictions below 0.01 t are drawn at 0.01.`}
          filename={`predicted-vs-actual-${chosen.id}`}
          isLoading={isLoading}
          height={440}
          data={[
            ...fuels.map((fuel) => {
              const pts = points.filter((p) => p.fuel === fuel && p.actual > 0);
              return {
                type: "scattergl" as const,
                mode: "markers" as const,
                name: fuel,
                x: pts.map((p) => p.actual),
                y: pts.map((p) =>
                  Math.max(p.predicted[chosen.kind] ?? 0, 0.01),
                ),
                text: pts.map((p) => p.label),
                marker: {
                  size: 5,
                  opacity: 0.55,
                  color: getFuelTheme(fuel).color,
                },
                hovertemplate:
                  "%{text}<br>actual %{x:,.4~g} t<br>predicted %{y:,.4~g} t<extra></extra>",
              };
            }),
            {
              type: "scatter",
              mode: "lines",
              name: "Exact",
              x: [0.01, maxActual],
              y: [0.01, maxActual],
              line: { dash: "dash", width: 1, color: "gray" },
              hoverinfo: "skip",
            },
          ]}
          layout={{
            xaxis: { title: { text: "Actual NOₓ (short tons)" }, type: "log" },
            yaxis: {
              title: { text: "Predicted NOₓ (short tons)" },
              type: "log",
            },
          }}
          table={{
            head: [
              "unit_year",
              "fuel_class",
              "actual_tons",
              ...sorted.map((m) => `${m.kind}_predicted_tons`),
            ],
            rows: points.map((p) => [
              p.label,
              p.fuel,
              p.actual,
              ...sorted.map((m) => p.predicted[m.kind]),
            ]),
          }}
        />
        {chosen.kind !== "baseline" && (
          <Chart
            title={
              chosen.kind === "tree"
                ? "Feature importance"
                : "Ridge coefficients (standardized inputs)"
            }
            subtitle={
              chosen.kind === "tree"
                ? "Share of the tree's error reduction from each input; the 15 largest."
                : "Effect on log(1 + NOₓ) of one standard deviation (numeric) or of the category or control being present; the 15 largest by size."
            }
            filename={`importance-${chosen.id}`}
            height={440}
            data={[
              {
                type: "bar",
                orientation: "h",
                y: importance.map(([k]) => featureLabel(k)),
                x: importance.map(([, v]) => v),
                hovertemplate: "%{y}: %{x:.4f}<extra></extra>",
              },
            ]}
            layout={{
              yaxis: { autorange: "reversed", automargin: true },
              xaxis: {
                title: {
                  text: chosen.kind === "tree" ? "Importance" : "Coefficient",
                },
              },
              margin: { l: 16, r: 16, t: 8, b: 48 },
            }}
            table={{
              head: [
                "feature",
                chosen.kind === "tree" ? "importance" : "coefficient",
              ],
              rows: Object.entries(chosen.artifact.importance).map(([k, v]) => [
                featureLabel(k),
                v,
              ]),
            }}
          />
        )}
      </div>

      <Section title="Model record">
        <ReportTable
          head={["Field", "Value"]}
          wrap={[1]}
          rows={[
            ["Model ID", chosen.id],
            ["Inputs", chosen.features.map(featureLabel).join(", ")],
            [
              "Training / validation / test years",
              `${chosen.trainYears} / ${chosen.validationYears} / ${chosen.testYears}`,
            ],
            ["Saved model", chosen.artifactPath],
            ["Pipeline", chosen.pipelineVersion],
            ["Trained", new Date(chosen.trainedAt).toLocaleString()],
          ]}
        />
      </Section>
    </div>
  );
}
