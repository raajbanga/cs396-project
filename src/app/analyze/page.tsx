import { type Metadata } from "next";
import { AnalyzeView } from "~/app/_components/analyze/analyze-view";
import { parseAnalysisParams } from "~/lib/analysis-state";
import { api, HydrateClient } from "~/trpc/server";

export const metadata: Metadata = { title: "Analyze" };

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = parseAnalysisParams(await searchParams);
  await Promise.all([
    api.analysis.catalog.prefetch(),
    api.facilities.getFilterOptions.prefetch(),
    api.analysis.summary.prefetch({ filters: initial.filters }),
  ]);
  return (
    <HydrateClient>
      <AnalyzeView initial={initial} />
    </HydrateClient>
  );
}
