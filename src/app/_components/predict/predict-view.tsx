"use client";

import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { PageTitle } from "~/components/ui/page";
import { Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select, toOptions } from "~/components/ui/select";
import {
  writeView,
  DEFAULT_PREDICT_VIEW,
  type PredictView as View,
} from "~/lib/analysis-state";
import { NUMERIC_INPUTS, type ModelInputs } from "~/lib/model";
import { formatStat } from "~/lib/analysis";
import { ExportContext } from "~/components/ui/export-button";
import { replaceUrlQuery } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { Controls } from "../analyze/shared";
import { ModelsTab } from "./models-tab";
import { ScenariosTab } from "./scenarios-tab";
import { SensitivityTab } from "./sensitivity-tab";

export type Model = RouterOutputs["prediction"]["models"][number];
export type Baseline = NonNullable<RouterOutputs["prediction"]["baseline"]>;

/** What the sensitivity and scenario tabs receive. */
export interface PredictTabProps {
  view: View;
  setView: (patch: Partial<View>) => void;
  models: Model[];
  model: Model;
  baseline: Baseline;
}

const TABS = {
  models: "Models",
  sensitivity: "Sensitivity",
  scenarios: "Scenarios",
} as const;

const YEARS = Array.from({ length: 10 }, (_, i) => 2025 - i);

export const inputLabel = (name: string) =>
  name in NUMERIC_INPUTS
    ? NUMERIC_INPUTS[name as keyof typeof NUMERIC_INPUTS].label
    : name === "primary_fuel"
      ? "Primary fuel"
      : name === "unit_type"
        ? "Unit type"
        : name;

/** The warning shown when inputs leave the training data's range. */
export const rangeWarning = (names: string[]) =>
  names.length
    ? `Outside the training data: ${names.map(inputLabel).join(", ")}. The prediction is an extrapolation.`
    : "";

/** Phase 2 §5–§6: model evaluation, then how predictions respond to changed inputs. */
export function PredictView({ initial }: { initial: View }) {
  const [view, setViewState] = useState(initial);
  const [search, setSearch] = useState(initial.fid);
  const query = writeView(DEFAULT_PREDICT_VIEW, view).toString();
  useEffect(() => replaceUrlQuery(query), [query]);
  const setView = (patch: Partial<View>) =>
    setViewState((v) => ({ ...v, ...patch }));

  const [models] = api.prediction.models.useSuspenseQuery();
  const model = models.find((m) => m.kind === view.model) ?? models[0];
  const year = Number(view.year);
  const options = api.prediction.baselineOptions.useQuery(
    { search, year },
    { placeholderData: (prev) => prev, enabled: view.tab !== "models" },
  );
  const baseline = api.prediction.baseline.useQuery(
    { facilityId: Number(view.fid), unitId: view.uid, year },
    { enabled: view.tab !== "models" },
  );
  const { data: source } = api.analysis.provenance.useQuery();
  const current = `${view.fid}|${view.uid}`;
  const unitOptions = (options.data ?? []).map((o) => ({
    value: `${o.facilityId}|${o.unitId}`,
    label: `${o.label} · ${formatStat(o.noxMassTons)} t NOₓ`,
  }));
  if (baseline.data && !unitOptions.some((o) => o.value === current)) {
    unitOptions.unshift({ value: current, label: baseline.data.label });
  }

  return (
    <ExportContext
      value={{
        page: "Predict",
        ...source,
        view,
        model: model && {
          id: model.id,
          name: model.name,
          target: model.target,
          features: model.features,
          settings: model.params,
          trainYears: model.trainYears,
          validationYears: model.validationYears,
          testYears: model.testYears,
          metrics: model.metrics,
          savedModel: model.artifactPath,
          pipeline: model.pipelineVersion,
          trainedAt: model.trainedAt,
        },
        baseline: view.tab === "models" ? undefined : baseline.data,
      }}
    >
      <div className="space-y-6">
        <PageTitle lead="Annual NOₓ emissions per unit-year, predicted from operating data, unit attributes, NOₓ controls, and the unit's previous year. Compare the models with a baseline, then see how a prediction responds when inputs change.">
          Predict
        </PageTitle>
        <SegmentedControl
          variant="tabs"
          value={view.tab}
          onChange={(tab) => setView({ tab })}
          options={Object.entries(TABS).map(([value, label]) => ({
            value: value as View["tab"],
            label,
          }))}
        />

        {!model ? (
          <p className="text-fg-muted text-sm">
            No models are registered. Run <code>npm run ml:train</code>.
          </p>
        ) : view.tab === "models" ? (
          <ModelsTab models={models} view={view} setView={setView} />
        ) : (
          <>
            <Controls>
              <Field label="Model">
                <Select
                  value={model.kind}
                  onValueChange={(m) => setView({ model: m })}
                  className="w-56"
                  options={models
                    .filter((m) => m.kind !== "baseline")
                    .map((m) => ({ value: m.kind, label: m.name }))}
                />
              </Field>
              <Field label="Find facility (name or ID)">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-56"
                  placeholder="e.g. Ghent or 1356"
                />
              </Field>
              <Field label="Year">
                <Select
                  value={view.year}
                  onValueChange={(y) => setView({ year: y })}
                  options={toOptions(YEARS)}
                  className="w-24"
                />
              </Field>
              <Field label="Baseline unit-year">
                <Select
                  value={current}
                  onValueChange={(v) => {
                    const [fid, uid] = v.split("|");
                    setView({ fid, uid });
                  }}
                  options={unitOptions}
                  className="w-96 max-w-full"
                />
              </Field>
            </Controls>
            {baseline.data ? (
              <BaselineSummary baseline={baseline.data} />
            ) : (
              !baseline.isLoading && (
                <p className="text-fg-muted text-sm">
                  This unit has no record for {view.year}; pick another
                  unit-year.
                </p>
              )
            )}
            {baseline.data &&
              (view.tab === "sensitivity" ? (
                <SensitivityTab
                  view={view}
                  setView={setView}
                  models={models}
                  model={model}
                  baseline={baseline.data}
                />
              ) : (
                <ScenariosTab
                  view={view}
                  setView={setView}
                  models={models}
                  model={model}
                  baseline={baseline.data}
                />
              ))}
          </>
        )}
      </div>
    </ExportContext>
  );
}

/** The baseline's inputs as a compact line, so changes are read against them. */
function BaselineSummary({ baseline }: { baseline: Baseline }) {
  const x: ModelInputs = baseline.inputs;
  const controls = [
    x.scr && "SCR",
    x.sncr && "SNCR",
    x.low_nox_burner && "low-NOₓ burners",
    x.injection && "injection",
    x.overfire_air && "overfire air",
  ].filter(Boolean);
  return (
    <p className="text-fg-2 max-w-5xl text-sm">
      <span className="text-fg font-medium">{baseline.label}</span>:{" "}
      {x.primary_fuel}, {x.unit_type.toLowerCase()}; heat input{" "}
      {formatStat(x.heat_input_mmbtu)} MMBtu, gross load{" "}
      {formatStat(x.gross_load_mwh)} MWh, {formatStat(x.operating_hours)} h;
      prior-year NOₓ rate {formatStat(x.prior_nox_rate)} lb/MMBtu; NOₓ controls:{" "}
      {controls.length ? controls.join(", ") : "none"}. Actual NOₓ{" "}
      <span className="text-fg font-medium">
        {formatStat(baseline.actual)} tons
      </span>
      .
    </p>
  );
}
