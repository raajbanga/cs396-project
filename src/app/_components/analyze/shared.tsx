"use client";

import { Field } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select } from "~/components/ui/select";
import {
  AGGREGATION_LABELS,
  type DimensionKey,
  type VariableInfo,
} from "~/lib/analysis";
import type { AnalysisView } from "~/lib/analysis-state";
import type { FacilityFilters } from "~/lib/facility-filters";
import type { RouterOutputs } from "~/trpc/react";

export type Catalog = RouterOutputs["analysis"]["catalog"];

/** What every Analyze tab receives: the selection, the tab choices, and the catalog. */
export interface TabProps {
  filters: FacilityFilters;
  view: AnalysisView;
  setView: (patch: Partial<AnalysisView>) => void;
  catalog: Catalog;
  summary?: RouterOutputs["analysis"]["summary"];
}

/** A view's dimension choice for the API ("" = none). */
export const asDimension = (key: string) =>
  (key || undefined) as DimensionKey | undefined;

/** "CO₂ intensity (lb/MWh)". */
export const variableLabel = (v?: VariableInfo) =>
  v ? `${v.label} (${v.unit})` : "";

/** The CSV column of a variable: "co2MassTons (short tons)". */
export const valueColumn = (v?: VariableInfo) =>
  v ? `${v.key} (${v.unit})` : "";

/** "Total", "Mean", or "Pooled rate" for the variable. */
export const combinedLabel = (v?: VariableInfo) =>
  v ? AGGREGATION_LABELS[v.aggregation] : "Value";

/** A picker's value and change handler bound to one tab choice, plus the catalog. */
export const bind = (
  { view, setView, catalog }: TabProps,
  key: keyof AnalysisView,
) => ({
  value: view[key],
  onChange: (value: string) => setView({ [key]: value }),
  catalog,
});

export const findInfo = (catalog: Catalog, key: string) =>
  catalog.variables.find((v) => v.key === key);

export const dimensionLabel = (catalog: Catalog, key: string) =>
  catalog.dimensions.find((d) => d.key === key)?.label ?? key;

/** A variable picker over the catalog, optionally limited to some groups. */
export function VariableField({
  label = "Variable",
  value,
  onChange,
  catalog,
  groups,
  className = "w-80",
}: {
  label?: string;
  value: string;
  onChange: (key: string) => void;
  catalog: Catalog;
  groups?: VariableInfo["group"][];
  className?: string;
}) {
  return (
    <Field label={label}>
      <Select
        value={value}
        onValueChange={onChange}
        className={className}
        options={catalog.variables
          .filter((v) => !groups || groups.includes(v.group))
          .map((v) => ({
            value: v.key,
            label: variableLabel(v),
            group: v.group,
          }))}
      />
    </Field>
  );
}

/** A dimension picker; `none` adds a "None" choice stored as "". */
export function DimensionField({
  label = "Group by",
  value,
  onChange,
  catalog,
  none,
  exclude = [],
  className = "w-44",
}: {
  label?: string;
  value: string;
  onChange: (key: string) => void;
  catalog: Catalog;
  none?: string;
  exclude?: string[];
  className?: string;
}) {
  return (
    <Field label={label}>
      <Select
        value={value || "NONE"}
        onValueChange={(v) => onChange(v === "NONE" ? "" : v)}
        className={className}
        options={[
          ...(none ? [{ value: "NONE", label: none }] : []),
          ...catalog.dimensions
            .filter((d) => !exclude.includes(d.key))
            .map((d) => ({ value: d.key, label: d.label })),
        ]}
      />
    </Field>
  );
}

/** A row of tab controls. */
export function Controls({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}

/** An on/off choice ("1" or "") as a two-way segmented control. */
export function Toggle({
  label,
  value,
  onChange,
  off,
  on,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  off: string;
  on: string;
}) {
  return (
    <Field group label={label}>
      <SegmentedControl
        value={value === "1" ? "1" : "0"}
        onChange={(v) => onChange(v === "1" ? "1" : "")}
        options={[
          { value: "0", label: off },
          { value: "1", label: on },
        ]}
      />
    </Field>
  );
}
