"use client";

import { Columns } from "~/components/charts/bars";
import { ChartFrame } from "~/components/ui/chart";
import { Takeaways } from "~/components/ui/takeaways";
import { scenarioSentences } from "~/lib/takeaways";
import { Input } from "~/components/ui/input";
import {
  Disclosure,
  Field,
  ReportTable,
  Section,
} from "~/components/ui/report";
import { formatPct, formatStat } from "~/lib/analysis";
import {
  featureLabel,
  MODEL_COLORS,
  scenarioResults,
  scenarios,
  changedInputs,
} from "~/lib/model";
import { Controls } from "../analyze/shared";
import type { PredictTabProps } from "./predict-view";

/** §6.3–§6.4: named scenarios against the baseline, for each chosen model. */
export function ScenariosSection({
  view,
  setView,
  chosen,
  baseline,
}: PredictTabProps) {
  const list = scenarios(
    baseline.inputs,
    Number(view.load) || 0,
    Number(view.heat) || 0,
  );
  const results = chosen.flatMap((m) =>
    scenarioResults(m.artifact, baseline.inputs, list).map((r) => ({
      model: m,
      ...r,
    })),
  );

  return (
    <Section title="Scenarios" note="Each scenario changes only what it names.">
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

      <Takeaways
        items={scenarioSentences(
          results
            .filter((r) => r.scenario !== list[0])
            .map((r) => ({
              model:
                r.model.kind === "tree"
                  ? "the tree"
                  : r.model.kind === "ridge"
                    ? "Ridge"
                    : r.model.name,
              scenario: r.scenario.name,
              diffPct: r.diffPct,
            })),
        )}
      />

      <ChartFrame
        title="Predicted NOₓ under each scenario"
        subtitle="Short tons. Labels: change from each model's baseline; faded bars use inputs outside the training data."
        note="The prior-year NOₓ rate still describes the unit as it was. When the models disagree on a scenario, the data cannot settle the effect: the tree learns NOₓ mostly from heat input and last year's rate, so adding SCR barely moves it, while Ridge applies one average SCR effect to every unit. Model responses, not measured effects."
        legend={chosen.map((m) => ({
          key: m.kind,
          label: m.name,
          color: MODEL_COLORS[m.kind]!,
        }))}
        filename="scenarios"
        height={360}
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
      >
        <Columns
          height={360}
          unit="t"
          series={chosen.map((m) => ({
            key: m.kind,
            label: m.name,
            color: MODEL_COLORS[m.kind]!,
          }))}
          data={list.map((scenario) => ({
            label: scenario.name,
            ...Object.fromEntries(
              results
                .filter((r) => r.scenario === scenario)
                .map((r) => [r.model.kind, r.prediction]),
            ),
          }))}
          labels={(row, key) => {
            const r = results.find(
              (x) => x.scenario.name === row.label && x.model.kind === key,
            );
            return !r || r.scenario === list[0] ? "" : formatPct(r.diffPct);
          }}
          detail={(row, key) => {
            const r = results.find(
              (x) => x.scenario.name === row.label && x.model.kind === key,
            );
            return !r || r.scenario === list[0]
              ? ""
              : `${r.diff > 0 ? "+" : ""}${formatStat(r.diff)} t, ${formatPct(r.diffPct)}`;
          }}
          footer={(row) => {
            const scenario = list.find((s) => s.name === row.label);
            const changed = scenario
              ? changedInputs(baseline.inputs, scenario.inputs)
              : [];
            return changed.length ? (
              <ul className="text-fg-muted space-y-0.5">
                {changed.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null;
          }}
          faded={(row, key) =>
            Boolean(
              results.find(
                (x) => x.scenario.name === row.label && x.model.kind === key,
              )?.warnings.length,
            )
          }
        />
      </ChartFrame>

      <Disclosure title="Show values" hint="what each scenario changes">
        <ReportTable
          head={[
            "Scenario",
            "What changes",
            ...chosen.flatMap((m) => [`${m.name} (t)`, "Change"]),
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
      </Disclosure>
    </Section>
  );
}
