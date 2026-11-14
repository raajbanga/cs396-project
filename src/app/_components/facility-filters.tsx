"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Field, FIELD_LABEL } from "~/components/ui/report";
import { Select, toOptions, type SelectOption } from "~/components/ui/select";
import { TryExamples } from "~/components/ui/try-examples";
import {
  DEFAULT_FILTERS,
  describeRanking,
  isFilterActive,
  RANK_METRICS,
  TOP_N_OPTIONS,
  RANGE_FIELDS,
  type FacilityFilters,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import { AUDIT_RULES, AUDIT_SEVERITIES } from "~/lib/emissions-metrics";
import { cn, formatNumber, shortNumber } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";
import { FacilitySearch, type FacilitySuggestion } from "./facility-search";

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

type DescribeResponse = RouterOutputs["facilities"]["describeSearch"];

/** Whether a description set anything besides a name search. */
const setsFilters = (filters: FacilityFilters) =>
  (Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]).some(
    (k) => k !== "search" && isFilterActive(filters, k),
  );

/**
 * Rubric §6 description search for any filter bar: the text is parsed into filters on submit.
 * Text the parser recognizes nothing in (a plant name) becomes a name search instead
 * (`onNameSearch`); otherwise `onApply` gets the parsed filters, sort, and view.
 */
export function useDescribeSearch({
  initialText = "",
  onApply,
  onNameSearch,
}: {
  initialText?: string;
  onApply: (result: DescribeResponse, text: string) => void;
  onNameSearch: (text: string) => void;
}) {
  const utils = api.useUtils();
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<DescribeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const run = async () => {
    const value = text.trim();
    setResult(null);
    if (!value) return onNameSearch("");
    setIsLoading(true);
    try {
      const r = await utils.facilities.describeSearch.fetch({ text: value });
      if (!setsFilters(r.filters) && !r.filters.search && !r.sort && !r.tab) {
        onNameSearch(value);
        return;
      }
      setResult(r);
      onApply(r, value);
    } catch (err) {
      setResult({
        unrecognized: [],
        via: "parser",
        notes: [err instanceof Error ? err.message : String(err)],
      });
    } finally {
      setIsLoading(false);
    }
  };
  const describe: DescribeProps = {
    text,
    onTextChange: setText,
    onSubmit: () => void run(),
    isLoading,
    result,
  };
  const reset = () => {
    setText("");
    setResult(null);
  };
  return { describe, reset };
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
  programCode: "Program",
  operatingStatus: "Status",
  auditFlag: "Flag",
  auditSeverity: "Severity",
};

const formatBound = (v: string) => {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? (shortNumber(n) ?? n.toLocaleString()) : v;
};

/** One removable chip per active filter (range pairs and ranking combined), built from the filters themselves. */
function activeChips(filters: FacilityFilters, names: Record<string, string>) {
  const on = (key: keyof FacilityFilters) => isFilterActive(filters, key);
  const chips: { label: string; keys: (keyof FacilityFilters)[] }[] = [];
  if (on("search"))
    chips.push({ label: `"${filters.search}"`, keys: ["search"] });
  if (on("facilityId"))
    chips.push({
      label:
        names[filters.facilityId.trim()] ?? `Facility #${filters.facilityId}`,
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
    // Years read as plain numbers ("2015", not "2,015").
    const format = key === "year" ? (v: string) => v.trim() : formatBound;
    const min = on(`${key}Min`) ? format(filters[`${key}Min`]) : undefined;
    const max = on(`${key}Max`) ? format(filters[`${key}Max`]) : undefined;
    if (!min && !max) continue;
    const minStrict = on(`${key}MinStrict`);
    const maxStrict = on(`${key}MaxStrict`);
    const bounds =
      min && max && !minStrict && !maxStrict
        ? min === max
          ? min
          : `${min}–${max}`
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
  const ranking = describeRanking(filters);
  if (ranking) {
    chips.push({
      label: ranking,
      keys: ["topN", "topBy", "topDir", "topLevel", "rankGroup"],
    });
  }
  return chips;
}

/** Facility and unit IDs, typed exactly (the search box suggests facilities by name). */
const ID_INPUTS = [
  ["facilityId", "Facility ID", "e.g. 3", "numeric"],
  ["unitId", "Unit ID", "e.g. 1, CT1", "text"],
] as const;

/**
 * The filters, grouped as the "+ Filter" menu lists them. Every chip opens its group's editor, so
 * all of §8.1–8.3 stays one or two clicks away without a wall of fields on the page.
 */
const GROUPS = [
  { id: "place", label: "Place", hint: "State, county, grid region" },
  { id: "years", label: "Years", hint: "One year or a range" },
  { id: "fuel", label: "Fuel", hint: "Primary and secondary fuel" },
  {
    id: "equipment",
    label: "Unit and controls",
    hint: "Unit type, status, pollution controls, program",
  },
  {
    id: "amounts",
    label: "Amounts",
    hint: "CO₂, SO₂, NOₓ, heat input, load, capacity…",
  },
  { id: "rank", label: "Top N", hint: "Keep only the highest or lowest" },
  {
    id: "more",
    label: "IDs and data checks",
    hint: "Facility or unit ID, audit flags, record origin",
  },
] as const;
type GroupId = (typeof GROUPS)[number]["id"];

/** Which group's editor a filter key belongs to (and so which one its chip opens). */
const groupOf = (key: keyof FacilityFilters): GroupId | null => {
  if (["stateCode", "county", "nercRegion"].includes(key)) return "place";
  if (key === "year" || key.startsWith("year")) return "years";
  if (["primaryFuel", "secondaryFuel"].includes(key)) return "fuel";
  if (
    [
      "unitType",
      "operatingStatus",
      "so2Control",
      "noxControl",
      "pmControl",
      "programCode",
    ].includes(key)
  )
    return "equipment";
  if (["topN", "topBy", "topDir", "topLevel", "rankGroup"].includes(key))
    return "rank";
  if (
    ["facilityId", "unitId", "auditFlag", "auditSeverity", "origin"].includes(
      key,
    )
  )
    return "more";
  if (RANGE_FIELDS.some((f) => key.startsWith(f.key))) return "amounts";
  return null;
};

interface EditorProps {
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  view: FilterBarProps["itemLabel"];
  analysis?: boolean;
}

/** Labelled selects, one per row: the shape of most group editors. */
function Selects({
  fields,
  filters,
  onFilterChange,
}: {
  fields: readonly (readonly [
    keyof FacilityFilters,
    string,
    readonly SelectOption[],
  ])[];
} & Pick<EditorProps, "filters" | "onFilterChange">) {
  return (
    <>
      {fields.map(([key, label, options]) => (
        <Field key={key} label={label}>
          <Select
            value={filters[key]}
            onValueChange={(value) => onFilterChange(key, value)}
            options={options}
            size="drawer"
          />
        </Field>
      ))}
    </>
  );
}

/** One §8.2 min–max pair; ≥ / ≤ toggle to strict > / <. */
function RangeRow({
  field: { key, label, unit },
  filters,
  onFilterChange,
}: {
  field: (typeof RANGE_FIELDS)[number];
} & Pick<EditorProps, "filters" | "onFilterChange">) {
  return (
    <div className="space-y-1">
      <span className={cn(FIELD_LABEL, "block")}>
        {label} <span className="text-fg-muted font-normal">({unit})</span>
      </span>
      <div className="grid grid-cols-2 gap-2">
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
                onClick={() => onFilterChange(strictKey, strict ? "" : "1")}
                aria-pressed={strict}
                aria-label={`${label} ${bound === "Min" ? "minimum" : "maximum"}: ${strict ? "strict" : "inclusive"}`}
                title={
                  strict
                    ? "Strict (click for inclusive)"
                    : "Inclusive (click for strict)"
                }
                className="aria-pressed:bg-surface-2 aria-pressed:text-fg w-6 shrink-0 font-mono"
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
    </div>
  );
}

/** The §8.3 Top-N settings. */
function TopN({
  filters,
  onFilterChange,
  view,
  analysis,
}: Omit<EditorProps, "filterOptions">) {
  const off = filters.topN === "ALL";
  return (
    <>
      <Field label="Keep">
        <Select
          value={filters.topN}
          onValueChange={(value) => onFilterChange("topN", value)}
          options={[
            { value: "ALL", label: "All rows" },
            ...TOP_N_OPTIONS.map((n) => ({
              value: String(n),
              label: `The first ${n}`,
            })),
          ]}
          size="drawer"
        />
      </Field>
      {!off && (
        <Selects
          filters={filters}
          onFilterChange={onFilterChange}
          fields={[
            [
              "topLevel",
              "Of",
              [
                { value: "facility", label: "Facilities" },
                { value: "unit", label: "Unit-years" },
              ],
            ],
            [
              "topBy",
              "Ranked by",
              RANK_METRICS.map((m) => ({
                value: m.key,
                label: `${m.label} (${m.unit})`,
              })),
            ],
            [
              "topDir",
              "Order",
              [
                { value: "desc", label: "Highest first" },
                { value: "asc", label: "Lowest first" },
              ],
            ],
            [
              "rankGroup",
              "Within",
              [
                { value: "ALL", label: "All selected" },
                { value: "state", label: "Each state" },
              ],
            ],
          ]}
        />
      )}
      <p className="text-fg-muted text-xs">
        Applies after the other filters, on every page and in downloads.
        {view === "unit-years" && !analysis
          ? " Sorting the table only changes the order."
          : ""}
      </p>
    </>
  );
}

/** The fields of one filter group, as its popover shows them. */
function GroupEditor({ group, ...props }: EditorProps & { group: GroupId }) {
  const { filters, filterOptions: o, onFilterChange, analysis } = props;
  const set = { filters, onFilterChange };
  switch (group) {
    case "place": {
      const counties = [
        ...new Set(
          (o?.counties ?? [])
            .filter(
              (c) =>
                filters.stateCode === "ALL" ||
                c.stateCode === filters.stateCode,
            )
            .map((c) => c.county),
        ),
      ];
      return (
        <Selects
          {...set}
          fields={[
            ["stateCode", "State", toOptions(o?.states, "All states")],
            ["county", "County", toOptions(counties, "All counties")],
            ["nercRegion", "Grid region", toOptions(o?.nercRegions, "All")],
          ]}
        />
      );
    }
    case "years": {
      const years = [...(o?.years ?? [])].reverse();
      return analysis ? (
        <div className="grid grid-cols-2 gap-2">
          {(["yearMin", "yearMax"] as const).map((key, i) => (
            <Field key={key} label={i ? "To" : "From"}>
              <Select
                value={filters[key] || "ALL"}
                onValueChange={(v) => onFilterChange(key, v === "ALL" ? "" : v)}
                options={toOptions(years, i ? "Last" : "First")}
                size="drawer"
              />
            </Field>
          ))}
        </div>
      ) : (
        <>
          <Selects
            {...set}
            fields={[["year", "Year", toOptions(o?.years, "All years")]]}
          />
          <RangeRow
            {...set}
            field={RANGE_FIELDS.find((f) => f.key === "year")!}
          />
        </>
      );
    }
    case "fuel":
      return (
        <Selects
          {...set}
          fields={[
            ["primaryFuel", "Primary fuel", toOptions(o?.fuels, "All fuels")],
            [
              "secondaryFuel",
              "Secondary fuel",
              toOptions(o?.secondaryFuels, "Any"),
            ],
          ]}
        />
      );
    case "equipment":
      return (
        <Selects
          {...set}
          fields={[
            [
              "unitType",
              "Unit type",
              toOptions(o?.unitTypes, "All unit types"),
            ],
            [
              "operatingStatus",
              "Operating status",
              toOptions(o?.operatingStatuses, "Any"),
            ],
            ["so2Control", "SO₂ control", toOptions(o?.so2Controls, "Any")],
            ["noxControl", "NOₓ control", toOptions(o?.noxControls, "Any")],
            ["pmControl", "PM control", toOptions(o?.pmControls, "Any")],
            ["programCode", "Program", toOptions(o?.programCodes, "Any")],
          ]}
        />
      );
    case "amounts":
      return (
        <>
          <p className="text-fg-muted text-xs">
            Per unit-year. Click ≥ or ≤ to make a bound strict.
          </p>
          {RANGE_FIELDS.filter((f) => f.key !== "year").map((field) => (
            <RangeRow key={field.key} {...set} field={field} />
          ))}
        </>
      );
    case "rank":
      return <TopN {...props} />;
    case "more":
      return (
        <>
          {ID_INPUTS.map(([key, label, placeholder, inputMode]) => (
            <Field key={key} label={label}>
              <Input
                value={filters[key]}
                onChange={(e) => onFilterChange(key, e.target.value)}
                placeholder={placeholder}
                inputMode={inputMode}
              />
            </Field>
          ))}
          <Selects
            {...set}
            fields={[
              [
                "auditFlag",
                "Audit flag",
                [
                  { value: "ALL", label: "Any (or none)" },
                  ...AUDIT_RULES.map((r) => ({
                    value: r.flagType,
                    label: r.label,
                  })),
                ],
              ],
              [
                "auditSeverity",
                "Flag severity",
                toOptions(AUDIT_SEVERITIES, "Any"),
              ],
              [
                "origin",
                "Record origin",
                [
                  { value: "ALL", label: "Any" },
                  { value: "API", label: "EPA CAMPD API" },
                  { value: "UPLOAD", label: "File upload" },
                ],
              ],
            ]}
          />
        </>
      );
  }
}

const editorWidth = (group: GroupId) => (group === "amounts" ? "w-80" : "w-72");

/** A popover body: the group's fields in a scrollable column. */
function EditorBody({ group, ...props }: EditorProps & { group: GroupId }) {
  return (
    <div className="max-h-[70vh] space-y-3 overflow-y-auto">
      <GroupEditor group={group} {...props} />
    </div>
  );
}

/** "+ Filter": the groups, then the chosen group's fields in the same popover. */
function AddFilter(props: EditorProps) {
  const [group, setGroup] = useState<GroupId | null>(null);
  const shown = GROUPS.filter((g) => props.view !== "flags" || g.id !== "rank");
  return (
    <Popover onOpenChange={() => setGroup(null)}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5">
          <Plus className="h-3.5 w-3.5" />
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className={group ? editorWidth(group) : "w-72 p-1"}>
        {group ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setGroup(null)}
              className="text-fg-muted hover:text-fg flex cursor-pointer items-center gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {GROUPS.find((g) => g.id === group)?.label}
            </button>
            <EditorBody group={group} {...props} />
          </div>
        ) : (
          <ul>
            {shown.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className="hover:bg-surface-2 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-fg block text-sm">{g.label}</span>
                    <span className="text-fg-muted block truncate text-xs">
                      {g.hint}
                    </span>
                  </span>
                  <ChevronRight className="text-fg-muted h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** An active filter: click it to change it in its group's editor; ✕ removes it. */
function FilterChip({
  label,
  keys,
  ...props
}: EditorProps & { label: string; keys: (keyof FacilityFilters)[] }) {
  const group = groupOf(keys[0]!);
  const remove = () =>
    keys.forEach((k) => props.onFilterChange(k, DEFAULT_FILTERS[k]));
  return (
    <span className="border-edge bg-surface text-fg-2 inline-flex h-7 items-center rounded-md border text-sm">
      {group ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="hover:text-fg cursor-pointer rounded-l-md pr-1 pl-2.5"
            >
              {label}
            </button>
          </PopoverTrigger>
          <PopoverContent className={editorWidth(group)}>
            <EditorBody group={group} {...props} />
          </PopoverContent>
        </Popover>
      ) : (
        <span className="pr-1 pl-2.5">{label}</span>
      )}
      <button
        type="button"
        onClick={remove}
        className="text-fg-muted hover:text-fg cursor-pointer rounded-r-md px-1.5"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** What the description search made of the text: anything it didn't understand, and how. */
function DescribeNote({ result }: { result: DescribeResult }) {
  return (
    <p className="text-fg-muted text-xs" title={result.notes.join("\n")}>
      {result.unrecognized.length > 0 && (
        <span className="text-warn">
          Not understood: {result.unrecognized.join(", ")}.{" "}
        </span>
      )}
      Read by the {result.via === "parser" ? "built-in parser" : result.via}
      {result.notes.length > 0 &&
        `; ${result.notes.join(" ").replace(/\.$/, "")}`}
      .
    </p>
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
  /**
   * A picked search suggestion. Defaults to filtering to that facility; the Map flies to it
   * instead.
   */
  onPickFacility?: (facility: FacilitySuggestion) => void;
  /** Analyze page: a year range instead of a single year. */
  analysis?: boolean;
}

/**
 * The search form of every data page: one search box (description or name), then one line with
 * the match count, the active filters as chips (click to edit, ✕ to remove), "+ Filter" for the
 * rest, and the page's actions.
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
  onPickFacility,
  analysis,
}: FilterBarProps) {
  const hasActiveFilters = (
    Object.keys(DEFAULT_FILTERS) as (keyof FacilityFilters)[]
  ).some((key) => isFilterActive(filters, key));
  const text = describe ? describe.text : filters.search;
  const setText = (value: string) =>
    describe ? describe.onTextChange(value) : onFilterChange("search", value);
  // Facility names picked from suggestions, so their chip reads "Ghent (1356)", not "Facility #1356".
  const [names, setNames] = useState<Record<string, string>>({});
  const pickFacility = (f: FacilitySuggestion) => {
    setNames((n) => ({ ...n, [f.id]: `${f.name} (${f.id})` }));
    setText("");
    if (onPickFacility) return onPickFacility(f);
    onFilterChange("search", "");
    onFilterChange("facilityId", String(f.id));
  };
  const editor: EditorProps = {
    filters,
    filterOptions,
    onFilterChange,
    view: itemLabel,
    analysis,
  };
  const chips = activeChips(filters, names);

  return (
    <div className="space-y-2.5">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          describe?.onSubmit();
        }}
      >
        <FacilitySearch
          className="flex-1"
          value={text}
          onValueChange={setText}
          onPick={pickFacility}
          onSubmit={describe?.onSubmit}
          onClear={onResetFilters}
          isLoading={describe?.isLoading}
          placeholder={
            describe
              ? `Search a plant, or describe what you want: “${DESCRIBE_EXAMPLES[0]}”`
              : "Search plant, operator, county, or ID"
          }
          aria-label={
            describe
              ? "Describe what you want to find, or search by name"
              : "Search by plant, operator, county, or ID"
          }
          hint={
            describe
              ? "Pick a facility, or press Enter to search by description."
              : undefined
          }
        />
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

      {describe?.result && <DescribeNote result={describe.result} />}
      {describe && !describe.text && !hasActiveFilters && (
        <TryExamples
          examples={DESCRIBE_EXAMPLES.map((ex) => ({
            label: ex,
            onSelect: () => describe.onTextChange(ex),
          }))}
        />
      )}

      {/* One line: how many match, the filters that produced them, and the page's actions. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className="text-fg-2 mr-1.5 text-sm whitespace-nowrap"
            aria-live="polite"
          >
            {isLoading ? (
              "Searching…"
            ) : (
              <>
                <strong className="text-fg font-semibold tabular-nums">
                  {formatNumber(totalMatching)}
                </strong>{" "}
                {totalMatching === 1
                  ? itemLabel.replace(/s$/, "").replace(/ie$/, "y")
                  : itemLabel}
              </>
            )}
          </p>
          {chips.map(({ label, keys }) => (
            <FilterChip
              key={keys.join()}
              label={label}
              keys={keys}
              {...editor}
            />
          ))}
          {/* The two most used filters stay one click away until set (then they're chips). */}
          {(
            [
              ["stateCode", "State", filterOptions?.states],
              ["primaryFuel", "Fuel", filterOptions?.fuels],
            ] as const
          ).map(
            ([key, label, values]) =>
              !isFilterActive(filters, key) && (
                <Select
                  key={key}
                  value={filters[key]}
                  onValueChange={(value) => onFilterChange(key, value)}
                  options={toOptions(values, label)}
                  aria-label={label}
                  className="text-fg-2 h-7 w-auto border-dashed px-2.5"
                />
              ),
          )}
          <AddFilter {...editor} />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="text-fg-muted h-7 px-2"
            >
              Clear all
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
