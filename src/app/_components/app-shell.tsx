"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Dialog } from "~/components/ui/dialog";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { cn, DETAIL_PARAMS } from "~/lib/utils";
import { CompareView } from "./compare-view";
import {
  SelectionContext,
  selectionLabel,
  type DetailView,
} from "./selection-context";
import { FacilityDetail } from "./facility-detail";
import { UnitDetail } from "./unit-detail";

const MAX_COMPARE = 4;

/** The open facility or unit as URL params, so a link or reload reopens it (§8.4). */
function writeDetailParam(view: DetailView | null) {
  const url = new URL(window.location.href);
  for (const key of DETAIL_PARAMS) url.searchParams.delete(key);
  if (view?.kind === "facility")
    url.searchParams.set("facility", String(view.id));
  if (view?.kind === "unit") url.searchParams.set("unit", view.id);
  window.history.replaceState(null, "", url);
}

function readDetailParam(): DetailView | null {
  const params = new URLSearchParams(window.location.search);
  const facility = Number(params.get("facility"));
  const unit = params.get("unit");
  if (Number.isInteger(facility) && facility > 0)
    return { kind: "facility", id: facility };
  return unit ? { kind: "unit", id: unit } : null;
}

/** The §9 pages, in workflow order: look at the data, then get data in and out. */
const NAV = [
  [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/map", label: "Map" },
  ],
  [
    { href: "/retrieve", label: "Retrieve" },
    { href: "/upload", label: "Upload" },
    { href: "/download", label: "Download" },
  ],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareUnitIds, setCompareUnitIds] = useState<string[]>([]);
  const [compareFull, setCompareFull] = useState(false);
  const [view, setView] = useState<DetailView | null>(null);

  // A shared link (or a page change) carries ?facility= / ?unit= for the dialog.
  useEffect(() => setView(readDetailParam()), [pathname]);

  const inspect = useCallback((next: DetailView | null) => {
    setView(next);
    writeDetailParam(next);
  }, []);

  const compareCount = compareIds.length + compareUnitIds.length;
  const canCompare = compareCount >= 2;
  function toggleIn<T>(list: T[], setList: (next: T[]) => void, id: T) {
    setCompareFull(false);
    if (list.includes(id)) return setList(list.filter((x) => x !== id));
    // At the limit the dock says so, instead of a blocking browser alert.
    if (compareCount >= MAX_COMPARE) return setCompareFull(true);
    setList([...list, id]);
  }
  const clearCompare = () => {
    setCompareIds([]);
    setCompareUnitIds([]);
    setCompareFull(false);
    if (view?.kind === "compare") inspect(null);
  };
  const selection = {
    compareIds,
    compareUnitIds,
    toggleCompare: (id: number) => toggleIn(compareIds, setCompareIds, id),
    toggleUnitCompare: (id: string) =>
      toggleIn(compareUnitIds, setCompareUnitIds, id),
    clearCompare,
    inspect,
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <SelectionContext value={selection}>
      <div className="flex min-h-screen flex-col">
        <header className="border-edge bg-canvas/95 sticky top-0 z-30 border-b backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 px-4 sm:flex-nowrap sm:px-6">
            <Link
              href="/"
              className="text-fg mr-auto shrink-0 py-3 text-[15px] font-semibold tracking-tight sm:mr-0"
            >
              epaData
            </Link>
            <nav
              aria-label="Main"
              className="order-last -mx-2 -mb-px flex min-w-0 basis-full items-center overflow-x-auto sm:order-none sm:mx-0 sm:flex-1 sm:basis-auto"
            >
              {NAV.map((group, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex shrink-0 items-center",
                    i > 0 && "border-edge sm:ml-2 sm:border-l sm:pl-2",
                  )}
                >
                  {group.map(({ href, label }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "border-b-2 px-[7px] py-2.5 text-sm whitespace-nowrap sm:px-2.5 sm:py-3",
                          active
                            ? "border-fg text-fg font-medium"
                            : "text-fg-muted hover:text-fg border-transparent",
                        )}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>

      <Dialog
        open={view !== null}
        onOpenChange={(open) => !open && inspect(null)}
        label={
          view?.kind === "compare"
            ? "Comparison"
            : view?.kind === "unit"
              ? "Unit details"
              : "Facility details"
        }
      >
        {view?.kind === "facility" ? (
          <FacilityDetail key={view.id} facilityId={view.id} />
        ) : view?.kind === "unit" ? (
          <UnitDetail key={view.id} unitInternalId={view.id} />
        ) : view?.kind === "compare" ? (
          <CompareView />
        ) : null}
      </Dialog>

      {compareCount > 0 && (
        <aside
          aria-label="Comparison selection"
          className="border-edge bg-surface fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-md border py-1.5 pr-1.5 pl-3 shadow-lg shadow-black/10"
        >
          <span className="text-fg-2 text-sm whitespace-nowrap">
            {selectionLabel(compareIds, compareUnitIds)} selected
          </span>
          {compareFull && (
            <span role="status" className="text-warn text-sm whitespace-nowrap">
              Up to {MAX_COMPARE}; remove one first
            </span>
          )}
          {!canCompare && (
            <span className="text-fg-muted hidden text-sm whitespace-nowrap sm:inline">
              Pick one more to compare
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={clearCompare}>
            Clear
          </Button>
          <Button
            size="sm"
            disabled={!canCompare}
            onClick={() => inspect({ kind: "compare" })}
          >
            Compare
          </Button>
        </aside>
      )}
    </SelectionContext>
  );
}
