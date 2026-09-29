import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse, type NextRequest } from "next/server";
import { type PythonCommitResult } from "~/lib/data-import-types";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      stagedId?: string;
      fileName?: string;
      fileExtension?: string;
    };

    const { stagedId, fileName, fileExtension } = body;

    if (!stagedId) {
      return NextResponse.json(
        { error: "Missing stagedId parameter." },
        { status: 400 },
      );
    }

    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const ext = fileExtension ? `.${fileExtension}` : "";
    const stagedFilePath = path.join(uploadsDir, `staged_${stagedId}${ext}`);

    try {
      await fs.access(stagedFilePath);
    } catch {
      return NextResponse.json(
        { error: "Staged file not found or already processed." },
        { status: 404 },
      );
    }

    const scriptPath = path.resolve(process.cwd(), "scripts", "parse_import.py");
    const dbPath = path.resolve(process.cwd(), "db.sqlite");
    const rawName = fileName ?? "dataset";
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const datasetLabel = `Upload: ${fileName ?? "Imported Dataset"}`;

    // Execute Python database commit
    const { stdout } = await execFileAsync(
      "python3",
      [
        scriptPath,
        stagedFilePath,
        "--db",
        dbPath,
        "--commit",
        "--dataset-name",
        datasetLabel,
      ],
      { maxBuffer: 50 * 1024 * 1024 },
    );

    const result = JSON.parse(stdout) as PythonCommitResult;
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to commit data to database." },
        { status: 500 },
      );
    }

    // Preserve original file permanently (Step 11 requirement)
    const datasetId = result.datasetId;
    const preservedFileName = `${datasetId}_${safeName}`;
    const preservedFilePath = path.join(uploadsDir, preservedFileName);

    await fs.copyFile(stagedFilePath, preservedFilePath);
    await fs.unlink(stagedFilePath).catch(() => null);

    return NextResponse.json({
      success: true,
      datasetId,
      preservedFilePath: `uploads/${preservedFileName}`,
      result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to commit import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
