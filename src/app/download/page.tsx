import { type Metadata } from "next";
import { DownloadView } from "~/app/_components/download-view";
import { parseExplorerParams } from "~/lib/facility-filters";

export const metadata: Metadata = { title: "Download" };

export default async function DownloadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <DownloadView initialState={parseExplorerParams(await searchParams)} />
  );
}
