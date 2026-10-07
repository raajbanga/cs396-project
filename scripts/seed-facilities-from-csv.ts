import fs from "node:fs";
import path from "node:path";

import { canImport } from "~/lib/data-import";
import { importUpload, parseUpload } from "~/server/data-import";

/** Imports every `facility-*.csv` in `--csv-dir` through the same pipeline as file uploads. */
const csvDirIdx = process.argv.indexOf("--csv-dir");
const csvDir = path.resolve(
  process.cwd(),
  (csvDirIdx >= 0 ? process.argv[csvDirIdx + 1] : undefined) ?? "../CAMPD DATA",
);

if (!fs.existsSync(csvDir)) {
  console.error(`CSV directory not found: ${csvDir}`);
  console.error('Usage: npm run db:seed -- --csv-dir "../CAMPD DATA"');
  process.exit(1);
}

const csvFiles = fs
  .readdirSync(csvDir)
  .filter((name) => name.startsWith("facility-") && name.endsWith(".csv"))
  .sort();
console.log(`Found ${csvFiles.length} CSV files in ${csvDir}`);

try {
  for (const file of csvFiles) {
    const parsed = await parseUpload(
      file,
      fs.readFileSync(path.join(csvDir, file)),
    );
    const { validCount, invalidCount } = parsed.summary;
    if (!canImport(parsed)) {
      console.warn(`Skipping ${file}: no importable facility/unit rows.`);
      continue;
    }
    const result = await importUpload(parsed, file);
    console.log(
      `${file}: ${result.facilities} facilities, ${result.units} units (${validCount} rows imported, ${invalidCount} rejected)`,
    );
  }
  console.log("Seed completed successfully.");
} catch (err) {
  console.error("Seed error:", err);
  process.exit(1);
}
