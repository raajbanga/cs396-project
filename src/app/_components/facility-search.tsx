"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "~/components/ui/input";
import { getFuelTheme } from "~/lib/map-utils";
import { cn, formatQuantity } from "~/lib/utils";
import { api, type RouterOutputs } from "~/trpc/react";

export type FacilitySuggestion = RouterOutputs["facilities"]["suggest"][number];

/**
 * The company to show under a suggestion: the operator (the owners are usually the same), or,
 * when the match came from an owner or operator rather than the name, that one ("Owner:
 * Allegheny Energy"), so the match makes sense. The stored text is "A (Owner)|B (Operator)".
 */
function companyLine(f: FacilitySuggestion, q: string) {
  const parts = (f.ownerOperator ?? "")
    .split("|")
    .map((p) => /^(.*?)\s*\((Owner|Operator)\)\s*$/.exec(p.trim()))
    .filter((m) => m !== null)
    .map(([, name, role]) => ({ name: name!, role: role! }));
  const needle = q.toLowerCase();
  if (needle && !f.name.toLowerCase().includes(needle)) {
    const hit = parts.find((p) => p.name.toLowerCase().includes(needle));
    if (hit) return `${hit.role}: ${hit.name}`;
  }
  return (parts.find((p) => p.role === "Operator") ?? parts[0])?.name ?? "";
}

/** `value`, once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms = 200) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/**
 * The one search box of the app: type a plant name, operator, county, or ID and pick a suggestion
 * (arrow keys and Enter, or the mouse). Enter with no suggestion highlighted calls `onSubmit`, which
 * the explorer-style bars use for description search; without one (a facility picker), it picks the
 * first match, waiting for the list if it is still loading. Every page shares this box and the server's
 * `facilities.suggest`, so search matches the same way everywhere.
 */
export function FacilitySearch({
  value,
  onValueChange,
  onPick,
  onSubmit,
  onClear,
  isLoading,
  placeholder = "Search plant, operator, county, or ID",
  hint,
  className,
  inputClassName,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (text: string) => void;
  onPick: (facility: FacilitySuggestion) => void;
  onSubmit?: () => void;
  /** Shown as an ✕ in the box while it has text; defaults to clearing the text. */
  onClear?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  /** A line under the suggestions, e.g. what Enter does. */
  hint?: ReactNode;
  className?: string;
  inputClassName?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = useDebounced(value.trim());
  const { data, isFetching } = api.facilities.suggest.useQuery(
    { q },
    // No placeholder data: a stale list for the previous text could be clicked by mistake.
    { enabled: open && q.length >= 2 },
  );
  // Until the typed text settles, the list would be for older text; hide it.
  const items = q.length >= 2 && q === value.trim() ? (data ?? []) : [];
  const showList = open && items.length > 0;

  const pick = (f: FacilitySuggestion) => {
    setOpen(false);
    setActive(-1);
    setNotice(null);
    onPick(f);
  };

  // A picker's Enter before its list arrives: pick the first match once it does, or say there is none.
  const [pendingEnter, setPendingEnter] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listSettled =
    q.length >= 2 && q === value.trim() && !isFetching && data !== undefined;
  useEffect(() => {
    if (!pendingEnter) return;
    if (items[0]) {
      setPendingEnter(false);
      pick(items[0]);
    } else if (listSettled) {
      setPendingEnter(false);
      setNotice(`No facility matches “${value.trim()}”.`);
    }
  }, [pendingEnter, items, listSettled]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("relative min-w-0", className)}>
      {isLoading || (open && isFetching) ? (
        <Loader2 className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin" />
      ) : (
        <Search className="text-fg-muted pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      )}
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setActive(-1);
          setNotice(null);
          setPendingEnter(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            if (!items.length) return;
            e.preventDefault();
            setOpen(true);
            // -1 is the text itself; the arrows cycle through it and every suggestion.
            const n = items.length;
            setActive((i) =>
              e.key === "ArrowDown"
                ? i + 1 >= n
                  ? -1
                  : i + 1
                : i - 1 < -1
                  ? n - 1
                  : i - 1,
            );
          } else if (e.key === "Enter") {
            const chosen = showList ? items[active] : undefined;
            e.preventDefault();
            if (chosen) pick(chosen);
            else if (onSubmit) {
              setOpen(false);
              onSubmit();
            } else if (value.trim().length < 2) {
              setNotice("Type two or more letters, then pick a facility.");
            } else {
              setOpen(true);
              setPendingEnter(true);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
            setActive(-1);
          }
        }}
        className={cn("h-10 pr-9 pl-9 text-[15px]", inputClassName)}
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onValueChange(""))}
          className="text-fg-muted hover:text-fg absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {notice && !showList && (
        <p
          role="status"
          className="border-edge bg-surface text-warn absolute top-full right-0 left-0 z-40 mt-1 rounded-md border px-3 py-1.5 text-xs shadow-lg"
        >
          {notice}
        </p>
      )}
      {showList && (
        <div className="border-edge bg-surface absolute top-full right-0 left-0 z-40 mt-1 overflow-hidden rounded-md border shadow-lg">
          <ul
            id={listId}
            role="listbox"
            className="max-h-80 overflow-y-auto py-1"
          >
            {items.map((f, i) => (
              <li
                key={f.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Keep focus in the box so the blur doesn't close the list before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(f)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                  i === active && "bg-surface-2",
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getFuelTheme(f.primaryFuel).color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="text-fg block truncate font-medium">
                    {f.name}{" "}
                    <span className="text-fg-muted font-normal tabular-nums">
                      {f.id}
                    </span>
                  </span>
                  <span className="text-fg-muted block truncate text-xs">
                    {[
                      f.county
                        ? `${f.county.replace(/ County$/, " Co.")}, ${f.stateCode}`
                        : f.stateCode,
                      companyLine(f, q),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-fg-muted shrink-0 text-xs tabular-nums">
                  {f.totalCapacityMW
                    ? formatQuantity(f.totalCapacityMW, "MW", { digits: 0 })
                    : ""}
                </span>
              </li>
            ))}
          </ul>
          {(hint ?? !onSubmit) && (
            <p className="border-edge text-fg-muted border-t px-3 py-1.5 text-xs">
              {hint ?? "Enter picks the highlighted facility, or the first."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
