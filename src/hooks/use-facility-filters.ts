import { useState, useEffect, useMemo, useCallback } from "react";

export type FacilitySortField = "name" | "id" | "capacity" | "co2";
export type SortDirection = "asc" | "desc";

export interface UseFacilityFiltersOptions {
  initialPageSize?: number;
  debounceMs?: number;
}

export function useFacilityFilters(options: UseFacilityFiltersOptions = {}) {
  const { initialPageSize = 10, debounceMs = 250 } = options;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedFuel, setSelectedFuel] = useState<string>("ALL");
  const [selectedNerc, setSelectedNerc] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [sortBy, setSortBy] = useState<FacilitySortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [search, debounceMs]);

  const handleSortChange = useCallback((field: FacilitySortField) => {
    setSortBy((prevSortBy) => {
      if (prevSortBy === field) {
        setSortDir((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevSortBy;
      } else {
        setSortDir(field === "capacity" || field === "co2" ? "desc" : "asc");
        return field;
      }
    });
    setPage(1);
  }, []);

  const handleStateChange = useCallback((st: string) => {
    setSelectedState(st);
    setPage(1);
  }, []);

  const handleFuelChange = useCallback((fuel: string) => {
    setSelectedFuel(fuel);
    setPage(1);
  }, []);

  const handleNercChange = useCallback((nerc: string) => {
    setSelectedNerc(nerc);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      search.trim() !== "" ||
      selectedState !== "ALL" ||
      selectedFuel !== "ALL" ||
      selectedNerc !== "ALL",
    [search, selectedState, selectedFuel, selectedNerc],
  );

  const resetFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedState("ALL");
    setSelectedFuel("ALL");
    setSelectedNerc("ALL");
    setPage(1);
  }, []);

  return {
    search,
    setSearch,
    debouncedSearch,
    selectedState,
    setSelectedState: handleStateChange,
    selectedFuel,
    setSelectedFuel: handleFuelChange,
    selectedNerc,
    setSelectedNerc: handleNercChange,
    page,
    setPage,
    pageSize,
    setPageSize: handlePageSizeChange,
    sortBy,
    sortDir,
    handleSortChange,
    hasActiveFilters,
    resetFilters,
  };
}

export type UseFacilityFiltersReturn = ReturnType<typeof useFacilityFilters>;
