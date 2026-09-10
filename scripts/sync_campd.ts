import { syncCampdAnnualEmissions } from "~/server/campd/client";

async function main() {
  const year = new Date().getFullYear() - 1;
  console.log(`Syncing ${year} annual emissions from EPA CAMPD API...`);
  const start = Date.now();
  const result = await syncCampdAnnualEmissions({
    year,
    perPage: 500,
    maxPages: 10,
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
