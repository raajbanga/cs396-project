"use client";

import { useMemo, useState } from "react";
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
  sourceCategories: string[];
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
  compareCount: number;
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedState !== "ALL") count++;
    if (selectedNerc !== "ALL") count++;
    if (selectedFuel !== "ALL") count++;
    return count;
  }, [selectedState, selectedNerc, selectedFuel]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Search + inline selects */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-fg-muted" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search plant, operator, state..."
              className="h-9 pr-8 pl-9 bg-surface/60 border-edge"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute top-2.5 right-2.5 cursor-pointer text-fg-muted hover:text-fg"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Desktop Inline Selects (>= sm) */}
          <div className="hidden items-center gap-2 sm:flex">
            <Select value={selectedState} onValueChange={onStateChange}>
              <SelectTrigger className="h-9 w-[130px] border-edge bg-surface/60">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  All States ({filterOptions?.states.length ?? 0})
                </SelectItem>
                {filterOptions?.states.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedNerc} onValueChange={onNercChange}>
              <SelectTrigger className="h-9 w-[135px] border-edge bg-surface/60">
                <SelectValue placeholder="All Grids" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Grids</SelectItem>
                {filterOptions?.nercRegions.map((n) => (
                  <SelectItem key={n} value={n}>
                    Grid: {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedFuel} onValueChange={onFuelChange}>
              <SelectTrigger className="h-9 w-[135px] border-edge bg-surface/60">
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
                variant="ghost"
                size="sm"
                onClick={onResetFilters}
                className="h-9 gap-1 px-2.5 text-xs text-fg-muted hover:text-fg"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </Button>
            )}
          </div>

          {/* Mobile Filter Toggle (< sm) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            className="h-9 gap-1.5 border-edge bg-surface/60 px-3 text-xs text-fg-2 sm:hidden"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-fg-muted" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Right: Results Count */}
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap text-xs text-fg-muted sm:text-sm">
          {isLoading ? (
            <span className="text-xs text-fg-muted">Updating...</span>
          ) : (
            <span>
              <strong className="font-semibold text-fg">
                {totalMatching?.toLocaleString() ?? 0}
              </strong>{" "}
              facilities
            </span>
          )}
        </div>
      </div>

      {/* Mobile Collapsible Drawer (< sm) */}
      {isMobileFiltersOpen && (
        <div className="grid animate-in fade-in slide-in-from-top-1 grid-cols-2 gap-2 pt-1 duration-150 sm:hidden">
          <Select value={selectedState} onValueChange={onStateChange}>
            <SelectTrigger className="h-9 w-full border-edge bg-surface/80 text-xs">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All States</SelectItem>
              {filterOptions?.states.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedNerc} onValueChange={onNercChange}>
            <SelectTrigger className="h-9 w-full border-edge bg-surface/80 text-xs">
              <SelectValue placeholder="All Grids" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Grids</SelectItem>
              {filterOptions?.nercRegions.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedFuel} onValueChange={onFuelChange}>
            <SelectTrigger className="col-span-2 h-9 w-full border-edge bg-surface/80 text-xs">
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
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="col-span-2 h-8 gap-1 text-xs text-fg-2"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset all filters</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
