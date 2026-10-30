import { readFileSync } from "node:fs";
import { db } from "~/server/db";
import { traciFactors } from "~/server/db/schema";

/** Loads data/traci/traci_2_2_air.csv into traci_factors, replacing what the table held. */
const [header, ...lines] = readFileSync("data/traci/traci_2_2_air.csv", "utf8")
  .trim()
  .split(/\r?\n/)
  .map((line) => line.split(","));
const rows = lines.map((cells) => {
  const r = Object.fromEntries(header!.map((h, i) => [h, cells[i]!]));
  return {
    traciVersion: r.traci_version!,
    pollutant: r.pollutant!,
    substance: r.substance!,
    cas: r.cas!,
    medium: r.medium!,
    impactCategory: r.impact_category!,
    factor: Number(r.factor),
    factorUnit: r.factor_unit!,
    source: r.source!,
  };
});

await db.transaction(async (tx) => {
  await tx.delete(traciFactors);
  await tx.insert(traciFactors).values(rows);
});
console.log(`Imported ${rows.length} TRACI factors.`);
