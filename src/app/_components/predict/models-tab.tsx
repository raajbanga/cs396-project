"use client";

import { BarList } from "~/components/charts/bars";
import { ScatterPlot } from "~/components/charts/scatter";
import { ChartFrame, queryStatus } from "~/components/ui/chart";
import { Takeaways } from "~/components/ui/takeaways";
import { modelSentence } from "~/lib/takeaways";
import { ExportButton, ExportContext } from "~/components/ui/export-button";
import { Button } from "~/components/ui/button";
import { downloadBundle } from "~/lib/export-bundle";
import { use, useState } from "react";
import { Download } from "lucide-react";
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

  // The plain answer: how far off the best model is, in tons and relative to the actual value.
  const best = sorted
    .filter((m) => m !== base)
    .sort(
      (a, b) =>
        (metric(a, "test", "mae") ?? Infinity) -
        (metric(b, "test", "mae") ?? Infinity),
    )[0];

  const persistence = best ? metric(best, "persistence_test", "mae") : null;
  // The importance chart in words: what pushes NOₓ up and down most (Ridge), or what the tree leans on.
  const [first, second] = importance;
  const cut = importance.find(([, v]) => v < 0);
  const up = importance.find(([, v]) => v > 0);
  const reading =
    chosen.kind === "tree"
      ? first &&
        `The tree leans most on ${featureLabel(first[0]).toLowerCase()} (${(first[1] * 100).toFixed(0)} % of its error reduction)${second ? ` and ${featureLabel(second[0]).toLowerCase()} (${(second[1] * 100).toFixed(0)} %)` : ""}.`
      : [
          up && `${featureLabel(up[0])} raises predicted NOₓ the most`,
          cut && `${featureLabel(cut[0])} lowers it the most`,
        ]
          .filter(Boolean)
          .join("; ") + ".";

  return (
    <div className="space-y-8">
      {best && (
        <Takeaways
          items={[
            modelSentence(
              {
                name: best.name,
                mae: metric(best, "test", "mae"),
                r2: metric(best, "test", "r2"),
              },
              base ? metric(base, "test", "mae") : null,
              metric(best, "test", "mape"),
            ),
            `Tested on ${chosen.testYears}, years none of the models saw while training.`,
            persistence !== null &&
              `A simple rule does better still: last year's NOₓ rate × this year's heat input is off by ${formatStat(persistence)} t on average. NOₓ mostly follows last year's rate times this year's fuel use, which the models only approximate.`,
          ]}
        />
      )}
      <ChartFrame
        title={`Test error, ${chosen.testYears}: lower is better`}
        subtitle={`Mean absolute error per unit-year in short tons NOₓ, with 95 % intervals; against the baseline, ${gains.join(", ")} lower.`}
        note={`Chronological split: trained on ${chosen.trainYears}, tuned on ${chosen.validationYears}, then refit on both and tested once on ${chosen.testYears}. The baseline predicts the training median of unit-years with the same fuel and unit type. Intervals come from resampling test units (a unit's two test years together).`}
        filename="test-mae"
        height={sorted.length * 26}
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
      >
        <BarList
          unit="t"
          rows={sorted.map((m) => {
            const [low, high] = interval(m, "mae") ?? [];
            return {
              label: m.name,
              value: metric(m, "test", "mae"),
              low,
              high,
              color: MODEL_COLORS[m.kind],
            };
          })}
        />
      </ChartFrame>

      <Disclosure
        title="All metrics"
        hint="Validation and test error, R², MAPE, intervals, and the ablation, per model"
      >
        <Section
          title=""
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
      </Disclosure>

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
        <ChartFrame
          title={`Predicted vs actual NOₓ, ${chosen.testYears}`}
          subtitle={`${formatNumber(points.length)} test unit-years (an even sample), log scales. On the dashed line the prediction is exact; above it, over-predicted.`}
          note="Predictions below 0.01 t are drawn at 0.01 so they fit the log scale. Log scales let small and large units show on one chart."
          legend={fuels.map((fuel) => ({
            key: fuel,
            label: fuel,
            color: getFuelTheme(fuel).color,
          }))}
          filename={`predicted-vs-actual-${chosen.id}`}
          actions={
            <AllPredictionsButton from={from!} to={to!} models={sorted} />
          }
          height={420}
          {...queryStatus(tests)}
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
        >
          <ScatterPlot
            log
            height={420}
            // Clipped to the axes: the line where prediction equals actual.
            diagonal={[1e-6, 1e9]}
            x={{ title: "Actual NOₓ (short tons)", unit: "t" }}
            y={{ title: "Predicted NOₓ (short tons)", unit: "t" }}
            groups={fuels.map((fuel) => ({
              label: fuel,
              color: getFuelTheme(fuel).color,
              points: points
                .filter((p) => p.fuel === fuel && p.actual > 0)
                .map((p) => ({
                  x: p.actual,
                  y: Math.max(p.predicted[chosen.kind] ?? 0, 0.01),
                  label: p.label,
                })),
            }))}
          />
        </ChartFrame>
        {chosen.kind !== "baseline" && (
          <ChartFrame
            title={
              chosen.kind === "tree"
                ? "Feature importance"
                : "Ridge coefficients (standardized inputs)"
            }
            subtitle={
              chosen.kind === "tree"
                ? `${reading} Share of the tree's error reduction per input; the 15 largest.`
                : `${reading} Right of the line: more NOₓ; left: less. The 15 largest effects.`
            }
            note={
              chosen.kind === "ridge"
                ? "Numeric inputs are standardized, so a coefficient is the effect of one standard deviation; for a category or control, the effect of it being present."
                : undefined
            }
            filename={`importance-${chosen.id}`}
            height={importance.length * 26}
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
          >
            <BarList
              format={(v) => v.toFixed(chosen.kind === "tree" ? 3 : 2)}
              color={MODEL_COLORS[chosen.kind]}
              rows={importance.map(([k, v]) => ({
                label: featureLabel(k),
                value: v,
              }))}
            />
          </ChartFrame>
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

/**
 * §7 "model evaluation results and predictions": every test unit-year with each model's
 * prediction and error, as a ZIP with the page's metadata. The chart's own download holds only
 * the plotted sample.
 */
function AllPredictionsButton({
  from,
  to,
  models,
}: {
  from: number;
  to: number;
  models: Model[];
}) {
  const utils = api.useUtils();
  const shared = use(ExportContext);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      title="Every test unit-year with each model's prediction and error, as CSV in a ZIP with metadata.json"
      onClick={async () => {
        setBusy(true);
        try {
          const rows = await utils.prediction.testPredictions.fetch({
            from,
            to,
            all: true,
          });
          downloadBundle(
            `test-predictions-${from}-${to}`,
            {
              head: [
                "facility_id",
                "unit_id",
                "year",
                "fuel_class",
                "actual_nox_tons",
                ...models.flatMap((m) => [
                  `${m.kind}_predicted_tons`,
                  `${m.kind}_error_tons`,
                ]),
              ],
              rows: rows.map((r) => [
                r.facilityId,
                r.unitId,
                r.year,
                r.fuel,
                r.actual,
                ...models.flatMap((m) => {
                  const p = r.predicted[m.kind] ?? null;
                  return [p, p === null ? null : p - r.actual];
                }),
              ]),
            },
            {
              ...shared,
              title: `NOₓ test predictions, ${from}–${to} (every unit-year, every model)`,
            },
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <Download className="h-3.5 w-3.5" />
      {busy ? "Preparing…" : "All test predictions"}
    </Button>
  );
}
