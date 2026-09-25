"use client";

import { useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, toOptions } from "~/components/ui/select";
import {
  DEFAULT_FILTERS,
  type FacilityFilters,
  type FilterChangeHandler,
} from "~/lib/facility-filters";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

type FilterOptions = RouterOutputs["facilities"]["getFilterOptions"];

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
  ).some((key) => filters[key].trim() !== DEFAULT_FILTERS[key]);

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

export function FacilityFilterBar({
  filters,
  filterOptions,
  onFilterChange,
  onResetFilters,
  totalMatching,
  isLoading,
}: {
  filters: FacilityFilters;
  filterOptions?: FilterOptions;
  onFilterChange: FilterChangeHandler;
  onResetFilters: () => void;
  totalMatching?: number;
  isLoading: boolean;
}) {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const activeSelectCount = (
    ["stateCode", "nercRegion", "primaryFuel"] as const
  ).filter((key) => filters[key] !== "ALL").length;
  const selectProps = {
    filters,
    filterOptions,
    onFilterChange,
    onResetFilters,
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="text-fg-muted pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
            <Input
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              placeholder="Search plant, operator, state..."
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
            {activeSelectCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-400">
                {activeSelectCount}
              </span>
            )}
          </Button>
        </div>

        <div className="text-fg-muted ml-auto text-xs whitespace-nowrap sm:text-sm">
          {isLoading ? (
            "Updating..."
          ) : (
            <>
              <strong className="text-fg font-semibold">
                {totalMatching?.toLocaleString() ?? 0}
              </strong>{" "}
              facilities
            </>
          )}
        </div>
      </div>

      {isMobileFiltersOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 grid grid-cols-2 gap-2 pt-1 duration-150 sm:hidden">
          <FilterSelects drawer {...selectProps} />
        </div>
      )}
    </div>
  );
}
