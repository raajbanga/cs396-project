"use client";

import { createContext } from "react";
import { plural } from "~/lib/utils";

/** What the detail dialog shows: one facility, one unit, or the comparison of 2–4 of them. */
export type DetailView =
  | { kind: "facility"; id: number }
  | { kind: "unit"; id: string }
  | { kind: "compare" };

/**
 * The comparison selection (§8.3) and the detail dialog, shared by every page: tables, the map,
 * and the dialog itself open a facility or unit with `inspect` and tick it with `toggle…`.
 */
export const SelectionContext = createContext({
  compareIds: [] as number[],
  compareUnitIds: [] as string[],
  toggleCompare: (_id: number): void => undefined,
  toggleUnitCompare: (_id: string): void => undefined,
  clearCompare: (): void => undefined,
  inspect: (_view: DetailView): void => undefined,
});

/** "2 facilities, 1 unit": the comparison selection (dock and Download page). */
export const selectionLabel = (ids: number[], unitIds: string[]) =>
  [
    ids.length && plural(ids.length, "facility", "facilities"),
    unitIds.length && plural(unitIds.length, "unit"),
  ]
    .filter(Boolean)
    .join(", ");
