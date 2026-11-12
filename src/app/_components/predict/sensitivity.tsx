"use client";

import type { Data, Shape } from "plotly.js";
import { Chart } from "~/components/ui/chart";
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
  MAX_SENSITIVITY_POINTS,
  MODEL_COLORS,
  NUMERIC_INPUTS,
  sensitivityCurve,
  sensitivityGrid,
  type NumericInput,
} from "~/lib/model";
import { Controls, Toggle } from "../analyze/shared";
import { rangeWarning, type PredictTabProps } from "./predict-view";

/** A dashed reference line at x (vertical) or y (horizontal). */
const refLine = (axis: "x" | "y", at: number): Partial<Shape> => ({
  type: "line",
  xref: axis === "x" ? "x" : "paper",
  yref: axis === "y" ? "y" : "paper",
  ...(axis === "x"
    ? { x0: at, x1: at, y0: 0, y1: 1 }
    : { x0: 0, x1: 1, y0: at, y1: at }),
  line: { dash: "dash", width: 1, color: "gray" },
});

/** A shaded band over [x0, x1]: inputs outside the training data. */
const outsideBand = (x0: number, x1: number): Partial<Shape> => ({
  type: "rect",
  xref: "x",
  yref: "paper",
  x0,
  x1,
  y0: 0,
  y1: 1,
  fillcolor: "rgba(120, 113, 108, 0.14)",
  line: { width: 0 },
});

/** Three significant figures, for range defaults in an input's own unit. */
const round3 = (x: number) => Number(x.toPrecision(3));

/**
 * §6.2: one input varied from a minimum to a maximum, as values in its own unit or as
 * percentages of the baseline value, everything else held constant; one curve per chosen model.
 * §6.4: the curve marks the baseline and shades values outside the training data.
 */
export function SensitivitySection({
  view,
  setView,
  chosen,
  baseline,
}: PredictTabProps) {
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
  const { values, capped } = sensitivityGrid(
    value0,
    Number(view.from) || 0,
    Number(view.to) || 0,
    Number(view.step),
    asValues,
  );
  const curves = chosen.map((m) => ({
    model: m,
    ...sensitivityCurve(m.artifact, base, input, values, value0),
  }));
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
        <Field label="Vary">
          <Select
            value={input}
            onValueChange={(v) =>
              setView({
                input: v,
                values: "",
                from: "-50",
                to: "50",
                step: "5",
              })
            }
            className="w-60"
            options={Object.entries(NUMERIC_INPUTS).map(([value, m]) => ({
              value,
              label: `${m.label} (${m.unit})`,
            }))}
          />
        </Field>
        <Toggle
          label="Range in"
          value={view.values}
          onChange={setUnits}
          off="% of baseline"
          on={meta.unit}
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
              onChange={(e) => setView({ [key]: e.target.value })}
              className="h-9 w-32"
            />
          </Field>
        ))}
      </Controls>
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

      <Chart
        title={`Predicted NOₓ as ${meta.label.toLowerCase()} changes`}
        subtitle={`${baseline.label}; diamonds mark the baseline, shading is outside the training data.`}
        note={`Training data range: ${formatStat(min)}–${formatStat(max)} ${meta.unit}. This shows how each model responds, not a measured real-world effect.`}
        filename={`sensitivity-${input}`}
        data={curves.flatMap(({ model: m, points, pred0 }): Data[] => [
          {
            type: "scatter",
            mode: "lines+markers",
            name: m.name,
            x: points.map((q) => q.value),
            y: points.map((q) => q.prediction),
            line: { width: 2, color: MODEL_COLORS[m.kind] },
            marker: {
              color: MODEL_COLORS[m.kind],
              size: 5,
              opacity: points.map((q) => (q.outside ? 0.35 : 1)) as never,
            },
            customdata: points.map((q) => [
              formatPct(q.change),
              formatStat(q.diff),
              formatPct(q.diffPct),
            ]) as never,
            hovertemplate: `${meta.label} %{x:,.4~g} ${meta.unit} (%{customdata[0]})<br>NOₓ %{y:,.4~g} t<br>change %{customdata[1]} t (%{customdata[2]})<extra>${m.name}</extra>`,
          },
          {
            type: "scatter",
            mode: "markers",
            name: `${m.name} baseline`,
            showlegend: false,
            x: [value0],
            y: [pred0],
            marker: {
              size: 12,
              symbol: "diamond",
              color: MODEL_COLORS[m.kind],
              line: { width: 1.5, color: "white" },
            },
            hovertemplate: `Baseline<br>${meta.label} %{x:,.4~g} ${meta.unit}<br>NOₓ %{y:,.4~g} t<extra>${m.name}</extra>`,
          },
        ])}
        layout={{
          shapes: [
            refLine("x", value0),
            ...(lo < min ? [outsideBand(lo, min)] : []),
            ...(hi > max ? [outsideBand(max, hi)] : []),
          ],
          xaxis: { title: { text: `${meta.label} (${meta.unit})` } },
          yaxis: {
            title: { text: "Predicted NOₓ (short tons)" },
            rangemode: "tozero",
          },
        }}
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
      />

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
