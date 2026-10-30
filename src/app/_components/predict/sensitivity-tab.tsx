"use client";

import type { Shape } from "plotly.js";
import { Chart } from "~/components/ui/chart";
import { Input } from "~/components/ui/input";
import { Field, ReportTable } from "~/components/ui/report";
import { Select } from "~/components/ui/select";
import { formatStat } from "~/lib/analysis";
import {
  NUMERIC_INPUTS,
  outOfRange,
  predict,
  type NumericInput,
} from "~/lib/model";
import { Controls } from "../analyze/shared";
import { rangeWarning, type PredictTabProps } from "./predict-view";

const WARN = "rgba(217, 119, 6, 0.14)";

const pct = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;

/**
 * §6.2: one input varied over a range of percentages of its baseline value, everything else held
 * constant. §6.4: the curve marks the baseline and shades values outside the training data.
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

  const from = Number(view.from) || 0;
  const to = Number(view.to) || 0;
  const step = Math.max(Math.abs(Number(view.step)) || 1, 0.1);
  const steps: number[] = [];
  for (
    let p = Math.min(from, to);
    p <= Math.max(from, to) + 1e-9 && steps.length < 401;
    p += step
  ) {
    steps.push(Number(p.toFixed(6)));
  }
  if (!steps.includes(0)) steps.push(0);
  steps.sort((a, b) => a - b);
  const points = steps.map((p) => {
    const value = value0 * (1 + p / 100);
    const inputs = { ...base, [input]: value };
    const prediction = predict(model.artifact, inputs);
    return {
      p,
      value,
      prediction,
      diff: prediction - pred0,
      diffPct: pred0 ? ((prediction - pred0) / pred0) * 100 : null,
      outside: outOfRange(model.artifact, inputs).includes(input),
    };
  });
  const xs = points.map((q) => q.value);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const shapes: Partial<Shape>[] = [
    {
      type: "line",
      xref: "x",
      yref: "paper",
      x0: value0,
      x1: value0,
      y0: 0,
      y1: 1,
      line: { dash: "dash", width: 1, color: "gray" },
    },
    {
      type: "line",
      xref: "paper",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: pred0,
      y1: pred0,
      line: { dash: "dash", width: 1, color: "gray" },
    },
    ...(lo < min
      ? [
          {
            type: "rect" as const,
            xref: "x" as const,
            yref: "paper" as const,
            x0: lo,
            x1: min,
            y0: 0,
            y1: 1,
            fillcolor: WARN,
            line: { width: 0 },
          },
        ]
      : []),
    ...(hi > max
      ? [
          {
            type: "rect" as const,
            xref: "x" as const,
            yref: "paper" as const,
            x0: max,
            x1: hi,
            y0: 0,
            y1: 1,
            fillcolor: WARN,
            line: { width: 0 },
          },
        ]
      : []),
  ];
  const outside = points.filter((q) => q.outside);

  return (
    <div className="space-y-4">
      <Controls>
        <Field label="Vary">
          <Select
            value={input}
            onValueChange={(v) => setView({ input: v })}
            className="w-60"
            options={Object.entries(NUMERIC_INPUTS).map(([value, m]) => ({
              value,
              label: `${m.label} (${m.unit})`,
            }))}
          />
        </Field>
        {(
          [
            ["from", "From (% of baseline)"],
            ["to", "To (%)"],
            ["step", "Step (%)"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <Input
              type="number"
              value={view[key]}
              onChange={(e) => setView({ [key]: e.target.value })}
              className="h-9 w-28"
            />
          </Field>
        ))}
      </Controls>
      {base[input] === null && (
        <p className="text-warn text-sm">
          The baseline has no {meta.label.toLowerCase()}; the model's training
          median ({formatStat(median)} {meta.unit}) stands in for it.
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
            x: xs,
            y: points.map((q) => q.prediction),
            marker: {
              color: points.map((q) => (q.outside ? "#d97706" : "#1d4ed8")),
              size: 6,
            },
            customdata: points.map((q) => [
              pct(q.p),
              formatStat(q.diff),
              pct(q.diffPct),
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
          shapes,
          xaxis: { title: { text: `${meta.label} (${meta.unit})` } },
          yaxis: {
            title: { text: "Predicted NOₓ (short tons)" },
            rangemode: "tozero",
          },
        }}
        table={{
          head: [
            "pct_of_baseline",
            `${input} (${meta.unit})`,
            "predicted_nox_tons",
            "change_tons",
            "change_pct",
            "outside_training_range",
          ],
          rows: points.map((q) => [
            q.p,
            q.value,
            q.prediction,
            q.diff,
            q.diffPct,
            q.outside,
          ]),
        }}
      />
      {outside.length > 0 && (
        <p className="text-warn text-sm">
          {rangeWarning([input])} ({outside.length} of {points.length} points.)
        </p>
      )}

      <ReportTable
        sortable
        head={[
          "Change",
          `${meta.label} (${meta.unit})`,
          "Predicted NOₓ (t)",
          "Change (t)",
          "Change (%)",
          "Training range",
        ]}
        rows={points.map((q) => [
          q.p === 0 ? "baseline" : pct(q.p),
          formatStat(q.value),
          formatStat(q.prediction),
          formatStat(q.diff),
          pct(q.diffPct),
          q.outside ? "outside" : "inside",
        ])}
        sortKeys={points.map((q) => [
          q.p,
          q.value,
          q.prediction,
          q.diff,
          q.diffPct,
          undefined,
        ])}
      />
    </div>
  );
}
