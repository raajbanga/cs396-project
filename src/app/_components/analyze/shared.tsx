"use client";

import { Field } from "~/components/ui/report";
import { Select } from "~/components/ui/select";
import type { DimensionKey, VariableInfo } from "~/lib/analysis";
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
  className = "w-72",
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
            label: `${v.group === "Measured" ? "" : `${v.group} · `}${variableLabel(v)}`,
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
