"use client";

import { Chart } from "~/components/ui/chart";
import { Input } from "~/components/ui/input";
import { Field, ReportTable } from "~/components/ui/report";
import { formatPct, formatStat } from "~/lib/analysis";
import {
  featureLabel,
  outOfRange,
  predict,
  type ModelInputs,
} from "~/lib/model";
import { Controls } from "../analyze/shared";
import { rangeWarning, type PredictTabProps } from "./predict-view";

const scale = (v: number | null, pct: number) =>
  v === null ? null : v * (1 + pct / 100);

/** The named scenarios of §6.3, built from the baseline inputs and the chosen percentages. */
function scenarios(base: ModelInputs, loadPct: number, heatPct: number) {
  const gas = /gas/i.test(base.primary_fuel);
  const fuel = gas ? "Coal" : "Pipeline Natural Gas";
  const scr = base.scr ? 0 : 1;
  const signed = (p: number) => `${p > 0 ? "+" : ""}${p} %`;
  return [
    { name: "Baseline", change: "As reported", inputs: base },
    {
      name: `Gross load ${signed(loadPct)}`,
      change: `Gross load × ${1 + loadPct / 100}`,
      inputs: { ...base, gross_load_mwh: scale(base.gross_load_mwh, loadPct) },
    },
    {
      name: `Heat input ${signed(heatPct)}`,
      change: `Heat input × ${1 + heatPct / 100}`,
      inputs: {
        ...base,
        heat_input_mmbtu: scale(base.heat_input_mmbtu, heatPct),
      },
    },
    {
      name: scr ? "Add SCR" : "Remove SCR",
      change: `Selective catalytic reduction ${scr ? "installed" : "removed"}`,
      inputs: { ...base, scr },
    },
    {
      name: `Fuel: ${fuel}`,
      change: `Primary fuel changed from ${base.primary_fuel}`,
      inputs: { ...base, primary_fuel: fuel },
    },
    {
      name: "High efficiency",
      change: `Heat input × ${1 + heatPct / 100} with the same gross load, plus SCR`,
      inputs: {
        ...base,
        heat_input_mmbtu: scale(base.heat_input_mmbtu, heatPct),
        scr: 1,
      },
    },
  ];
}

/** §6.3–§6.4: named scenarios against the baseline, for each trained model. */
export function ScenariosTab({
  view,
  setView,
  models,
  baseline,
}: PredictTabProps) {
  const trained = models.filter((m) => m.kind !== "baseline");
  const list = scenarios(
    baseline.inputs,
    Number(view.load) || 0,
    Number(view.heat) || 0,
  );
  const results = trained.flatMap((m) => {
    const base = predict(m.artifact, baseline.inputs);
    return list.map((s) => {
      const prediction = predict(m.artifact, s.inputs);
      return {
        model: m,
        scenario: s,
        prediction,
        diff: prediction - base,
        diffPct: base ? ((prediction - base) / base) * 100 : null,
        warnings: outOfRange(m.artifact, s.inputs),
      };
    });
  });

  return (
    <div className="space-y-4">
      <Controls>
        <Field label="Gross load change (%)">
          <Input
            type="number"
            value={view.load}
            onChange={(e) => setView({ load: e.target.value })}
            className="h-9 w-32"
          />
        </Field>
        <Field label="Heat input change (%)">
          <Input
            type="number"
            value={view.heat}
            onChange={(e) => setView({ heat: e.target.value })}
            className="h-9 w-32"
          />
        </Field>
      </Controls>

      <Chart
        title="Predicted NOₓ under each scenario"
        subtitle={`${baseline.label}; actual ${formatStat(baseline.actual)} t. Labels give the change from each model's baseline prediction; faded bars use inputs outside the training data. Model responses, not measured effects.`}
        filename="scenarios"
        height={420}
        data={trained.map((m) => {
          const rows = results.filter((r) => r.model === m);
          return {
            type: "bar",
            name: m.name,
            x: rows.map((r) => r.scenario.name),
            y: rows.map((r) => r.prediction),
            text: rows.map((r) =>
              r.scenario.name === "Baseline" ? "" : formatPct(r.diffPct),
            ),
            textposition: "outside",
            marker: { opacity: rows.map((r) => (r.warnings.length ? 0.4 : 1)) },
            customdata: rows.map((r) => [
              formatStat(r.diff),
              formatPct(r.diffPct),
              rangeWarning(r.warnings),
            ]) as never,
            hovertemplate: `%{x}<br>NOₓ %{y:,.4~g} t<br>change %{customdata[0]} t (%{customdata[1]})<br>%{customdata[2]}<extra>${m.name}</extra>`,
          };
        })}
        layout={{
          barmode: "group",
          xaxis: { title: { text: "Scenario" } },
          yaxis: {
            title: { text: "Predicted NOₓ (short tons)" },
            rangemode: "tozero",
          },
        }}
        table={{
          head: [
            "model",
            "scenario",
            "change",
            "predicted_nox_tons",
            "change_tons",
            "change_pct",
            "outside_training_range",
          ],
          rows: results.map((r) => [
            r.model.id,
            r.scenario.name,
            r.scenario.change,
            r.prediction,
            r.diff,
            r.diffPct,
            r.warnings.map(featureLabel).join("; "),
          ]),
        }}
      />

      <ReportTable
        head={[
          "Scenario",
          "What changes",
          ...trained.flatMap((m) => [`${m.name} (t)`, "Change"]),
          "Outside the training data",
        ]}
        rows={list.map((scenario) => {
          const rows = results.filter((r) => r.scenario === scenario);
          const warnings = [...new Set(rows.flatMap((r) => r.warnings))];
          return [
            <span key="n" className="text-fg font-medium">
              {scenario.name}
            </span>,
            scenario.change,
            ...rows.flatMap((r) => [
              formatStat(r.prediction),
              r.scenario === list[0] ? "—" : formatPct(r.diffPct),
            ]),
            warnings.length ? (
              <span key="w" className="text-warn">
                {warnings.map(featureLabel).join(", ")}
              </span>
            ) : (
              "—"
            ),
          ];
        })}
      />
      <p className="text-fg-muted max-w-4xl text-xs">
        Each scenario changes only what it names; the prior-year NOₓ rate still
        describes the unit as it was. When two models disagree on a scenario,
        the data cannot settle the effect: the decision tree, for example,
        learns NOₓ mostly from heat input and last year's rate, so adding SCR
        barely moves it, while the Ridge model applies one average SCR effect to
        every unit.
      </p>
    </div>
  );
}
