import { DatabaseExplorer } from "~/app/_components/database-explorer";
import { DEFAULT_FILTERS, DEFAULT_TABLE_STATE } from "~/lib/facility-filters";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  await Promise.all([
    api.facilities.getStats.prefetch(),
    api.facilities.getFilterOptions.prefetch(),
    api.facilities.getFacilities.prefetch({
      ...DEFAULT_TABLE_STATE,
      ...DEFAULT_FILTERS,
    }),
    api.facilities.getMapFacilities.prefetch(DEFAULT_FILTERS),
  ]);

  return (
    <HydrateClient>
      <DatabaseExplorer />
    </HydrateClient>
  );
}
