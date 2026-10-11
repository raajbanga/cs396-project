import { type Metadata } from "next";
import { Explorer } from "~/app/_components/explorer";
import { parseExplorerParams } from "~/lib/facility-filters";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // §8.4: the tab, filters, sort, and page come from the URL (see explorerSearchParams).
  const initialState = parseExplorerParams(await searchParams);
  const { tab, filters, table, unitTable, auditTable } = initialState;

  await Promise.all([
    api.facilities.getStats.prefetch(),
    api.facilities.getFilterOptions.prefetch(),
    tab === "explorer" &&
      api.facilities.getFacilities.prefetch({ ...table, ...filters }),
    tab === "units" &&
      api.facilities.getUnitYears.prefetch({ ...unitTable, ...filters }),
    tab === "audit" &&
      api.facilities.getAuditLogs.prefetch({ ...auditTable, ...filters }),
  ]);

  return (
    <HydrateClient>
      <Explorer initialState={initialState} />
    </HydrateClient>
  );
}
