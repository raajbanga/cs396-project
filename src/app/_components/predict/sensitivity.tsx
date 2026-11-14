"use client";

import { Lines } from "~/components/charts/lines";
import { Takeaways } from "~/components/ui/takeaways";
import { ChartFrame } from "~/components/ui/chart";
import { Input } from "~/components/ui/input";
import {
  Disclosure,
  Field,
  ReportTable,
  Section,
} from "~/components/ui/report";
import { Select } from "~/components/ui/select";
import { formatPct, formatStat } from "~/lib/analysis";
import {
  CATEGORY_INPUTS,
  isCategoryInput,
  MAX_SENSITIVITY_POINTS,
  MODEL_COLORS,
  NUMERIC_INPUTS,
  sensitivityCurve,
  sensitivityGrid,
  type NumericInput,
} from "~/lib/model";
import { Controls, Toggle } from "../analyze/shared";
import { CategorySection } from "./category-sensitivity";
import { rangeWarning, type PredictTabProps } from "./predict-view";

/** The input a sensitivity varies: a number (a curve) or a category (bars). */
export function VarySelect({
  view,
  setView,
}: Pick<PredictTabProps, "view" | "setView">) {
  return (
    <Field label="Vary">
      <Select
        value={view.input}
        onValueChange={(v) =>
          setView({ input: v, values: "", from: "-50", to: "50", step: "5" })
        }
        className="w-60"
        options={[
          ...Object.entries(NUMERIC_INPUTS).map(([value, m]) => ({
            value,
            label: `${m.label} (${m.unit})`,
          })),
          ...Object.entries(CATEGORY_INPUTS).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
      />
    </Field>
  );
}

/** Three significant figures, for range defaults in an input's own unit. */
const round3 = (x: number) => Number(x.toPrecision(3));

/**
 * §6.2: one input varied from a minimum to a maximum, as values in its own unit or as
 * percentages of the baseline value, everything else held constant; one curve per chosen model.
 * §6.4: the curve marks the baseline and shades values outside the training data.
 */
export function SensitivitySection(props: PredictTabProps) {
  return isCategoryInput(props.view.input) ? (
    <CategorySection {...props} input={props.view.input} />
  ) : (
    <NumericSection {...props} />
  );
}

function NumericSection({ view, setView, chosen, baseline }: PredictTabProps) {
  const input = (
    view.input in NUMERIC_INPUTS ? view.input : "heat_input_mmbtu"
  ) as NumericInput;
  const meta = NUMERIC_INPUTS[input];
  // Every model is trained on the same rows, so their ranges are the same.
  const first = chosen[0]!.artifact;
  const [min, max] = first.ranges.numeric[input];
  const base = baseline.inputs;
  const median = first.spec.numeric.find((f) => f.name === input)?.median ?? 0;
  const value0 = base[input] ?? median;
  const asValues = view.values === "1";

  // The grid of input values, always including the baseline itself.
  const from = Number(view.from) || 0;
  const to = Number(view.to) || 0;
  const step = Number(view.step);
  const grid = sensitivityGrid(value0, from, to, step, asValues);
  const { values, capped } = grid;
  // What the grid had to correct, said next to the inputs instead of silently.
  const stepFixed = grid.step !== step;
  const curves = chosen.map((m) => ({
    model: m,
    ...sensitivityCurve(m.artifact, base, input, values, value0),
  }));
  // "Over this range, Ridge goes from 1.95K to 3.83K t (2.97K at the baseline); …"
  const reading = `Over this range, ${curves
    .map(({ model: m, points, pred0 }) => {
      const first = points[0]?.prediction ?? null;
      const last = points.at(-1)?.prediction ?? null;
      return `${m.kind === "tree" ? "the tree" : m.kind === "ridge" ? "Ridge" : m.name} goes from ${formatStat(first)} to ${formatStat(last)} t (${formatStat(pred0)} at the baseline)`;
    })
    .join("; ")}.`;
  const lo = values[0] ?? value0;
  const hi = values.at(-1) ?? value0;
  const outside = curves[0]!.points.filter((q) => q.outside).length;

  /** Switching units keeps the same span: ±50 % of the baseline, or the values it covers. */
  const setUnits = (v: string) =>
    setView(
      v
        ? {
            values: "1",
            from: String(round3(value0 * 0.5)),
            to: String(round3(value0 * 1.5)),
            step: String(round3((value0 || 1) * 0.05)),
          }
        : { values: "", from: "-50", to: "50", step: "5" },
    );
  const unit = asValues ? meta.unit : "% of baseline";

  return (
    <Section
      title="Change one input"
      note="Every other input stays at its baseline value."
    >
      <Controls>
        <VarySelect view={{ ...view, input }} setView={setView} />
        <Toggle
          label="Range in"
          value={view.values}
          onChange={setUnits}
          off="% of baseline"
          on={meta.unit}
          titles={[
            "Set the range as percentages of this unit's actual value (-50 to 50 means half to one and a half times it).",
            `Set the range in ${meta.unit} directly.`,
          ]}
        />
        {(
          [
            ["from", "Minimum"],
            ["to", "Maximum"],
            ["step", "Step"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={`${label} (${unit})`}>
            <Input
              type="number"
              value={view[key]}
              aria-invalid={
                (key === "step" && stepFixed) ||
                (key !== "step" && grid.reversed) ||
                (key === "from" && grid.negative > 0)
              }
              onChange={(e) => setView({ [key]: e.target.value })}
              className="h-9 w-32"
            />
          </Field>
        ))}
      </Controls>
      {(grid.reversed || stepFixed || grid.negative > 0) && (
        <p role="alert" className="text-warn text-sm">
          {grid.reversed &&
            `The minimum (${formatStat(from)}) is above the maximum (${formatStat(to)}); the curve runs from ${formatStat(to)} to ${formatStat(from)} ${unit}. `}
          {stepFixed &&
            `The step must be a positive number; a step of ${formatStat(grid.step)} ${unit} is used. `}
          {grid.negative > 0 &&
            `${meta.label} can't be below 0, so the curve starts at 0 (${grid.negative} impossible ${grid.negative === 1 ? "point" : "points"} left out).`}
        </p>
      )}
      {base[input] === null && (
        <p className="text-warn text-sm">
          The baseline has no {meta.label.toLowerCase()}; the model&apos;s
          training median ({formatStat(median)} {meta.unit}) stands in for it.
        </p>
      )}
      {(outside > 0 || capped) && (
        <p className="text-warn text-sm">
          {outside > 0 &&
            `${rangeWarning([input])} (${outside} of ${values.length} points, shaded.) `}
          {capped &&
            `The curve stops at ${MAX_SENSITIVITY_POINTS} points; use a larger step to cover the whole range.`}
        </p>
      )}

      <Takeaways items={[reading]} />

      <ChartFrame
        title={`Predicted NOₓ as ${meta.label.toLowerCase()} changes`}
        subtitle={`Dots and dashed lines mark the baseline; shading is outside the training data. ${baseline.label}, short tons.`}
        note={`Training data range: ${formatStat(min)}–${formatStat(max)} ${meta.unit}. This shows how each model responds, not a measured real-world effect.`}
        legend={curves.map(({ model: m }) => ({
          key: m.kind,
          label: m.name,
          color: MODEL_COLORS[m.kind]!,
        }))}
        filename={`sensitivity-${input}`}
        height={340}
        table={{
          head: [
            "model",
            `${input} (${meta.unit})`,
            "change_from_baseline_pct",
            "predicted_nox_tons",
            "prediction_change_tons",
            "prediction_change_pct",
            "outside_training_range",
          ],
          rows: curves.flatMap(({ model: m, points }) =>
            points.map((q) => [
              m.id,
              q.value,
              q.change,
              q.prediction,
              q.diff,
              q.diffPct,
              q.outside,
            ]),
          ),
        }}
      >
        <Lines
          height={340}
          xTitle={`${meta.label} (${meta.unit})`}
          unit="t"
          data={values.map((x, i) => ({
            x,
            ...Object.fromEntries(
              curves.map(({ model: m, points }) => [
                m.kind,
                points[i]?.prediction ?? null,
              ]),
            ),
          }))}
          series={curves.map(({ model: m }) => ({
            key: m.kind,
            label: m.name,
            color: MODEL_COLORS[m.kind]!,
          }))}
          refLines={[
            { axis: "x", value: value0 },
            ...curves.map(({ model: m, pred0 }) => ({
              axis: "y" as const,
              value: pred0,
              color: MODEL_COLORS[m.kind],
            })),
          ]}
          bands={[
            ...(lo < min ? [{ from: lo, to: min }] : []),
            ...(hi > max ? [{ from: max, to: hi }] : []),
          ]}
          markers={curves.map(({ model: m, pred0 }) => ({
            x: value0,
            y: pred0,
            color: MODEL_COLORS[m.kind]!,
          }))}
          tooltipRows={(row, s) => {
            const point = curves
              .find((c) => c.model.kind === s.key)
              ?.points.find((q) => q.value === row.x);
            return point
              ? [
                  {
                    label: "Change",
                    value: `${point.diff > 0 ? "+" : ""}${formatStat(point.diff)} t (${formatPct(point.diffPct)})`,
                  },
                ]
              : [];
          }}
        />
      </ChartFrame>

      <Disclosure title="Show values" hint={`${values.length} points`}>
        <ReportTable
          sortable
          head={[
            `${meta.label} (${meta.unit})`,
            "Input change",
            ...curves.flatMap(({ model: m }) => [`${m.name} (t)`, "Change"]),
            "Training range",
          ]}
          rows={values.map((value, i) => [
            formatStat(value),
            value === value0
              ? "baseline"
              : formatPct(curves[0]!.points[i]!.change),
            ...curves.flatMap(({ points }) => [
              formatStat(points[i]!.prediction),
              formatPct(points[i]!.diffPct),
            ]),
            curves[0]!.points[i]!.outside ? "outside" : "inside",
          ])}
          sortKeys={values.map((value, i) => [
            value,
            curves[0]!.points[i]!.change,
            ...curves.flatMap(({ points }) => [
              points[i]!.prediction,
              points[i]!.diffPct,
            ]),
            undefined,
          ])}
        />
      </Disclosure>
    </Section>
  );
}
