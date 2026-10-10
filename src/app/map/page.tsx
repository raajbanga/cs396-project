import { type Metadata } from "next";
import { MapPage } from "~/app/_components/facilities-map";
import { parseExplorerParams } from "~/lib/facility-filters";
import { api, HydrateClient } from "~/trpc/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Map" };

export default async function Map({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initialState = parseExplorerParams(await searchParams);
  await api.facilities.getMapFacilities.prefetch(initialState.filters);
  return (
    <HydrateClient>
      <MapPage initialState={initialState} />
    </HydrateClient>
  );
}
