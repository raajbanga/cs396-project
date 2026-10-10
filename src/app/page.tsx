import { DatabaseExplorer } from "~/app/_components/database-explorer";
import { parseExplorerParams } from "~/lib/facility-filters";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // §8.4: the explorer's tab, filters, sort, and page come from the URL (see explorerSearchParams).
  const initialState = parseExplorerParams(await searchParams);
  const { tab, filters, table, unitTable, auditTable } = initialState;

  await Promise.all([
    api.facilities.getStats.prefetch(),
    api.facilities.getFilterOptions.prefetch(),
    tab === "explorer" &&
      api.facilities.getFacilities.prefetch({ ...table, ...filters }),
    tab === "units" &&
      api.facilities.getUnitYears.prefetch({ ...unitTable, ...filters }),
    tab === "map" && api.facilities.getMapFacilities.prefetch(filters),
    tab === "audit" &&
      api.facilities.getAuditLogs.prefetch({ ...auditTable, ...filters }),
  ]);

  return (
    <HydrateClient>
      <DatabaseExplorer initialState={initialState} />
    </HydrateClient>
  );
}
