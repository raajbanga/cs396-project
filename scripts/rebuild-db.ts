import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";

import { canImport } from "~/lib/data-import";
import { PYTHON } from "~/lib/python";
import { db } from "~/server/db";
import { importUpload, parseUpload } from "~/server/data-import";

/**
 * Rebuilds the local database from bulk CAMPD files, each imported as an upload:
 * `facility-*.csv` (facility and unit attributes) from `--facility-dir`, then every
 * `emissions-daily-*.csv` in `--csv-dir`, rolled up to unit-year totals by `daily_to_annual.py`.
 * Run `npm run sync:campd` afterwards to layer the API years on top.
 *
 * Usage: npm run db:rebuild -- --facility-dir ../epaData/csv [--csv-dir csv]
 * Expects an empty database (delete db.sqlite first).
 */
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return path.resolve(i >= 0 ? process.argv[i + 1]! : fallback);
};
const facilityDir = arg("facility-dir", "csv");
const csvDir = arg("csv-dir", "csv");

const list = (dir: string, prefix: string) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && f.endsWith(".csv"))
        .sort()
    : [];

async function importFile(file: string, bytes: Buffer) {
  const parsed = await parseUpload(file, bytes);
  if (!canImport(parsed)) {
    console.warn(`Skipping ${file}: nothing importable.`);
    return;
  }
  const result = await importUpload(parsed, file);
  console.log(
    `${file}: ${result.facilities} facilities, ${result.units} units, ${result.annualRecords} unit-years (${result.issues} rejected/duplicate)`,
  );
}

await migrate(db, { migrationsFolder: "drizzle" });

const facilityFiles = list(facilityDir, "facility-");
const dailyFiles = list(csvDir, "emissions-daily-");
console.log(
  `${facilityFiles.length} facility files in ${facilityDir}, ${dailyFiles.length} daily emissions files in ${csvDir}`,
);

try {
  for (const file of facilityFiles) {
    await importFile(file, fs.readFileSync(path.join(facilityDir, file)));
  }
  for (const file of dailyFiles) {
    const annual = execFileSync(
      PYTHON,
      [
        path.join(process.cwd(), "scripts", "daily_to_annual.py"),
        path.join(csvDir, file),
      ],
      { maxBuffer: 1024 ** 3 },
    );
    await importFile(file, annual);
  }
  console.log("Rebuild completed.");
} catch (err) {
  console.error("Rebuild error:", err);
  process.exit(1);
}
