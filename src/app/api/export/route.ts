import { buildExport, ExportError } from "~/server/export";

/** §10 CSV download: `?type=dataset|valid|invalid|search|selection|provenance` plus that type's params. */
export async function GET(req: Request) {
  try {
    const { filename, csv } = await buildExport(new URL(req.url).searchParams);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
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
