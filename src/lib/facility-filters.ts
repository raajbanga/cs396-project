import { z } from "zod";

export const SORT_FIELDS = ["name", "id", "capacity", "co2"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export const facilityFilterSchema = z.object({
  search: z.string().optional(),
  stateCode: z.string().optional(),
  primaryFuel: z.string().optional(),
  nercRegion: z.string().optional(),
});

export const DEFAULT_FILTERS = {
  search: "",
  stateCode: "ALL",
  primaryFuel: "ALL",
  nercRegion: "ALL",
};
export type FacilityFilters = typeof DEFAULT_FILTERS;

export const DEFAULT_TABLE_STATE = {
  page: 1,
  pageSize: 10,
  sortBy: "name" as SortField,
  sortDir: "asc" as SortDirection,
};

export type FilterChangeHandler = (
  key: keyof FacilityFilters,
  value: string,
) => void;
