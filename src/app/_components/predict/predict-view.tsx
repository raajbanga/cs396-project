"use client";

import { useEffect, useState } from "react";
import { PageTitle } from "~/components/ui/page";
import { Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select, toOptions } from "~/components/ui/select";
import { FacilitySearch } from "../facility-search";
import {
  writeView,
  DEFAULT_PREDICT_VIEW,
  type PredictView as View,
} from "~/lib/analysis-state";
import { featureLabel, type ModelInputs } from "~/lib/model";
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

/** The warning shown when inputs leave the training data's range. */
export const rangeWarning = (names: string[]) =>
  names.length
    ? `Outside the training data: ${names.map(featureLabel).join(", ")}. The prediction is an extrapolation.`
    : "";

/** Phase 2 §5–§6: model evaluation, then how predictions respond to changed inputs. */
export function PredictView({ initial }: { initial: View }) {
  const [view, setViewState] = useState(initial);
  const [search, setSearch] = useState("");
  const query = writeView(DEFAULT_PREDICT_VIEW, view).toString();
  useEffect(() => replaceUrlQuery(query), [query]);
  const setView = (patch: Partial<View>) =>
    setViewState((v) => ({ ...v, ...patch }));

  const [models] = api.prediction.models.useSuspenseQuery();
  const model = models.find((m) => m.kind === view.model) ?? models[0];
  const year = Number(view.year);
  const whatIf = view.tab !== "models";
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery(
    undefined,
    { enabled: whatIf },
  );
  // A baseline needs the previous year as an input, so the first stored year can't be one.
  const years = (filterOptions?.years ?? []).slice(0, -1);
  const units = api.prediction.baselineUnits.useQuery(
    { facilityId: Number(view.fid), year },
    { placeholderData: (prev) => prev, enabled: whatIf },
  );
  const baseline = api.prediction.baseline.useQuery(
    { facilityId: Number(view.fid), unitId: view.uid, year },
    { enabled: whatIf },
  );
  const { data: source } = api.analysis.provenance.useQuery();
  const unitList = units.data ?? [];
  const facilityName = unitList[0]?.facilityName;
  // A new facility or year keeps the unit when it exists there, else takes the largest emitter.
  const firstUnit = unitList[0]?.unitId;
  const hasUnit = unitList.some((u) => u.unitId === view.uid);
  useEffect(() => {
    if (!units.isPlaceholderData && firstUnit && !hasUnit)
      setViewState((v) => ({ ...v, uid: firstUnit }));
  }, [units.isPlaceholderData, firstUnit, hasUnit]);

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
              <Field label="Facility" className="w-full sm:w-80">
                <FacilitySearch
                  value={search}
                  onValueChange={setSearch}
                  onPick={(f) => {
                    setSearch("");
                    setView({ fid: String(f.id) });
                  }}
                  placeholder={
                    facilityName
                      ? `${facilityName} (${view.fid}) · search another`
                      : "Search plant, operator, county, or ID"
                  }
                  inputClassName="h-9 text-sm"
                />
              </Field>
              <Field label="Year">
                <Select
                  value={view.year}
                  onValueChange={(y) => setView({ year: y })}
                  options={toOptions(years.length ? years : [year])}
                  className="w-24"
                />
              </Field>
              <Field label="Unit">
                <Select
                  value={view.uid}
                  onValueChange={(uid) => setView({ uid })}
                  options={
                    unitList.length
                      ? unitList.map((u) => ({
                          value: u.unitId,
                          label: `Unit ${u.unitId} · ${u.fuel} · ${formatStat(u.noxMassTons)} t NOₓ`,
                        }))
                      : [{ value: view.uid, label: `Unit ${view.uid}` }]
                  }
                  className="w-full sm:w-72"
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
