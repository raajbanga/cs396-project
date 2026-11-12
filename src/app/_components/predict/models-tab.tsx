"use client";

import { Chart, pointsType } from "~/components/ui/chart";
import { ExportButton } from "~/components/ui/export-button";
import {
  Disclosure,
  Field,
  ReportTable,
  Section,
} from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { formatStat } from "~/lib/analysis";
import { modelMetadata } from "~/lib/export-bundle";
import type { PredictView } from "~/lib/analysis-state";
import { getFuelTheme } from "~/lib/map-utils";
import { featureLabel, fitYears, MODEL_COLORS } from "~/lib/model";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Controls } from "../analyze/shared";
import type { Model } from "./predict-view";

const KIND_ORDER = ["baseline", "ridge", "tree"];

const metric = (m: Model, split: string, key: string) =>
  m.metrics[split]?.[key] ?? null;

/** The bootstrap 95 % interval of a test metric, as [low, high], or null for older models. */
const interval = (m: Model, key: string) => {
  const lo = metric(m, "test_ci_low", key);
  const hi = metric(m, "test_ci_high", key);
  return lo === null || hi === null ? null : ([lo, hi] as const);
};
const formatInterval = (ci: readonly [number, number] | null) =>
  ci ? `${formatStat(ci[0])}–${formatStat(ci[1])}` : "—";

/** Test metrics exported with their intervals (the table shows them under the value). */
const CI_METRICS = ["mae", "rmse", "r2"] as const;

/** The comparison table's columns: which split and metric, and which direction is better. */
const METRICS: {
  key: string;
  label: string;
  get: (m: Model) => number | null;
  lowerIsBetter?: boolean;
  /** A test metric with a bootstrap interval, drawn under its value. */
  ci?: (typeof CI_METRICS)[number];
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
    ci: "mae",
    label: "Test MAE (t)",
    get: (m) => metric(m, "test", "mae"),
    lowerIsBetter: true,
    format: formatStat,
  },
  {
    key: "test_rmse",
    ci: "rmse",
    label: "Test RMSE (t)",
    get: (m) => metric(m, "test", "rmse"),
    lowerIsBetter: true,
    format: formatStat,
  },
  {
    key: "test_r2",
    ci: "r2",
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

/** Tuned settings in words: "α = 10", "depth ≤ 20, leaves ≥ 20". */
const settings = (m: Model) => {
  const p = m.params as Record<string, number | null>;
  if (m.kind === "ridge") return `α = ${p.alpha}`;
  if (m.kind === "tree")
    return `${p.max_depth === null ? "unlimited depth" : `depth ≤ ${p.max_depth}`}, leaves ≥ ${p.min_samples_leaf}`;
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
  // "Both" (What-if's default) shows Ridge here.
  const chosen =
    sorted.find((m) => m.kind === view.model) ??
    sorted.find((m) => m.kind === "ridge") ??
    sorted[0]!;
  const [from, to] = chosen.testYears.split("-").map(Number);
  const tests = api.prediction.testPredictions.useQuery({
    from: from!,
    to: to!,
  });
  const points = tests.data ?? [];
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
      <Chart
        title={`Test error, ${chosen.testYears}: lower is better`}
        subtitle={`Mean absolute error per unit-year, with 95 % intervals; against the baseline, ${gains.join(", ")} lower.`}
        note={`Chronological split: trained on ${chosen.trainYears}, tuned on ${chosen.validationYears}, then refit on both and tested once on ${chosen.testYears}. The baseline predicts the training median of unit-years with the same fuel and unit type. Intervals come from resampling test units (a unit's two test years together).`}
        filename="test-mae"
        height={220}
        data={[
          {
            type: "bar",
            orientation: "h",
            y: sorted.map((m) => m.name),
            x: sorted.map((m) => metric(m, "test", "mae")),
            marker: { color: sorted.map((m) => MODEL_COLORS[m.kind]!) },
            // Whiskers from the point estimate to each end of the interval (none without one).
            error_x: {
              type: "data",
              symmetric: false,
              array: sorted.map((m) => {
                const [, hi] = interval(m, "mae") ?? [];
                const v = metric(m, "test", "mae");
                return hi !== undefined && v !== null ? hi - v : 0;
              }),
              arrayminus: sorted.map((m) => {
                const [lo] = interval(m, "mae") ?? [];
                const v = metric(m, "test", "mae");
                return lo !== undefined && v !== null ? v - lo : 0;
              }),
              thickness: 1.5,
              width: 6,
            },
            text: sorted.map(
              (m) => `${formatStat(metric(m, "test", "mae"))} t`,
            ),
            textposition: "inside",
            insidetextanchor: "start",
            customdata: sorted.map((m) => formatInterval(interval(m, "mae"))),
            hovertemplate:
              "%{y}: %{x:,.4~g} t<br>95 % interval %{customdata} t<extra></extra>",
          },
        ]}
        layout={{
          yaxis: { autorange: "reversed", automargin: true },
          xaxis: { title: { text: "Test MAE (short tons NOₓ)" } },
          margin: { l: 16, r: 48, t: 8, b: 48 },
        }}
        table={{
          head: [
            "model",
            "test_mae_tons",
            "test_mae_ci_low",
            "test_mae_ci_high",
          ],
          rows: sorted.map((m) => [
            m.id,
            metric(m, "test", "mae"),
            ...(interval(m, "mae") ?? [null, null]),
          ]),
        }}
      />

      <Section
        title="All metrics"
        note="Best value per column in bold. MAPE counts unit-years of at least 1 ton; the ablation column refits without same-year heat input, load, and hours; small print under a test value is its 95 % bootstrap interval over test units."
        actions={
          <ExportButton
            name="model-comparison"
            title="NOₓ model comparison"
            table={{
              head: [
                "model",
                "settings",
                ...METRICS.map((m) => m.key),
                ...CI_METRICS.flatMap((k) => [
                  `test_${k}_ci_low`,
                  `test_${k}_ci_high`,
                ]),
              ],
              rows: sorted.map((m) => [
                m.id,
                settings(m),
                ...METRICS.map((c) => c.get(m)),
                ...CI_METRICS.flatMap((k) => interval(m, k) ?? [null, null]),
              ]),
            }}
            meta={{ models: sorted.map(modelMetadata) }}
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
              const text =
                v === best && values.length > 1 ? (
                  <span className="text-fg font-semibold">{c.format(v)}</span>
                ) : (
                  c.format(v)
                );
              const ci = c.ci && interval(m, c.ci);
              return ci ? (
                <span key={c.key} title="95 % bootstrap interval">
                  {text}
                  <span className="text-fg-muted block text-xs">
                    {formatInterval(ci)}
                  </span>
                </span>
              ) : (
                <span key={c.key}>{text}</span>
              );
            }),
          ])}
        />
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
          subtitle={`${formatNumber(points.length)} test unit-years (an even sample), log scales; on the dashed line the prediction is exact.`}
          note="Predictions below 0.01 t are drawn at 0.01 so they fit the log scale."
          filename={`predicted-vs-actual-${chosen.id}`}
          isLoading={tests.isLoading}
          error={tests.error}
          onRetry={() => void tests.refetch()}
          height={440}
          data={[
            ...fuels.map((fuel) => {
              const pts = points.filter((p) => p.fuel === fuel && p.actual > 0);
              return {
                type: pointsType(),
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
                ? "Share of the tree's error reduction per input; the 15 largest."
                : "Effect on log(1 + NOₓ) per input; the 15 largest by size."
            }
            note={
              chosen.kind === "ridge"
                ? "Numeric inputs are standardized, so a coefficient is the effect of one standard deviation; for a category or control, the effect of it being present."
                : undefined
            }
            filename={`importance-${chosen.id}`}
            height={440}
            data={[
              {
                type: "bar",
                orientation: "h",
                y: importance.map(([k]) => featureLabel(k)),
                x: importance.map(([, v]) => v),
                marker: { color: MODEL_COLORS[chosen.kind] },
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

      <Disclosure
        title="Leakage rules and model record"
        hint="what the models may not see, settings, files, and versions"
      >
        <p className="text-fg-muted max-w-4xl text-sm">
          No same-year NOₓ, NOₓ rate, or value computed from them is an input;
          the previous year&apos;s NOₓ rate is allowed because it is known
          before the year starts. Same-year heat input, gross load, and
          operating time are inputs (the What-if scenarios change them), so the
          last metric refits without them: what remains is genuine prediction
          from unit attributes, controls, and history.
        </p>
        <ReportTable
          head={["Field", "Value"]}
          wrap={[1]}
          rows={[
            ["Model ID", chosen.id],
            ["Inputs", chosen.features.map(featureLabel).join(", ")],
            ["Fit on / tested on", `${fitYears(chosen)} / ${chosen.testYears}`],
            [
              "Tuning: trained / validated on",
              `${chosen.trainYears} / ${chosen.validationYears}`,
            ],
            ["Saved model", chosen.artifactPath],
            ["Pipeline", chosen.pipelineVersion],
            ["Trained", new Date(chosen.trainedAt).toLocaleString()],
            ["Target", chosen.target],
          ]}
        />
      </Disclosure>
    </div>
  );
}
