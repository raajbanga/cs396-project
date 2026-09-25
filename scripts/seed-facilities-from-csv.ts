import fs from "node:fs";
import path from "node:path";
import { getTableColumns, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { facilities, units } from "~/server/db/schema";

type FacilitySeed = typeof facilities.$inferInsert;
type UnitSeed = typeof units.$inferInsert;

const csvDirIdx = process.argv.indexOf("--csv-dir");
const csvDir = path.resolve(
  process.cwd(),
  (csvDirIdx >= 0 ? process.argv[csvDirIdx + 1] : undefined) ?? "../CAMPD DATA",
);

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else current += char;
  }
  values.push(current);
  return values;
}

function readCsvFile(filePath: string): Record<string, string>[] {
  const [header, ...lines] = fs
    .readFileSync(filePath, "utf-8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (!header) return [];
  const headers = parseCsvLine(header);
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

function cleanStr(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? null : trimmed;
}

function parseNumber(value: string | undefined): number | null {
  const num = Number.parseFloat(cleanStr(value) ?? "");
  return Number.isNaN(num) ? null : num;
}

/** Sums every "(123.4)" nameplate rating in EPA's associated-generators column. */
function parseMw(value: string | undefined): number | null {
  const matches = [...(value ?? "").matchAll(/\(([\d.]+)\)/g)];
  if (matches.length === 0) return null;
  const sum = matches.reduce((acc, m) => acc + Number.parseFloat(m[1]!), 0);
  return Number.isNaN(sum) ? null : Math.round(sum * 100) / 100;
}

/** Fills fields missing on `existing` from `incoming` (first non-empty value wins). */
function mergeMissing<T extends object>(existing: T, incoming: T) {
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    if (existing[key] == null || existing[key] === "")
      existing[key] = incoming[key];
  }
}

function upsertInto<T extends object>(
  map: Map<string | number, T>,
  key: string | number,
  value: T,
) {
  const existing = map.get(key);
  if (existing) mergeMissing(existing, value);
  else map.set(key, value);
}

if (!fs.existsSync(csvDir)) {
  console.error(`CSV directory not found: ${csvDir}`);
  console.error(
    'Usage: npx tsx scripts/seed-facilities-from-csv.ts --csv-dir "../CAMPD DATA"',
  );
  process.exit(1);
}

const csvFiles = fs
  .readdirSync(csvDir)
  .filter((name) => name.startsWith("facility-") && name.endsWith(".csv"))
  .sort();
console.log(`Found ${csvFiles.length} CSV files in ${csvDir}`);

const facilitiesMap = new Map<string | number, FacilitySeed>();
const unitsMap = new Map<string | number, UnitSeed>();

for (const file of csvFiles) {
  console.log(`Processing ${file}...`);
  for (const row of readCsvFile(path.join(csvDir, file))) {
    const stateCode = cleanStr(row.State);
    const unitId = cleanStr(row["Unit ID"]);
    const facilityId = Number.parseInt(cleanStr(row["Facility ID"]) ?? "", 10);
    if (!stateCode || !unitId || Number.isNaN(facilityId)) continue;

    upsertInto(facilitiesMap, facilityId, {
      id: facilityId,
      name: cleanStr(row["Facility Name"]) ?? `Facility #${facilityId}`,
      stateCode: stateCode.toUpperCase().slice(0, 2),
      county: cleanStr(row.County),
      latitude: parseNumber(row.Latitude),
      longitude: parseNumber(row.Longitude),
      epaRegion: parseNumber(row["EPA Region"]),
      nercRegion: cleanStr(row["NERC Region"]),
      sourceCategory: cleanStr(row["Source Category"]),
      ownerOperator: cleanStr(row["Owner/Operator"]),
    });

    upsertInto(unitsMap, `${facilityId}:${unitId}`, {
      id: crypto.randomUUID(),
      unitId,
      facilityId,
      unitType: cleanStr(row["Unit Type"]),
      primaryFuel: cleanStr(row["Primary Fuel Type"]),
      secondaryFuel: cleanStr(row["Secondary Fuel Type"]),
      operatingStatus: cleanStr(row["Operating Status"]),
      commercialOpDate: cleanStr(row["Commercial Operation Date"]),
      maxHourlyHIRate: parseNumber(row["Max Hourly HI Rate (mmBtu/hr)"]),
      nameplateCapacityMW: parseMw(
        row["Associated Generators & Nameplate Capacity (MWe)"],
      ),
      so2Controls: cleanStr(row["SO2 Controls"]),
      noxControls: cleanStr(row["NOx Controls"]),
      pmControls: cleanStr(row["PM Controls"]),
      hgControls: cleanStr(row["Hg Controls"]),
      programCode: cleanStr(row["Program Code"]),
    });
  }
}

console.log(`Total unique facilities: ${facilitiesMap.size}`);
console.log(`Total unique units: ${unitsMap.size}`);

/** `excluded.col` (incoming wins) or `COALESCE(excluded.col, col)` (keep existing when incoming is null). */
const excludedSet = (
  table: typeof facilities | typeof units,
  columns: string[],
  keepExisting: boolean,
) =>
  Object.fromEntries(
    columns.map((key) => {
      const { name } = (
        getTableColumns(table) as Record<string, { name: string }>
      )[key]!;
      return [
        key,
        sql.raw(
          keepExisting
            ? `COALESCE(excluded.${name}, ${name})`
            : `excluded.${name}`,
        ),
      ];
    }),
  );

const MUTABLE_FACILITY_COLUMNS = [
  "name",
  "stateCode",
  "county",
  "latitude",
  "longitude",
  "epaRegion",
  "nercRegion",
  "sourceCategory",
  "ownerOperator",
];
const MUTABLE_UNIT_COLUMNS = [
  "unitType",
  "primaryFuel",
  "secondaryFuel",
  "operatingStatus",
  "commercialOpDate",
  "maxHourlyHIRate",
  "nameplateCapacityMW",
  "so2Controls",
  "noxControls",
  "pmControls",
  "hgControls",
  "programCode",
];

try {
  console.log("Upserting facilities...");
  const facilityRows = [...facilitiesMap.values()];
  for (let i = 0; i < facilityRows.length; i += 50) {
    await db
      .insert(facilities)
      .values(facilityRows.slice(i, i + 50))
      .onConflictDoUpdate({
        target: facilities.id,
        set: excludedSet(facilities, MUTABLE_FACILITY_COLUMNS, false),
      });
  }

  console.log("Upserting units...");
  const unitRows = [...unitsMap.values()];
  for (let i = 0; i < unitRows.length; i += 50) {
    await db
      .insert(units)
      .values(unitRows.slice(i, i + 50))
      .onConflictDoUpdate({
        target: [units.facilityId, units.unitId],
        set: excludedSet(units, MUTABLE_UNIT_COLUMNS, true),
      });
  }
  console.log("Seed completed successfully.");
} catch (err) {
  console.error("Seed error:", err);
  process.exit(1);
}
