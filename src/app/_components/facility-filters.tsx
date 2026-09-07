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
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
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
      {/* Sleek shadcn/ui Data-Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Search input & inline faceted selects */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search plant, operator, state..."
              className="h-9 pr-8 pl-9 bg-zinc-900/60 border-zinc-800 text-sm focus-visible:ring-zinc-700"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute top-2.5 right-2.5 cursor-pointer text-zinc-400 hover:text-zinc-200"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Desktop Inline Selects (>= sm) */}
          <div className="hidden sm:flex items-center gap-2">
            {/* State Select */}
            <Select value={selectedState} onValueChange={onStateChange}>
              <SelectTrigger className="h-9 w-[130px] text-xs sm:text-sm bg-zinc-900/60 border-zinc-800">
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All States ({filterOptions?.states.length ?? 0})</SelectItem>
                {filterOptions?.states.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* NERC Grid Select */}
            <Select value={selectedNerc} onValueChange={onNercChange}>
              <SelectTrigger className="h-9 w-[135px] text-xs sm:text-sm bg-zinc-900/60 border-zinc-800">
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

            {/* Fuel Select */}
            <Select value={selectedFuel} onValueChange={onFuelChange}>
              <SelectTrigger className="h-9 w-[135px] text-xs sm:text-sm bg-zinc-900/60 border-zinc-800">
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

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onResetFilters}
                className="h-9 px-2.5 text-xs text-zinc-400 hover:text-white gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </Button>
            )}
          </div>

          {/* Mobile Filter Toggle Button (< sm) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            className="sm:hidden h-9 px-3 gap-1.5 border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Right: Results Count */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400 ml-auto whitespace-nowrap">
          {isLoading ? (
            <span className="text-xs text-zinc-500">Updating...</span>
          ) : (
            <span>
              <strong className="text-zinc-100 font-semibold">
                {totalMatching?.toLocaleString() ?? 0}
              </strong>{" "}
              facilities
            </span>
          )}
        </div>
      </div>

      {/* Mobile Collapsible Drawer (< sm) */}
      {isMobileFiltersOpen && (
        <div className="grid grid-cols-2 gap-2 pt-1 sm:hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <Select value={selectedState} onValueChange={onStateChange}>
            <SelectTrigger className="h-9 w-full text-xs bg-zinc-900/80 border-zinc-800">
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
            <SelectTrigger className="h-9 w-full text-xs bg-zinc-900/80 border-zinc-800">
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
            <SelectTrigger className="h-9 w-full text-xs bg-zinc-900/80 border-zinc-800 col-span-2">
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
              className="col-span-2 h-8 text-xs text-zinc-300 gap-1"
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
