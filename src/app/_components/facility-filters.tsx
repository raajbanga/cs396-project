"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Field, FIELD_LABEL } from "~/components/ui/report";
import { Select, toOptions } from "~/components/ui/select";
import { TryExamples } from "~/components/ui/try-examples";
import {
  ADVANCED_FILTER_KEYS,
  DEFAULT_FILTERS,
  isFilterActive,
  TOP_N_OPTIONS,
  RANGE_FIELDS,
  type FacilityFilters,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import { AUDIT_RULES, AUDIT_SEVERITIES } from "~/lib/emissions-metrics";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

type FilterOptions = RouterOutputs["facilities"]["getFilterOptions"];
type DescribeResult = Pick<
  RouterOutputs["facilities"]["describeSearch"],
  "unrecognized" | "via" | "notes"
>;

/**
 * Description search (rubric §6) wiring for the search box: the text is interpreted into filters
 * on submit, falling back to a name search when nothing in it is recognized. Omitted where only
 * name search applies (the box then filters by name as you type).
 */
export interface DescribeProps {
  text: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  result: DescribeResult | null;
}

const DESCRIBE_EXAMPLES = [
  "coal units in Kentucky with high CO2",
  "top 10 facilities by CO2 in 2024",
  "gas units in TX under 50 tons SO2",
  "top CO2-emitting facility in each state",
];

const CHIP_LABELS: Partial<Record<keyof FacilityFilters, string>> = {
  stateCode: "State",
  primaryFuel: "Fuel",
  nercRegion: "Grid",
  county: "County",
  secondaryFuel: "Secondary fuel",
  unitType: "Type",
  so2Control: "SO₂ control",
  noxControl: "NOₓ control",
  pmControl: "PM control",
  operatingStatus: "Status",
  auditFlag: "Flag",
  auditSeverity: "Severity",
};

const formatBound = (v: string) => {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n.toLocaleString() : v;
};

/** One removable chip per active filter (range pairs and ranking combined), built from the filters themselves. */
function activeChips(filters: FacilityFilters) {
  const on = (key: keyof FacilityFilters) => isFilterActive(filters, key);
  const chips: { label: string; keys: (keyof FacilityFilters)[] }[] = [];
  if (on("search"))
    chips.push({ label: `"${filters.search}"`, keys: ["search"] });
  if (on("facilityId"))
    chips.push({
      label: `Facility #${filters.facilityId}`,
      keys: ["facilityId"],
    });
  if (on("unitId"))
    chips.push({ label: `Unit ${filters.unitId}`, keys: ["unitId"] });
  for (const [key, label] of Object.entries(CHIP_LABELS) as [
    keyof FacilityFilters,
    string,
  ][]) {
    if (on(key))
      chips.push({ label: `${label}: ${filters[key]}`, keys: [key] });
  }
  if (on("year")) chips.push({ label: `Year ${filters.year}`, keys: ["year"] });
  if (on("origin")) {
    chips.push({
      label: `Origin: ${filters.origin === "API" ? "EPA API" : "Upload"}`,
      keys: ["origin"],
    });
  }
  for (const { key, label, unit } of RANGE_FIELDS) {
    const min = on(`${key}Min`) ? formatBound(filters[`${key}Min`]) : undefined;
    const max = on(`${key}Max`) ? formatBound(filters[`${key}Max`]) : undefined;
    if (!min && !max) continue;
    const minStrict = on(`${key}MinStrict`);
    const maxStrict = on(`${key}MaxStrict`);
    const bounds =
      min && max && !minStrict && !maxStrict
        ? `${min}–${max}`
        : [
            min && `${minStrict ? ">" : "≥"} ${min}`,
            max && `${maxStrict ? "<" : "≤"} ${max}`,
          ]
            .filter(Boolean)
            .join(", ");
    chips.push({
      label: `${label} ${bounds}${key === "year" ? "" : ` ${unit}`}`,
      keys: [`${key}Min`, `${key}Max`, `${key}MinStrict`, `${key}MaxStrict`],
    });
  }
  if (on("topN") || on("rankGroup")) {
    chips.push({
      label:
        [on("topN") && `First ${filters.topN}`, on("rankGroup") && "per state"]
          .filter(Boolean)
          .join(" ") || "Ranked",
      keys: ["topN", "rankGroup"],
    });
  }
  return chips;
}

function FilterChips({
  filters,
  onFilterChange,
  result,
}: {
  filters: FacilityFilters;
  onFilterChange: FilterChangeHandler;
  result?: DescribeResult | null;
}) {
  const chips = activeChips(filters);
  if (chips.length === 0 && !result) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-fg-muted">
        {result ? "Interpreted as" : "Filters"}
      </span>
      {chips.map(({ label, keys }) => (
        <Badge key={keys.join()} variant="outline" className="gap-1 pr-0.5">
          {label}
          <button
            type="button"
            onClick={() =>
              keys.forEach((k) => onFilterChange(k, DEFAULT_FILTERS[k]))
            }
            className="text-fg-muted hover:text-fg cursor-pointer rounded-sm p-0.5"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {result && chips.length === 0 && (
        <span className="text-fg-muted">no filters</span>
      )}
      {result && result.unrecognized.length > 0 && (
        <span className="text-warn">
          Not understood: {result.unrecognized.join(", ")}
        </span>
      )}
      {result && (
        <span className="text-fg-muted" title={result.notes.join("\n")}>
          ({result.via}
          {result.notes.length > 0 && `; ${result.notes.join(" ")}`})
        </span>
      )}
    </div>
  );
}

/** §8.1 basic fields: state, year, fuel, unit type, facility ID, unit ID. */
function BasicFilters({
  filters,
  filterOptions,
  onFilterChange,
}: {
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
}) {
  const selects = [
    ["stateCode", "State", toOptions(filterOptions?.states, "All states")],
    ["year", "Year", toOptions(filterOptions?.years, "All years")],
    ["primaryFuel", "Fuel", toOptions(filterOptions?.fuels, "All fuels")],
    [
      "unitType",
      "Unit type",
      toOptions(filterOptions?.unitTypes, "All unit types"),
    ],
  ] as const;
  const inputs = [
    ["facilityId", "Facility ID", "e.g. 3", "numeric"],
    ["unitId", "Unit ID", "e.g. 1, CT1", "text"],
  ] as const;
  return (
    <>
      {selects.map(([key, label, options]) => (
        <Field key={key} label={label}>
          <Select
            value={filters[key]}
            onValueChange={(value) => onFilterChange(key, value)}
            options={options}
            size="drawer"
          />
        </Field>
      ))}
      {inputs.map(([key, label, placeholder, inputMode]) => (
        <Field key={key} label={label}>
          <Input
            value={filters[key]}
            onChange={(e) => onFilterChange(key, e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
          />
        </Field>
      ))}
    </>
  );
}

/** §8.1 remaining fields, §8.2 min–max ranges, and §8.3 Top-N ranking; all AND together. */
function AdvancedFilters({
  filters,
  filterOptions,
  onFilterChange,
  view,
}: {
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  view: FilterBarProps["itemLabel"];
}) {
  const counties = [
    ...new Set(
      (filterOptions?.counties ?? [])
        .filter(
          (c) =>
            filters.stateCode === "ALL" || c.stateCode === filters.stateCode,
        )
        .map((c) => c.county),
    ),
  ];
  const selects = [
    ["county", "County", toOptions(counties, "All counties")],
    [
      "nercRegion",
      "Grid region",
      toOptions(filterOptions?.nercRegions, "All grids"),
    ],
    [
      "secondaryFuel",
      "Secondary fuel",
      toOptions(filterOptions?.secondaryFuels, "Any"),
    ],
    ["so2Control", "SO₂ control", toOptions(filterOptions?.so2Controls, "Any")],
    ["noxControl", "NOₓ control", toOptions(filterOptions?.noxControls, "Any")],
    ["pmControl", "PM control", toOptions(filterOptions?.pmControls, "Any")],
    [
      "operatingStatus",
      "Operating status",
      toOptions(filterOptions?.operatingStatuses, "Any"),
    ],
    [
      "auditFlag",
      "Audit flag",
      [
        { value: "ALL", label: "Any (or none)" },
        ...AUDIT_RULES.map((r) => ({ value: r.flagType, label: r.label })),
      ],
    ],
    ["auditSeverity", "Flag severity", toOptions(AUDIT_SEVERITIES, "Any")],
    [
      "origin",
      "Record origin",
      [
        { value: "ALL", label: "Any" },
        { value: "API", label: "EPA CAMPD API" },
        { value: "UPLOAD", label: "File upload" },
      ],
    ],
  ] as const;

  return (
    <div className="border-edge space-y-5 border-y py-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {selects.map(([key, label, options]) => (
          <Field key={key} label={label}>
            <Select
              value={filters[key]}
              onValueChange={(value) => onFilterChange(key, value)}
              options={options}
              size="drawer"
            />
          </Field>
        ))}
      </div>

      <fieldset className="space-y-2">
        <legend className={FIELD_LABEL}>
          Ranges per unit-year (click ≥ / ≤ to switch to strict &gt; / &lt;)
        </legend>
        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {RANGE_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center gap-1 text-sm">
              <span className="text-fg-2 mr-1 w-32 shrink-0">
                {label} <span className="text-fg-muted">({unit})</span>
              </span>
              {(["Min", "Max"] as const).map((bound) => {
                const strictKey = `${key}${bound}Strict` as const;
                const strict = filters[strictKey] === "1";
                const [inclusiveOp, strictOp] =
                  bound === "Min" ? ["≥", ">"] : ["≤", "<"];
                return (
                  <div key={bound} className="flex min-w-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        onFilterChange(strictKey, strict ? "" : "1")
                      }
                      aria-pressed={strict}
                      aria-label={`${label} ${bound === "Min" ? "minimum" : "maximum"}: ${strict ? "strict" : "inclusive"}`}
                      title={
                        strict
                          ? "Strict (click for inclusive)"
                          : "Inclusive (click for strict)"
                      }
                      className="aria-pressed:bg-surface-2 aria-pressed:text-fg w-6 font-mono"
                    >
                      {strict ? strictOp : inclusiveOp}
                    </Button>
                    <Input
                      value={filters[`${key}${bound}`]}
                      onChange={(e) =>
                        onFilterChange(`${key}${bound}`, e.target.value)
                      }
                      placeholder={bound === "Min" ? "min" : "max"}
                      inputMode="decimal"
                      aria-label={`${label} ${bound === "Min" ? "minimum" : "maximum"} (${unit})`}
                      className="h-8 min-w-0"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </fieldset>

      {view !== "flags" && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Ranking">
            <Select
              value={filters.topN}
              onValueChange={(value) => onFilterChange("topN", value)}
              options={[
                { value: "ALL", label: "All rows" },
                ...TOP_N_OPTIONS.map((n) => ({
                  value: String(n),
                  label: `First ${n}`,
                })),
              ]}
              size="toolbar"
              className="w-32"
            />
          </Field>
          <Field label="Group">
            <Select
              value={filters.rankGroup}
              onValueChange={(value) => onFilterChange("rankGroup", value)}
              options={[
                { value: "ALL", label: "Overall" },
                { value: "state", label: "Per state" },
              ]}
              size="toolbar"
              className="w-32"
            />
          </Field>
          <p className="text-fg-muted max-w-xl pb-2 text-xs">
            Ranks follow the table sort: sort a column descending for Top-N,
            ascending for Bottom-N.{" "}
            {view === "unit-years"
              ? "Each row is one unit in one reporting year."
              : "Unit and range filters keep facilities with at least one matching unit-year; a reporting year also scopes the CO₂ totals."}
          </p>
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  onResetFilters: () => void;
  totalMatching?: number;
  itemLabel: "facilities" | "unit-years" | "flags";
  isLoading: boolean;
  /** Extra controls beside the result count, e.g. a CSV download. */
  actions?: ReactNode;
  describe?: DescribeProps;
}

/**
 * The explorer's search form: one search box (description or name), the basic fields, an
 * Advanced panel that opens by itself when one of its filters is set, the active filters as
 * removable chips, and the matching count.
 */
export function FacilityFilterBar({
  filters,
  filterOptions,
  onFilterChange,
  onResetFilters,
  totalMatching,
  itemLabel,
  isLoading,
  actions,
  describe,
}: FilterBarProps) {
  const activeAdvancedCount = ADVANCED_FILTER_KEYS.filter((key) =>
    isFilterActive(filters, key),
  ).length;
  // Until toggled by hand, Advanced is open exactly when one of its filters is set.
  const [advancedToggled, setAdvancedToggled] = useState<boolean | null>(null);
  const isAdvancedOpen = advancedToggled ?? activeAdvancedCount > 0;
  const hasActiveFilters = (
    Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]
  ).some((key) => isFilterActive(filters, key));
  const text = describe ? describe.text : filters.search;
  const setText = (value: string) =>
    describe ? describe.onTextChange(value) : onFilterChange("search", value);

  return (
    <div className="space-y-4">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          describe?.onSubmit();
        }}
      >
        <div className="relative min-w-0 flex-1">
          {describe?.isLoading ? (
            <Loader2 className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin" />
          ) : (
            <Search className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          )}
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              describe
                ? `Describe what you want, or type a name: “${DESCRIBE_EXAMPLES[0]}”`
                : "Search plant, operator, or county"
            }
            aria-label={
              describe
                ? "Describe what you want to find, or search by name"
                : "Search by plant, operator, or county"
            }
            className="h-10 pr-9 pl-9 text-[15px]"
          />
          {text && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-fg-muted hover:text-fg absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer"
              aria-label="Clear search and filters"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {describe && (
          <Button
            type="submit"
            className="h-10"
            disabled={!describe.text.trim() || describe.isLoading}
          >
            Search
          </Button>
        )}
      </form>

      {describe && !describe.text && !hasActiveFilters && (
        <TryExamples
          className="-mt-2"
          examples={DESCRIBE_EXAMPLES.map((ex) => ({
            label: ex,
            onSelect: () => describe.onTextChange(ex),
          }))}
        />
      )}

      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
        <BasicFilters
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={onFilterChange}
        />
        <Button
          variant="outline"
          onClick={() => setAdvancedToggled(!isAdvancedOpen)}
          aria-expanded={isAdvancedOpen}
          className="col-span-2 sm:col-span-1"
        >
          Advanced
          {activeAdvancedCount > 0 && (
            <span className="text-primary tabular-nums">
              {activeAdvancedCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              "text-fg-muted h-3.5 w-3.5",
              isAdvancedOpen && "rotate-180",
            )}
          />
        </Button>
      </div>

      {isAdvancedOpen && (
        <AdvancedFilters
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={onFilterChange}
          view={itemLabel}
        />
      )}

      <FilterChips
        filters={filters}
        onFilterChange={onFilterChange}
        result={describe?.result}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
        <p className="text-fg-2 text-sm" aria-live="polite">
          {isLoading ? (
            "Searching…"
          ) : (
            <>
              <strong className="text-fg font-semibold tabular-nums">
                {totalMatching?.toLocaleString() ?? 0}
              </strong>{" "}
              {totalMatching === 1
                ? itemLabel.replace(/s$/, "").replace(/ie$/, "y")
                : itemLabel}
            </>
          )}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="text-fg-muted ml-2 h-7 px-2"
            >
              Clear filters
            </Button>
          )}
        </p>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
