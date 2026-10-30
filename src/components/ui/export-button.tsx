"use client";

import { createContext, use } from "react";
import { Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  downloadBundle,
  type ExportMetadata,
  type ExportTable,
} from "~/lib/export-bundle";

/** The page's shared metadata, provided by the Analyze and Predict pages, read by their downloads. */
export const ExportContext = createContext<ExportMetadata>({});

/**
 * Downloads `table` as a ZIP with metadata.json (§7): the page's shared metadata plus `meta`,
 * and the chart image when `png` supplies one.
 */
export function ExportButton({
  name,
  title,
  table,
  meta,
  png,
  label = "Download",
  variant = "outline",
}: {
  name: string;
  title: string;
  table: ExportTable;
  meta?: ExportMetadata;
  png?: () => Promise<Uint8Array | undefined>;
  label?: string;
  variant?: "outline" | "ghost";
}) {
  const shared = use(ExportContext);
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={table.rows.length === 0}
      title="Download the data as CSV in a ZIP, with metadata.json describing how it was produced"
      onClick={async () =>
        downloadBundle(
          name,
          table,
          { title, ...shared, ...meta },
          await png?.(),
        )
      }
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
