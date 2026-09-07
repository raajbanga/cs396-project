"use client";

import { Search, X, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
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

const TOP_NERC_CHIPS = ["ERCOT", "SERC", "WECC", "RFC"];
const TOP_FUEL_CHIPS = ["Natural Gas", "Coal"];

export function FacilityFilters({
  search,
  onSearchChange,
  selectedState,
  onStateChange,
  selectedNerc,
  onNercChange,
  selectedCategory,
  onCategoryChange,
  selectedFuel,
  onFuelChange,
  filterOptions,
  totalMatching,
  isLoading,
  hasActiveFilters,
  onResetFilters,
  compareCount,
}: FacilityFiltersProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/70 shadow-lg">
      <CardContent className="space-y-3.5 p-4">
        {/* Dropdown Filters & Search Bar */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-12">
          {/* Search Input */}
          <div className="relative md:col-span-4">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search facility name, owner, county, ORISPL..."
              className="pr-8 pl-9"
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

          {/* State Select */}
          <div className="md:col-span-2">
            <Select value={selectedState} onValueChange={onStateChange}>
              <SelectTrigger className="w-full">
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
          </div>

          {/* NERC Grid Select */}
          <div className="md:col-span-2">
            <Select value={selectedNerc} onValueChange={onNercChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All NERC Grids" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All NERC Grids</SelectItem>
                {filterOptions?.nercRegions.map((n) => (
                  <SelectItem key={n} value={n}>
                    Grid: {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source Category Select */}
          <div className="md:col-span-2">
            <Select value={selectedCategory} onValueChange={onCategoryChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {filterOptions?.sourceCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fuel Select */}
          <div className="md:col-span-2">
            <Select value={selectedFuel} onValueChange={onFuelChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Fuels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Fuel Types</SelectItem>
                {filterOptions?.fuels.map((fuel) => (
                  <SelectItem key={fuel} value={fuel}>
                    {fuel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quick Filter Chips & Status Meta */}
        <div className="flex flex-col justify-between gap-2.5 pt-1 text-xs text-zinc-400 sm:flex-row sm:items-center">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
              <Sparkles className="h-3 w-3 text-zinc-400" />
              Quick Grids:
            </span>
            {TOP_NERC_CHIPS.map((chip) => {
              const isSelected = selectedNerc === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onNercChange(isSelected ? "ALL" : chip)}
                  className={`cursor-pointer rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    isSelected
                      ? "border-sky-500/40 bg-sky-500/20 text-sky-300"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {chip}
                </button>
              );
            })}

            <span className="ml-2 text-[11px] font-medium text-zinc-500">
              Fuels:
            </span>
            {TOP_FUEL_CHIPS.map((chip) => {
              const isSelected = selectedFuel === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onFuelChange(isSelected ? "ALL" : chip)}
                  className={`cursor-pointer rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    isSelected
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                      : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>

          {/* Right Meta Info */}
          <div className="flex items-center gap-3">
            {isLoading ? (
              <span>Filtering...</span>
            ) : (
              <span>
                Found{" "}
                <strong className="text-zinc-200">
                  {totalMatching?.toLocaleString() ?? 0}
                </strong>{" "}
                matching plants
              </span>
            )}

            {compareCount > 0 && (
              <Badge variant="sky" className="py-0 font-mono text-[10px]">
                {compareCount} marked for benchmark
              </Badge>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="cursor-pointer text-xs text-zinc-400 underline hover:text-zinc-200"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
