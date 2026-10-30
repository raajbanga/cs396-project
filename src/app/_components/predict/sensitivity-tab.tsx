"use client";

import type { Shape } from "plotly.js";
import { Chart } from "~/components/ui/chart";
import { Input } from "~/components/ui/input";
import { Field, ReportTable } from "~/components/ui/report";
import { Select } from "~/components/ui/select";
import { formatPct, formatStat } from "~/lib/analysis";
import {
  NUMERIC_INPUTS,
  outOfRange,
  predict,
  type NumericInput,
} from "~/lib/model";
import { Controls, Toggle } from "../analyze/shared";
import { rangeWarning, type PredictTabProps } from "./predict-view";

const MAX_POINTS = 401;

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
  fillcolor: "rgba(217, 119, 6, 0.14)",
  line: { width: 0 },
});

/** Three significant figures, for range defaults in an input's own unit. */
const round3 = (x: number) => Number(x.toPrecision(3));

/**
 * §6.2: one input varied from a minimum to a maximum, as values in its own unit or as
 * percentages of the baseline value, everything else held constant. §6.4: the curve marks the
 * baseline and shades values outside the training data.
 */
export function SensitivityTab({
  view,
  setView,
  model,
  baseline,
}: PredictTabProps) {
  const input = (
    view.input in NUMERIC_INPUTS ? view.input : "heat_input_mmbtu"
  ) as NumericInput;
  const meta = NUMERIC_INPUTS[input];
  const [min, max] = model.artifact.ranges.numeric[input];
  const base = baseline.inputs;
  const median =
    model.artifact.spec.numeric.find((f) => f.name === input)?.median ?? 0;
  const value0 = base[input] ?? median;
  const pred0 = predict(model.artifact, base);
  const asValues = view.values === "1";

  // The grid of input values, always including the baseline itself.
  const from = Number(view.from) || 0;
  const to = Number(view.to) || 0;
  const step = Math.abs(Number(view.step)) || 1;
  const toValue = (x: number) => (asValues ? x : value0 * (1 + x / 100));
  const values = [value0];
  for (
    let x = Math.min(from, to);
    x <= Math.max(from, to) + step * 1e-9 && values.length < MAX_POINTS;
    x += step
  ) {
    values.push(toValue(x));
  }
  const points = [...new Set(values)]
    .sort((a, b) => a - b)
    .map((value) => {
      const inputs = { ...base, [input]: value };
      const prediction = predict(model.artifact, inputs);
      return {
        value,
        change: value0 ? (value / value0 - 1) * 100 : null,
        prediction,
        diff: prediction - pred0,
        diffPct: pred0 ? ((prediction - pred0) / pred0) * 100 : null,
        outside: outOfRange(model.artifact, inputs).includes(input),
      };
    });
  const lo = points[0]?.value ?? value0;
  const hi = points.at(-1)?.value ?? value0;
  const outside = points.filter((q) => q.outside).length;

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
    <div className="space-y-4">
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
              className="h-9 w-36"
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

      <Chart
        title={`Sensitivity of predicted NOₓ to ${meta.label.toLowerCase()}`}
        subtitle={`${model.name}; ${baseline.label}. Every other input stays at its baseline value. Shaded: outside the training data (${formatStat(min)}–${formatStat(max)} ${meta.unit}). This shows how the model responds, not a measured real-world effect.`}
        filename={`sensitivity-${model.id}-${input}`}
        data={[
          {
            type: "scatter",
            mode: "lines+markers",
            name: "Prediction",
            x: points.map((q) => q.value),
            y: points.map((q) => q.prediction),
            line: { width: 2 },
            marker: {
              color: points.map((q) => (q.outside ? "#d97706" : "#1d4ed8")),
              size: 6,
            },
            customdata: points.map((q) => [
              formatPct(q.change),
              formatStat(q.diff),
              formatPct(q.diffPct),
            ]) as never,
            hovertemplate: `${meta.label} %{x:,.4~g} ${meta.unit} (%{customdata[0]})<br>NOₓ %{y:,.4~g} t<br>change %{customdata[1]} t (%{customdata[2]})<extra></extra>`,
          },
          {
            type: "scatter",
            mode: "markers",
            name: "Baseline",
            x: [value0],
            y: [pred0],
            marker: {
              size: 13,
              symbol: "diamond",
              color: "#15803d",
              line: { width: 1, color: "white" },
            },
            hovertemplate: `Baseline<br>${meta.label} %{x:,.4~g} ${meta.unit}<br>NOₓ %{y:,.4~g} t<extra></extra>`,
          },
        ]}
        layout={{
          shapes: [
            refLine("x", value0),
            refLine("y", pred0),
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
            `${input} (${meta.unit})`,
            "change_from_baseline_pct",
            "predicted_nox_tons",
            "prediction_change_tons",
            "prediction_change_pct",
            "outside_training_range",
          ],
          rows: points.map((q) => [
            q.value,
            q.change,
            q.prediction,
            q.diff,
            q.diffPct,
            q.outside,
          ]),
        }}
      />
      {outside > 0 && (
        <p className="text-warn text-sm">
          {rangeWarning([input])} ({outside} of {points.length} points.)
        </p>
      )}

      <ReportTable
        sortable
        head={[
          `${meta.label} (${meta.unit})`,
          "Input change",
          "Predicted NOₓ (t)",
          "Change (t)",
          "Change (%)",
          "Training range",
        ]}
        rows={points.map((q) => [
          formatStat(q.value),
          q.value === value0 ? "baseline" : formatPct(q.change),
          formatStat(q.prediction),
          formatStat(q.diff),
          formatPct(q.diffPct),
          q.outside ? "outside" : "inside",
        ])}
        sortKeys={points.map((q) => [
          q.value,
          q.change,
          q.prediction,
          q.diff,
          q.diffPct,
          undefined,
        ])}
      />
    </div>
  );
}
