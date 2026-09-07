import { syncCampdAnnualEmissions } from "~/server/campd/client";

async function main() {
  console.log("Syncing full 2022 annual emissions from EPA CAMPD API...");
  const start = Date.now();
  const result = await syncCampdAnnualEmissions({
    year: 2022,
    perPage: 500,
    maxPages: 9, // Will fetch all ~4,131 records
  });

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nCAMPD Ingestion Complete in ${duration}s:`);
  console.log(`- Dataset ID: ${result.datasetId}`);
  console.log(`- Total Records Ingested: ${result.validRecords}`);
  console.log(`- Flagged Records: ${result.flaggedRecords}`);
  console.log(`- Total Anomalies Detected: ${result.anomalies.length}`);
}

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
