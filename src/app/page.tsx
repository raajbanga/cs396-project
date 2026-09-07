import { DatabaseExplorer } from "~/app/_components/database-explorer";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Prefetch initial data on the server
  void api.facilities.getStats.prefetch();
  void api.facilities.getFilterOptions.prefetch();
  void api.facilities.getFacilities.prefetch({
    page: 1,
    pageSize: 10,
    search: "",
    stateCode: "ALL",
    primaryFuel: "ALL",
    nercRegion: "ALL",
    sourceCategory: "ALL",
  });
  void api.facilities.getMapFacilities.prefetch({});

  return (
    <HydrateClient>
      <DatabaseExplorer />
    </HydrateClient>
  );
}
