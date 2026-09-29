import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse, type NextRequest } from "next/server";
import { type PythonValidationReport } from "~/lib/data-import-types";

const execFileAsync = promisify(execFile);

const ALLOWED_EXTENSIONS = new Set([".csv", ".tsv", ".xlsx", ".xlsm"]);
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided in request." },
        { status: 400 },
      );
    }

    const originalName = file.name ? file.name : "uploaded_file";
    const ext = path.extname(originalName).toLowerCase();

    // 1. Validate file extension
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: `Invalid file extension (${ext ? ext : "none"}). Only CSV and Excel (.xlsx) files are supported.`,
        },
        { status: 400 },
      );
    }

    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds the 100MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty (0 bytes)." },
        { status: 400 },
      );
    }

    const uploadsDir = path.resolve(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const stagedId = crypto.randomUUID();
    const stagedFileName = `staged_${stagedId}${ext}`;
    const stagedFilePath = path.join(uploadsDir, stagedFileName);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(stagedFilePath, Buffer.from(arrayBuffer));

    const scriptPath = path.resolve(process.cwd(), "scripts", "parse_import.py");
    const dbPath = path.resolve(process.cwd(), "db.sqlite");

    // 3. Read file using Python parser
    try {
      const { stdout } = await execFileAsync(
        "python3",
        [scriptPath, stagedFilePath, "--db", dbPath, "--limit", "100"],
        { maxBuffer: 50 * 1024 * 1024 },
      );

      const report = JSON.parse(stdout) as PythonValidationReport;
      if (report.error) {
        return NextResponse.json(
          { error: `Python parser failed: ${report.error}` },
          { status: 400 },
        );
      }

      return NextResponse.json({
        stagedId,
        fileName: originalName,
        fileExtension: ext.replace(".", ""),
        fileSize: file.size,
        report,
      });
    } catch (parseError) {
      // Clean up staged file if parsing immediately crashed
      await fs.unlink(stagedFilePath).catch(() => null);
      const errMsg =
        parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json(
        { error: `Failed to parse file: ${errMsg}` },
        { status: 500 },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
