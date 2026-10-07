import { syncCampdAnnualEmissions } from "~/server/campd/client";

/** Usage: npm run sync:campd [-- --year 2024 | -- --from 2015 --to 2025]; defaults to last year. */
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? Number(process.argv[i + 1]) : undefined;
  if (value !== undefined && !Number.isInteger(value)) {
    console.error(`--${name} needs a year, e.g. --${name} 2024`);
    process.exit(1);
  }
  return value;
};

const lastYear = new Date().getFullYear() - 1;
const single = arg("year");
const from = arg("from") ?? single ?? lastYear;
const to = arg("to") ?? single ?? lastYear;
if (from > to) {
  console.error(`--from ${from} is after --to ${to}.`);
  process.exit(1);
}

try {
  for (let y = from; y <= to; y++) {
    console.log(`Syncing ${y} annual emissions from EPA CAMPD API...`);
    const start = Date.now();
    const result = await syncCampdAnnualEmissions({ year: y });
    console.log(
      `\nCAMPD Ingestion Complete in ${((Date.now() - start) / 1000).toFixed(1)}s:`,
    );
    console.log(`- Dataset ID: ${result.datasetId}`);
    console.log(`- Total Records Ingested: ${result.validRecords}`);
    console.log(`- Flagged Records: ${result.flaggedRecords}`);
    console.log(`- Total Anomalies Detected: ${result.anomalyCount}`);
  }
} catch (err) {
  console.error("Sync error:", err);
  process.exit(1);
}
