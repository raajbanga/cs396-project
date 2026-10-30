import { buildExport, ExportError } from "~/server/export";

/** §10 CSV download: `?type=dataset|valid|invalid|search|selection|provenance` plus that type's params; `analysis` returns a ZIP (Phase 2 §7). */
export async function GET(req: Request) {
  try {
    const result = await buildExport(new URL(req.url).searchParams);
    const { filename } = result;
    const zip = "zip" in result ? result.zip : undefined;
    return new Response(zip ? (zip as BodyInit) : result.csv, {
      headers: {
        "Content-Type": zip ? "application/zip" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ExportError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Export failed." },
      { status: 500 },
    );
  }
}
