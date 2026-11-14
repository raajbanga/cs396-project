"use client";

import { use, useEffect, useState } from "react";
import { InlineLoading, QueryError } from "~/components/ui/empty-state";
import { ExportContext } from "~/components/ui/export-button";
import { predictMetadata } from "~/lib/export-bundle";
import { PageTitle } from "~/components/ui/page";
import { DetailList, Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select, toOptions } from "~/components/ui/select";
import { formatStat } from "~/lib/analysis";
import {
  DEFAULT_PREDICT_VIEW,
  writeView,
  type PredictView as View,
} from "~/lib/analysis-state";
import {
  featureLabel,
  MODEL_COLORS,
  predict,
  type ModelInputs,
} from "~/lib/model";
import { replaceUrlQuery } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { Controls } from "../analyze/shared";
import { FacilitySearch } from "../facility-search";
import { ModelsTab } from "./models-tab";
import { ScenariosSection } from "./scenarios";
import { SensitivitySection } from "./sensitivity";

export type Model = RouterOutputs["prediction"]["models"][number];
export type Baseline = NonNullable<RouterOutputs["prediction"]["baseline"]>;

/** What the What-if sections receive: the chosen models (one, or Ridge and the tree). */
export interface PredictTabProps {
  view: View;
  setView: (patch: Partial<View>) => void;
  chosen: Model[];
  baseline: Baseline;
}

const TABS = { models: "Models", whatif: "What-if" } as const;

/** The warning shown when inputs leave the training data's range. */
export const rangeWarning = (names: string[]) =>
  names.length
    ? `Outside the training data: ${names.map(featureLabel).join(", ")}. The prediction is an extrapolation.`
    : "";

/** Phase 2 §5–§6: how good the models are, then how one unit's prediction responds to changes. */
export function PredictView({ initial }: { initial: View }) {
  const [view, setViewState] = useState(initial);
  const query = writeView(DEFAULT_PREDICT_VIEW, view).toString();
  useEffect(() => replaceUrlQuery(query), [query]);
  const setView = (patch: Partial<View>) =>
    setViewState((v) => ({ ...v, ...patch }));

  const [models] = api.prediction.models.useSuspenseQuery();
  const { data: source } = api.analysis.provenance.useQuery();
  const trained = models.filter((m) => m.kind !== "baseline");
  const chosen =
    view.model === "ridge" || view.model === "tree"
      ? trained.filter((m) => m.kind === view.model)
      : trained;

  return (
    <ExportContext value={predictMetadata(source, view, chosen)}>
      <div className="space-y-6">
        <PageTitle lead="Annual NOₓ per unit-year, predicted from operating data, unit attributes, controls, and the previous year. Check the models, then change one unit's inputs.">
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

        {!chosen.length ? (
          <p className="text-fg-muted text-sm">
            No models are registered. Run <code>npm run ml:train</code>.
          </p>
        ) : view.tab === "models" ? (
          <ModelsTab models={models} view={view} setView={setView} />
        ) : (
          <WhatIf view={view} setView={setView} chosen={chosen} />
        )}
      </div>
    </ExportContext>
  );
}

/** §6: pick a baseline unit-year, then the sensitivity curve and the scenarios, both from it. */
function WhatIf({ view, setView, chosen }: Omit<PredictTabProps, "baseline">) {
  const [search, setSearch] = useState("");
  const exportMeta = use(ExportContext);
  const year = Number(view.year);
  const { data: filterOptions } = api.facilities.getFilterOptions.useQuery();
  // A baseline needs the previous year as an input, so the first stored year can't be one.
  const years = (filterOptions?.years ?? []).slice(0, -1);
  const units = api.prediction.baselineUnits.useQuery(
    { facilityId: Number(view.fid), year },
    { placeholderData: (prev) => prev },
  );
  const baseline = api.prediction.baseline.useQuery({
    facilityId: Number(view.fid),
    unitId: view.uid,
    year,
  });
  const unitList = units.data ?? [];
  // The previous facility's units stay shown while the new ones load; don't pair its name with the new ID.
  const facilityName = units.isPlaceholderData
    ? undefined
    : unitList[0]?.facilityName;
  // A new facility or year keeps the unit when it exists there, else takes the largest emitter.
  const firstUnit = unitList[0]?.unitId;
  const hasUnit = unitList.some((u) => u.unitId === view.uid);
  useEffect(() => {
    if (!units.isPlaceholderData && firstUnit && !hasUnit)
      setView({ uid: firstUnit });
  }, [units.isPlaceholderData, firstUnit, hasUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8">
      <Controls>
        <Field group label="Model">
          <SegmentedControl
            value={chosen.length > 1 ? "both" : chosen[0]!.kind}
            onChange={(model) => setView({ model })}
            options={[
              { value: "ridge", label: "Ridge" },
              { value: "tree", label: "Tree" },
              { value: "both", label: "Both" },
            ]}
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

      {baseline.error ? (
        <QueryError
          error={baseline.error}
          onRetry={() => void baseline.refetch()}
        />
      ) : baseline.isLoading ? (
        <InlineLoading title="Loading the baseline…" />
      ) : !baseline.data ? (
        <p className="text-fg-muted text-sm">
          This unit has no record for {view.year}; pick another unit-year.
        </p>
      ) : (
        <ExportContext value={{ ...exportMeta, baseline: baseline.data }}>
          <BaselineCard baseline={baseline.data} chosen={chosen} />
          <SensitivitySection
            view={view}
            setView={setView}
            chosen={chosen}
            baseline={baseline.data}
          />
          <ScenariosSection
            view={view}
            setView={setView}
            chosen={chosen}
            baseline={baseline.data}
          />
        </ExportContext>
      )}
    </div>
  );
}

/** The baseline's inputs as label–value pairs, with each model's prediction next to the actual. */
function BaselineCard({
  baseline,
  chosen,
}: {
  baseline: Baseline;
  chosen: Model[];
}) {
  const x: ModelInputs = baseline.inputs;
  const controls = [
    x.scr && "SCR",
    x.sncr && "SNCR",
    x.low_nox_burner && "low-NOₓ burners",
    x.injection && "injection",
    x.overfire_air && "overfire air",
  ].filter(Boolean);
  return (
    <section className="border-edge bg-surface rounded-md border p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-fg font-semibold">{baseline.label}</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <span className="text-fg-muted">Actual NOₓ </span>
            <span className="text-fg font-semibold tabular-nums">
              {formatStat(baseline.actual)} t
            </span>
          </span>
          {chosen.map((m) => (
            <span key={m.id}>
              <span
                className="mr-1.5 inline-block size-2 rounded-full"
                style={{ background: MODEL_COLORS[m.kind] }}
              />
              <span className="text-fg-muted">{m.name} </span>
              <span className="text-fg font-semibold tabular-nums">
                {formatStat(predict(m.artifact, x))} t
              </span>
            </span>
          ))}
        </div>
      </div>
      <DetailList
        className="lg:grid-cols-3"
        items={[
          ["Fuel", x.primary_fuel],
          ["Unit type", x.unit_type],
          ["NOₓ controls", controls.length ? controls.join(", ") : "none"],
          ["Heat input", `${formatStat(x.heat_input_mmbtu)} MMBtu`],
          ["Gross load", `${formatStat(x.gross_load_mwh)} MWh`],
          ["Operating time", `${formatStat(x.operating_hours)} h`],
          ["Prior-year NOₓ rate", `${formatStat(x.prior_nox_rate)} lb/MMBtu`],
        ]}
      />
    </section>
  );
}
