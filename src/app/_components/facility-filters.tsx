"use client";

import { useState } from "react";
import { RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface FilterOptions {
  states: string[];
  fuels: string[];
  nercRegions: string[];
}

interface FacilityFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedState: string;
  onStateChange: (value: string) => void;
  selectedNerc: string;
  onNercChange: (value: string) => void;
  selectedFuel: string;
  onFuelChange: (value: string) => void;
  filterOptions?: FilterOptions;
  totalMatching?: number;
  isLoading: boolean;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

interface FilterSelectsProps {
  variant: "inline" | "drawer";
  filterOptions?: FilterOptions;
  selectedState: string;
  selectedNerc: string;
  selectedFuel: string;
  onStateChange: (value: string) => void;
  onNercChange: (value: string) => void;
  onFuelChange: (value: string) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

function FilterSelects({
  variant,
  filterOptions,
  selectedState,
  selectedNerc,
  selectedFuel,
  onStateChange,
  onNercChange,
  onFuelChange,
  hasActiveFilters,
  onResetFilters,
}: FilterSelectsProps) {
  const isDrawer = variant === "drawer";
  const triggerClass = isDrawer
    ? "h-9 w-full border-edge bg-surface/80 text-xs"
    : "h-9 border-edge bg-surface/60";
  const fuelTriggerClass = isDrawer
    ? "col-span-2 h-9 w-full border-edge bg-surface/80 text-xs"
    : "h-9 w-[135px] border-edge bg-surface/60";

  return (
    <>
      <Select value={selectedState} onValueChange={onStateChange}>
        <SelectTrigger
          className={isDrawer ? triggerClass : `${triggerClass} w-[130px]`}
        >
          <SelectValue placeholder="All States" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">
            {isDrawer
              ? "All States"
              : `All States (${filterOptions?.states.length ?? 0})`}
          </SelectItem>
          {filterOptions?.states.map((st) => (
            <SelectItem key={st} value={st}>
              {st}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedNerc} onValueChange={onNercChange}>
        <SelectTrigger
          className={isDrawer ? triggerClass : `${triggerClass} w-[135px]`}
        >
          <SelectValue placeholder="All Grids" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Grids</SelectItem>
          {filterOptions?.nercRegions.map((n) => (
            <SelectItem key={n} value={n}>
              {isDrawer ? n : `Grid: ${n}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedFuel} onValueChange={onFuelChange}>
        <SelectTrigger className={fuelTriggerClass}>
          <SelectValue placeholder="All Fuels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Fuels</SelectItem>
          {filterOptions?.fuels.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          type="button"
          variant={isDrawer ? "outline" : "ghost"}
          size="sm"
          onClick={onResetFilters}
          className={
            isDrawer
              ? "text-fg-2 col-span-2 h-8 gap-1 text-xs"
              : "text-fg-muted hover:text-fg h-9 gap-1 px-2.5 text-xs"
          }
        >
          <RotateCcw className="h-3 w-3" />
          <span>{isDrawer ? "Reset all filters" : "Reset"}</span>
        </Button>
      )}
    </>
  );
}

export function FacilityFilters({
  search,
  onSearchChange,
  selectedState,
  onStateChange,
  selectedNerc,
  onNercChange,
  selectedFuel,
  onFuelChange,
  filterOptions,
  totalMatching,
  isLoading,
  hasActiveFilters,
  onResetFilters,
}: FacilityFiltersProps) {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const activeFilterCount = [selectedState, selectedNerc, selectedFuel].filter(
    (value) => value !== "ALL",
  ).length;

  const filterSelectProps = {
    filterOptions,
    selectedState,
    selectedNerc,
    selectedFuel,
    onStateChange,
    onNercChange,
    onFuelChange,
    hasActiveFilters,
    onResetFilters,
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="text-fg-muted pointer-events-none absolute top-2.5 left-3 h-4 w-4" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search plant, operator, state..."
              className="bg-surface/60 border-edge h-9 pr-8 pl-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="text-fg-muted hover:text-fg absolute top-2.5 right-2.5 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <FilterSelects variant="inline" {...filterSelectProps} />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            className="border-edge bg-surface/60 text-fg-2 h-9 gap-1.5 px-3 text-xs sm:hidden"
          >
            <SlidersHorizontal className="text-fg-muted h-3.5 w-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-400">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <div className="text-fg-muted ml-auto flex items-center gap-2 text-xs whitespace-nowrap sm:text-sm">
          {isLoading ? (
            <span className="text-fg-muted text-xs">Updating...</span>
          ) : (
            <span>
              <strong className="text-fg font-semibold">
                {totalMatching?.toLocaleString() ?? 0}
              </strong>{" "}
              facilities
            </span>
          )}
        </div>
      </div>

      {isMobileFiltersOpen && (
        <div className="animate-in fade-in slide-in-from-top-1 grid grid-cols-2 gap-2 pt-1 duration-150 sm:hidden">
          <FilterSelects variant="drawer" {...filterSelectProps} />
        </div>
      )}
    </div>
  );
}
