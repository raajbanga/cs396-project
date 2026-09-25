import { syncCampdAnnualEmissions } from "~/server/campd/client";

const year = new Date().getFullYear() - 1;
console.log(`Syncing ${year} annual emissions from EPA CAMPD API...`);
const start = Date.now();

try {
  const result = await syncCampdAnnualEmissions({ year });
  console.log(
    `\nCAMPD Ingestion Complete in ${((Date.now() - start) / 1000).toFixed(1)}s:`,
  );
  console.log(`- Dataset ID: ${result.datasetId}`);
  console.log(`- Total Records Ingested: ${result.validRecords}`);
  console.log(`- Flagged Records: ${result.flaggedRecords}`);
  console.log(`- Total Anomalies Detected: ${result.anomalyCount}`);
} catch (err) {
  console.error("Sync error:", err);
  process.exit(1);
}
