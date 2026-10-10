import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { DataCoverage, DataSources } from "~/app/_components/data-coverage";
import { EpaPrimer } from "~/app/_components/epa-primer";
import { Section } from "~/components/ui/report";
import { formatNumber } from "~/lib/utils";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

/** The §9 functions, in the order data moves through the app. */
const FUNCTIONS = [
  {
    href: "/retrieve",
    label: "Retrieve from the EPA",
    body: "Pull annual emissions from the CAMPD API by year, state, facility, fuel, unit type, or control technology. Preview against the database, then approve.",
  },
  {
    href: "/upload",
    label: "Upload a file",
    body: "Import a CSV or Excel file. Every row is validated, and you approve the import after reading the report.",
  },
  {
    href: "/explore",
    label: "Explore and search",
    body: "Search by description, name, or any field, with ranges and Top-N rankings. Click any result for its full details.",
  },
  {
    href: "/map",
    label: "Map",
    body: "The same facilities on a globe or a flat map, colored by fuel.",
  },
  {
    href: "/download",
    label: "Download",
    body: "Export datasets, search results, a selection, data-quality reports, or provenance as CSV.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Explorer links from before the pages split (/?tab=units&…) still work.
  const params = await searchParams;
  if (Object.keys(params).length > 0) {
    const query = new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) =>
        (Array.isArray(v) ? v : [v ?? ""]).map((x) => [k, x]),
      ),
    );
    redirect(`/explore?${query}`);
  }

  const stats = await api.facilities.getStats();
  const unitYears = stats.coverage.reduce((n, c) => n + c.records, 0);
  const years = stats.coverage.map((c) => c.year);
  const figures = [
    [formatNumber(stats.totalFacilities), "facilities"],
    [formatNumber(stats.totalUnits), "generating units"],
    [formatNumber(unitYears), "unit-years"],
    [`${formatNumber(stats.totalCapacityMW / 1000, 1)} GW`, "capacity"],
    [formatNumber(stats.totalAnomalies), "data-quality flags"],
  ];

  return (
    <div className="space-y-14">
      <header className="max-w-4xl space-y-4">
        <h1 className="text-fg text-3xl font-semibold tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.1]">
          EPA power-sector emissions data
        </h1>
        <p className="text-fg-2 max-w-[68ch] text-base">
          epaData collects annual operating and emissions data for U.S.
          power-plant units from the EPA Clean Air Markets Program (CAMPD) and
          from validated CSV and Excel uploads, stores it in a local SQLite
          database, and lets you search, compare, and download it. TRACI impact
          factors and scoring follow in Phase 2.
        </p>
        <dl className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
          {figures.map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="text-fg text-xl font-semibold tabular-nums">
                {value}
              </dd>
              <dd aria-hidden className="text-fg-muted text-xs">
                {label}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-2">
        <Section title="What you can do">
          <ul className="divide-edge/70 border-edge divide-y border-y">
            {FUNCTIONS.map(({ href, label, body }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group hover:bg-surface -mx-2 flex items-center gap-4 rounded-sm px-2 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-fg group-hover:text-primary block font-medium">
                      {label}
                    </span>
                    <span className="text-fg-muted block text-sm">{body}</span>
                  </span>
                  <ChevronRight className="text-fg-muted h-4 w-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <div className="space-y-12">
          <Section
            title="Current coverage"
            note={
              years.length
                ? `Unit-year records stored for each reporting year, ${years[0]}–${years.at(-1)}. Hover a column for its count.`
                : undefined
            }
          >
            <DataCoverage coverage={stats.coverage} />
          </Section>

          <Section
            title="Data sources"
            note="Explore, Map, the facility and unit details, and downloads read only the local database. Retrieve and the hourly and daily view call the EPA API live."
          >
            <DataSources sources={stats.sources} />
          </Section>
        </div>
      </div>

      <EpaPrimer />
    </div>
  );
}
