"use client";

import { CorrelationChart, ScatterChart } from "./charts";
import type { TabProps } from "./shared";

/** §4.4 scatter and correlation heat map (goal 5: relationships): which variables move together. */
export function RelationshipsTab(props: TabProps) {
  return (
    <div className="space-y-6">
      <ScatterChart {...props} />
      <CorrelationChart {...props} />
    </div>
  );
}
