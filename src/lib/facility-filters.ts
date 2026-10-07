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

/** §5 CAMPD retrieval: a year range plus the annual endpoint's filters ("ALL"/empty = no filter). */
export const campdFilterSchema = facilityFilterSchema
  .pick({ stateCode: true })
  .extend({
    facilityId: z.array(z.number().int().positive()).max(50).optional(),
    unitFuelType: z.string().optional(),
    unitType: z.string().optional(),
    controlTechnologies: z.string().optional(),
  });
export type CampdFilters = z.infer<typeof campdFilterSchema>;

export const campdRetrievalSchema = campdFilterSchema
  .extend({
    fromYear: z.number().int().min(1995),
    toYear: z.number().int().min(1995),
  })
  .refine((r) => r.fromYear <= r.toYear, {
    message: "From year must not be after To year.",
  });

export const DEFAULT_RETRIEVAL = {
  stateCode: "ALL",
  facilityIds: "",
  unitFuelType: "ALL",
  unitType: "ALL",
  controlTechnologies: "ALL",
};

/** "3, 7 10" → [3, 7, 10]; null if any entry isn't a positive integer. */
export function parseFacilityIds(text: string): number[] | null {
  const parts = text.split(/[\s,|]+/).filter(Boolean);
  const ids = parts.map(Number);
  return ids.every((n) => Number.isInteger(n) && n > 0) ? ids : null;
}

/** The filters that narrow a CAMPD request, dropping "ALL"/empty ones. */
export const activeCampdFilters = (filters: CampdFilters) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : v && v !== "ALL",
    ),
  ) as CampdFilters;

/** Short label for a retrieval's filters, e.g. "KY · Coal · Facility 3, 7"; "" when unfiltered. */
export const describeCampdFilters = ({
  stateCode,
  facilityId,
  unitFuelType,
  unitType,
  controlTechnologies,
}: CampdFilters) =>
  [
    stateCode,
    facilityId?.length && `Facility ${facilityId.join(", ")}`,
    unitFuelType,
    unitType,
    controlTechnologies,
  ]
    .filter((v) => v && v !== "ALL")
    .join(" · ");
