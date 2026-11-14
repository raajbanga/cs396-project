"use client";

import { BarList } from "~/components/charts/bars";
import { ChartFrame } from "~/components/ui/chart";
import { Disclosure, ReportTable, Section } from "~/components/ui/report";
import { Takeaways } from "~/components/ui/takeaways";
import { formatPct, formatStat } from "~/lib/analysis";
import {
  CATEGORY_INPUTS,
  categoryCurve,
  MODEL_COLORS,
  type CategoryInput,
} from "~/lib/model";
import { Controls } from "../analyze/shared";
import type { PredictTabProps } from "./predict-view";
import { VarySelect } from "./sensitivity";

const modelName = (m: PredictTabProps["chosen"][number]) =>
  m.kind === "tree" ? "the tree" : m.kind === "ridge" ? "Ridge" : m.name;

/**
 * §6.2 for a categorical input: the prediction with each fuel, unit type, or a control off and
 * on, everything else at the baseline. Bars, since categories have no order to draw a line along.
 */
export function CategorySection({
  view,
  setView,
  chosen,
  baseline,
  input,
}: PredictTabProps & { input: CategoryInput }) {
  const label = CATEGORY_INPUTS[input];
  // "primary fuel", but "SCR" and "SNCR" keep their capitals.
  const lower = /^[A-Z]{2}/.test(label) ? label : label.toLowerCase();
  const curves = chosen.map((m) => ({
    model: m,
    ...categoryCurve(m.artifact, baseline.inputs, input),
  }));
  const points = curves[0]!.points;
  const own = points.find((q) => q.baseline)!;

  // "With Ridge, Coal Refuse gives the most (3.1K t) and Pipeline Natural Gas the least (412 t)."
  const reading = curves.map(({ model: m, points: list }) => {
    const sorted = [...list].sort((a, b) => b.prediction - a.prediction);
    const hi = sorted[0]!;
    const lo = sorted.at(-1)!;
    const at = list.find((q) => q.baseline)!.prediction;
    // Under 1 % apart: the model doesn't use this input for this unit.
    if (hi.prediction - lo.prediction < Math.abs(at) * 0.01)
      return `${modelName(m).charAt(0).toUpperCase()}${modelName(m).slice(1)} barely responds: about ${formatStat(at)} t whatever the ${lower}${points.length === 2 ? " setting" : ""}.`;
    if (points.length === 2) {
      const other = list.find((q) => !q.baseline)!;
      return `With ${modelName(m)}, ${other.value ? "adding" : "removing"} ${label} changes the prediction by ${formatPct(other.diffPct)} (${other.diff > 0 ? "+" : ""}${formatStat(other.diff)} t).`;
    }
    return `With ${modelName(m)}, ${hi.label} gives the most (${formatStat(hi.prediction)} t) and ${lo.label} the least (${formatStat(lo.prediction)} t); as reported (${own.label}) it is ${formatStat(at)} t.`;
  });

  const order = [...points]
    .map((q, i) => ({ q, i }))
    .sort(
      (a, b) =>
        curves[0]!.points[b.i]!.prediction - curves[0]!.points[a.i]!.prediction,
    )
    .map(({ i }) => i);

  return (
    <Section
      title="Change one input"
      note="Every other input stays at its baseline value."
    >
      <Controls>
        <VarySelect view={view} setView={setView} />
      </Controls>

      <Takeaways items={reading} />

      <ChartFrame
        title={`Predicted NOₓ for each ${lower}${points.length === 2 ? " setting" : ""}`}
        subtitle={`${baseline.label}, short tons. "(reported)" marks the value the unit actually has; faded bars are values the model never saw in training.`}
        note="Each bar swaps only this input. A fuel or unit type changes what the model assumes about the whole unit, so read the bars as how the models respond, not what a real conversion would do."
        filename={`sensitivity-${input}`}
        height={points.length * 26}
        table={{
          head: [
            "model",
            input,
            "as_reported",
            "predicted_nox_tons",
            "prediction_change_tons",
            "prediction_change_pct",
            "outside_training_range",
          ],
          rows: curves.flatMap(({ model: m, points: list }) =>
            list.map((q) => [
              m.id,
              q.label,
              q.baseline,
              q.prediction,
              q.diff,
              q.diffPct,
              q.outside,
            ]),
          ),
        }}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 xl:grid-cols-2">
          {curves.map(({ model: m, points: list }) => (
            <div key={m.kind} className="min-w-0 space-y-1">
              <p className="text-fg-muted text-sm font-medium">{m.name}</p>
              <BarList
                unit="t"
                format={(v) => `${formatStat(v)} t`}
                rows={order.map((i) => {
                  const q = list[i]!;
                  return {
                    label: q.baseline ? `${q.label} (reported)` : q.label,
                    value: q.prediction,
                    color: MODEL_COLORS[m.kind],
                    faded: q.outside,
                    details: q.baseline
                      ? []
                      : [
                          {
                            label: "Change",
                            value: `${q.diff > 0 ? "+" : ""}${formatStat(q.diff)} t (${formatPct(q.diffPct)})`,
                          },
                        ],
                  };
                })}
              />
            </div>
          ))}
        </div>
      </ChartFrame>

      <Disclosure title="Show values" hint={`${points.length} values`}>
        <ReportTable
          head={[
            label,
            ...curves.flatMap(({ model: m }) => [`${m.name} (t)`, "Change"]),
          ]}
          rows={order.map((i) => [
            points[i]!.baseline
              ? `${points[i]!.label} (reported)`
              : points[i]!.label,
            ...curves.flatMap(({ points: list }) => [
              formatStat(list[i]!.prediction),
              list[i]!.baseline ? "—" : formatPct(list[i]!.diffPct),
            ]),
          ])}
        />
      </Disclosure>
    </Section>
  );
}
