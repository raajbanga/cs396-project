import { plural, sourceLabel } from "~/lib/utils";
import { type RouterOutputs } from "~/trpc/react";

type Stats = RouterOutputs["facilities"]["getStats"];

/**
 * §9 home page "current data coverage": unit-year records stored per reporting year, as one
 * column per year from zero (values on hover, and as a table for screen readers).
 */
export function DataCoverage({
  coverage = [],
}: Partial<Pick<Stats, "coverage">>) {
  if (coverage.length === 0) {
    return (
      <p className="text-fg-muted text-sm">
        No annual records yet. Retrieve a year from the EPA or upload a file to
        start.
      </p>
    );
  }
  const max = Math.max(...coverage.map((c) => c.records));
  return (
    <figure className="space-y-2">
      <div
        aria-hidden
        className="border-edge flex h-28 items-end gap-0.5 border-b sm:gap-1"
      >
        {coverage.map(({ year, records }) => (
          <div
            key={year}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${year}: ${records.toLocaleString()} unit-years`}
          >
            <span className="text-fg pointer-events-none absolute inset-x-0 -top-0.5 text-center text-xs tabular-nums opacity-0 group-hover:opacity-100">
              {records.toLocaleString()}
            </span>
            <div
              className="bg-fg-2/75 group-hover:bg-primary mx-auto w-full max-w-10 rounded-t-[4px]"
              style={{ height: `${Math.max(2, (records / max) * 80)}%` }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="flex gap-0.5 sm:gap-1">
        {coverage.map(({ year }) => (
          <span
            key={year}
            className="text-fg-muted flex-1 text-center text-xs tabular-nums"
          >
            <span className="sm:hidden">’{String(year).slice(2)}</span>
            <span className="hidden sm:inline">{year}</span>
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Unit-year records stored per reporting year</caption>
        <tbody>
          {coverage.map(({ year, records }) => (
            <tr key={year}>
              <th scope="row">{year}</th>
              <td>{records}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** §9 home page "data sources": each source's active datasets and when it last wrote. */
export function DataSources({ sources = [] }: Partial<Pick<Stats, "sources">>) {
  return (
    <ul className="divide-edge/70 border-edge divide-y border-y text-sm">
      {sources.map(({ source, datasets, superseded, lastImportedAt }) => (
        <li
          key={source}
          className="flex flex-wrap items-baseline justify-between gap-x-4 py-2"
        >
          <span className="text-fg">{sourceLabel(source)}</span>
          <span className="text-fg-muted">
            {plural(datasets, "active dataset")}
            {superseded > 0 && ` and ${superseded} superseded`}, last import{" "}
            {new Date(lastImportedAt).toLocaleDateString()}
          </span>
        </li>
      ))}
      {!sources.some((s) => s.source !== "API") && (
        <li className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
          <span className="text-fg">CSV and Excel uploads</span>
          <span className="text-fg-muted">none imported yet</span>
        </li>
      )}
      <li className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
        <span className="text-fg">EPA TRACI impact factors</span>
        <span className="text-fg-muted">Phase 2</span>
      </li>
    </ul>
  );
}
