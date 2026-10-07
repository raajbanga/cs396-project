import { canImport, checkUploadFile } from "~/lib/data-import";
import { importUpload, parseUpload, previewUpload } from "~/server/data-import";

/** Multipart `file` → validation report; with `commit=true`, stores the approved records instead. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }
    const invalid = checkUploadFile(file);
    if (invalid) return Response.json({ error: invalid }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseUpload(file.name, bytes);
    if (form.get("commit") !== "true") {
      return Response.json(await previewUpload(parsed));
    }
    if (!canImport(parsed)) {
      return Response.json(
        { error: "The file has no records that can be imported." },
        { status: 400 },
      );
    }
    return Response.json(await importUpload(parsed, file.name, bytes));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}
