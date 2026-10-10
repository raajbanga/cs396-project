"use client";

import { useState, type ReactNode } from "react";
import {
  ListFilter,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FIELD_LABEL } from "~/components/ui/report";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Select, toOptions } from "~/components/ui/select";
import {
  ADVANCED_FILTER_KEYS,
  DEFAULT_FILTERS,
  isFilterActive,
  TOP_N_OPTIONS,
  RANGE_FIELDS,
  type FacilityFilters,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

type FilterOptions = RouterOutputs["facilities"]["getFilterOptions"];
type DescribeResult = Pick<
  RouterOutputs["facilities"]["describeSearch"],
  "unrecognized" | "via" | "notes"
>;

/** Description search (rubric §6) wiring for the search box; omitted where only name search applies. */
export interface DescribeProps {
  mode: "name" | "describe";
  text: string;
  onModeChange: (mode: "name" | "describe") => void;
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
    const range =
      key === "year"
        ? `${label} ${min ?? "…"}–${max ?? "…"}`
        : min && max
          ? `${label} ${min}–${max} ${unit}`
          : `${label} ${min ? `≥ ${min}` : `≤ ${max}`} ${unit}`;
    chips.push({ label: range, keys: [`${key}Min`, `${key}Max`] });
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
  describe,
}: {
  filters: FacilityFilters;
  onFilterChange: FilterChangeHandler;
  describe?: DescribeProps;
}) {
  const chips = activeChips(filters);
  const result = describe?.mode === "describe" ? describe.result : null;
  if (chips.length === 0 && !result) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-fg-muted">
        {result ? "Interpreted as:" : "Filters:"}
      </span>
      {chips.map(({ label, keys }) => (
        <Badge key={keys.join()} variant="outline" className="gap-1 pr-1">
          {label}
          <button
            type="button"
            onClick={() =>
              keys.forEach((k) => onFilterChange(k, DEFAULT_FILTERS[k]))
            }
            className="text-fg-muted hover:text-fg cursor-pointer rounded"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {result && chips.length === 0 && (
        <span className="text-fg-muted italic">no filters</span>
      )}
      {result && result.unrecognized.length > 0 && (
        <span className="text-amber-700 dark:text-amber-400">
          Not understood: {result.unrecognized.join(", ")}
        </span>
      )}
      {result && (
        <span className="text-fg-muted" title={result.notes.join("\n")}>
          via {result.via}
          {result.notes.length > 0 && ` · ${result.notes.join(" · ")}`}
        </span>
      )}
    </div>
  );
}

function FilterSelects({
  drawer,
  filters,
  filterOptions,
  onFilterChange,
  onResetFilters,
}: {
  drawer: boolean;
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  onResetFilters: () => void;
}) {
  const selects = [
    {
      key: "stateCode",
      width: "w-[130px]",
      options: toOptions(
        filterOptions?.states,
        drawer
          ? "All States"
          : `All States (${filterOptions?.states.length ?? 0})`,
      ),
    },
    {
      key: "nercRegion",
      width: "w-[135px]",
      options: [
        { value: "ALL", label: "All Grids" },
        ...(filterOptions?.nercRegions ?? []).map((n) => ({
          value: n,
          label: drawer ? n : `Grid: ${n}`,
        })),
      ],
    },
    {
      key: "primaryFuel",
      width: "w-[135px]",
      options: toOptions(filterOptions?.fuels, "All Fuels"),
    },
  ] as const;
  const hasActiveFilters = (
    Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]
  ).some((key) => isFilterActive(filters, key));

  return (
    <>
      {selects.map(({ key, width, options }) => (
        <Select
          key={key}
          value={filters[key]}
          onValueChange={(value) => onFilterChange(key, value)}
          options={options}
          size={drawer ? "drawer" : "toolbar"}
          className={
            drawer ? (key === "primaryFuel" ? "col-span-2" : "") : width
          }
        />
      ))}
      {hasActiveFilters && (
        <Button
          variant={drawer ? "outline" : "ghost"}
          size="sm"
          onClick={onResetFilters}
          className={cn("gap-1 text-xs", drawer ? "col-span-2" : "h-9 px-2.5")}
        >
          <RotateCcw className="h-3 w-3" />
          {drawer ? "Reset all filters" : "Reset"}
        </Button>
      )}
    </>
  );
}

/** §8.1 unit/year filters, §8.2 min–max ranges, and §8.3 Top-N ranking; all AND together. */
function AdvancedFilters({
  filters,
  filterOptions,
  onFilterChange,
  isUnitView,
}: {
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  isUnitView: boolean;
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
    ["year", "Reporting year", toOptions(filterOptions?.years, "All years")],
    ["county", "County", toOptions(counties, "All counties")],
    [
      "secondaryFuel",
      "Secondary fuel",
      toOptions(filterOptions?.secondaryFuels, "Any secondary fuel"),
    ],
    ["unitType", "Unit type", toOptions(filterOptions?.unitTypes, "Any type")],
    [
      "so2Control",
      "SO₂ control",
      toOptions(filterOptions?.so2Controls, "Any SO₂ control"),
    ],
    [
      "noxControl",
      "NOₓ control",
      toOptions(filterOptions?.noxControls, "Any NOₓ control"),
    ],
    [
      "pmControl",
      "PM control",
      toOptions(filterOptions?.pmControls, "Any PM control"),
    ],
    [
      "operatingStatus",
      "Operating status",
      toOptions(filterOptions?.operatingStatuses, "Any status"),
    ],
    [
      "origin",
      "Origin",
      [
        { value: "ALL", label: "Any origin" },
        { value: "API", label: "EPA CAMPD API" },
        { value: "UPLOAD", label: "File upload" },
      ],
    ],
  ] as const;
  const inputs = [
    ["facilityId", "Facility ID", "e.g. 1378", "numeric"],
    ["unitId", "Unit ID", "e.g. 1, CT1", "text"],
  ] as const;

  return (
    <div className="border-edge/80 bg-surface/30 space-y-4 rounded-xl border p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {inputs.map(([key, label, placeholder, inputMode]) => (
          <label key={key} className="space-y-1">
            <span className={FIELD_LABEL}>{label}</span>
            <Input
              value={filters[key]}
              onChange={(e) => onFilterChange(key, e.target.value)}
              placeholder={placeholder}
              inputMode={inputMode}
              className="bg-surface/60"
            />
          </label>
        ))}
        {selects.map(([key, label, options]) => (
          <label key={key} className="space-y-1">
            <span className={FIELD_LABEL}>{label}</span>
            <Select
              value={filters[key]}
              onValueChange={(value) => onFilterChange(key, value)}
              options={options}
              size="drawer"
            />
          </label>
        ))}
      </div>

      <div className="space-y-1.5">
        <span className={FIELD_LABEL}>
          Ranges per unit-year (min / max, inclusive)
        </span>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {RANGE_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <span className="text-fg-2 w-28 shrink-0">
                {label} <span className="text-fg-muted">({unit})</span>
              </span>
              {(["Min", "Max"] as const).map((bound) => (
                <Input
                  key={bound}
                  value={filters[`${key}${bound}`]}
                  onChange={(e) =>
                    onFilterChange(`${key}${bound}`, e.target.value)
                  }
                  placeholder={bound.toLowerCase()}
                  inputMode="decimal"
                  aria-label={`${label} ${bound.toLowerCase()} (${unit})`}
                  className="bg-surface/60 h-8 text-xs"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="border-edge/60 flex flex-wrap items-end gap-2.5 border-t pt-3">
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Ranking</span>
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
        </label>
        <label className="space-y-1">
          <span className={FIELD_LABEL}>Group</span>
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
        </label>
        <p className="text-fg-muted max-w-xl pb-1 text-xs">
          Ranks follow the table sort: click a column header (↓ = Top-N, ↑ =
          Bottom-N).{" "}
          {isUnitView
            ? "Each row is one unit in one reporting year."
            : "Unit and range filters keep facilities with at least one matching unit-year; a reporting year also scopes the CO₂ totals."}
        </p>
      </div>
    </div>
  );
}

function CountBubble({ count }: { count: number }) {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-400">
      {count}
    </span>
  );
}

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
}: {
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  onResetFilters: () => void;
  totalMatching?: number;
  itemLabel: "facilities" | "unit-years";
  isLoading: boolean;
  /** Extra controls beside the result count, e.g. a CSV download. */
  actions?: ReactNode;
  describe?: DescribeProps;
}) {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const activeAdvancedCount = ADVANCED_FILTER_KEYS.filter((key) =>
    isFilterActive(filters, key),
  ).length;
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(activeAdvancedCount > 0);
  const activeSelectCount = (
    ["stateCode", "nercRegion", "primaryFuel"] as const
  ).filter((key) => filters[key] !== "ALL").length;
  const selectProps = {
    filters,
    filterOptions,
    onFilterChange,
    onResetFilters,
  };
  const isDescribing = describe?.mode === "describe";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {describe && (
            <SegmentedControl
              value={describe.mode}
              onChange={describe.onModeChange}
              options={[
                {
                  value: "name",
                  label: "Name",
                  title: "Search by plant, operator, or county name",
                },
                {
                  value: "describe",
                  label: "Describe",
                  title: "Describe what you want in plain English",
                },
              ]}
              className="h-9 items-center"
            />
          )}
          {isDescribing ? (
            <form
              className="relative w-full sm:w-96 lg:w-[28rem]"
              onSubmit={(e) => {
                e.preventDefault();
                describe.onSubmit();
              }}
            >
              {describe.isLoading ? (
                <Loader2 className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 animate-spin text-emerald-400" />
              ) : (
                <Sparkles className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-emerald-400" />
              )}
              <Input
                value={describe.text}
                onChange={(e) => describe.onTextChange(e.target.value)}
                placeholder={`e.g. ${DESCRIBE_EXAMPLES[0]}`}
                aria-label="Describe what you want to find"
                list="describe-examples"
                className="bg-surface/60 pr-16 pl-9"
              />
              <datalist id="describe-examples">
                {DESCRIBE_EXAMPLES.map((ex) => (
                  <option key={ex} value={ex} />
                ))}
              </datalist>
              <button
                type="submit"
                disabled={!describe.text.trim() || describe.isLoading}
                className="text-fg-muted hover:text-fg absolute top-1.5 right-1.5 cursor-pointer rounded px-2 py-1 text-xs font-medium disabled:opacity-40"
              >
                Search
              </button>
            </form>
          ) : (
            <div className="relative w-full sm:w-64 md:w-72">
              <Search className="text-fg-muted pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
              <Input
                value={filters.search}
                onChange={(e) => onFilterChange("search", e.target.value)}
                placeholder="Search plant, operator, county..."
                className="bg-surface/60 pr-8 pl-9"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => onFilterChange("search", "")}
                  className="text-fg-muted hover:text-fg absolute top-2.5 right-2.5 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <div className="hidden items-center gap-2 sm:flex">
            <FilterSelects drawer={false} {...selectProps} />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            className="bg-surface/60 h-9 sm:hidden"
          >
            <SlidersHorizontal className="text-fg-muted h-3.5 w-3.5" />
            Filters
            {activeSelectCount > 0 && <CountBubble count={activeSelectCount} />}
          </Button>

          <Button
            variant={isAdvancedOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setIsAdvancedOpen((prev) => !prev)}
            className="bg-surface/60 h-9"
            aria-expanded={isAdvancedOpen}
          >
            <ListFilter className="text-fg-muted h-3.5 w-3.5" />
            More filters
            {activeAdvancedCount > 0 && (
              <CountBubble count={activeAdvancedCount} />
            )}
          </Button>
        </div>

        <div className="text-fg-muted ml-auto flex items-center gap-2 text-xs whitespace-nowrap sm:text-sm">
          {isLoading ? (
            "Updating..."
          ) : (
            <span>
              <strong className="text-fg font-semibold">
                {totalMatching?.toLocaleString() ?? 0}
              </strong>{" "}
              {itemLabel}
            </span>
          )}
          {actions}
        </div>
      </div>

      <FilterChips
        filters={filters}
        onFilterChange={onFilterChange}
        describe={describe}
      />

      {isMobileFiltersOpen && (
        <div className="grid grid-cols-2 gap-2 pt-1 sm:hidden">
          <FilterSelects drawer {...selectProps} />
        </div>
      )}

      {isAdvancedOpen && (
        <AdvancedFilters
          filters={filters}
          filterOptions={filterOptions}
          onFilterChange={onFilterChange}
          isUnitView={itemLabel === "unit-years"}
        />
      )}
    </div>
  );
}
