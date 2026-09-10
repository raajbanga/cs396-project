import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "~/server/db/schema";
import { facilities, units } from "~/server/db/schema";
import { resolveDatabaseUrl } from "~/server/db/url";

function createSeedDb() {
  return drizzle(
    createClient({
      url: resolveDatabaseUrl(process.env.DATABASE_URL ?? "file:./db.sqlite"),
      authToken: process.env.DATABASE_AUTH_TOKEN,
    }),
    { schema },
  );
}

const DEFAULT_CSV_DIR = "../CAMPD DATA";

function parseArgs(): { csvDir: string } {
  const csvDirIdx = process.argv.indexOf("--csv-dir");
  const csvDir =
    csvDirIdx >= 0 && process.argv[csvDirIdx + 1]
      ? process.argv[csvDirIdx + 1]!
      : DEFAULT_CSV_DIR;
  return { csvDir: path.resolve(process.cwd(), csvDir) };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function readCsvFile(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function cleanStr(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  return cleaned || null;
}

function parseFloatVal(value: string | undefined): number | null {
  const cleaned = cleanStr(value);
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

function parseIntVal(value: string | undefined): number | null {
  const cleaned = cleanStr(value);
  if (!cleaned) return null;
  const num = Number.parseInt(cleaned, 10);
  return Number.isNaN(num) ? null : num;
}

function parseMw(value: string | undefined): number | null {
  if (!value) return null;
  const matches = [...value.matchAll(/\(([\d.]+)\)/g)];
  if (matches.length === 0) return null;
  const sum = matches.reduce(
    (acc, match) => acc + Number.parseFloat(match[1]!),
    0,
  );
  return Number.isNaN(sum) ? null : Math.round(sum * 100) / 100;
}

interface FacilitySeed {
  id: number;
  name: string;
  stateCode: string;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  epaRegion: number | null;
  nercRegion: string | null;
  sourceCategory: string | null;
  ownerOperator: string | null;
}

interface UnitSeed {
  id: string;
  unitId: string;
  facilityId: number;
  unitType: string | null;
  primaryFuel: string | null;
  secondaryFuel: string | null;
  operatingStatus: string | null;
  commercialOpDate: string | null;
  maxHourlyHIRate: number | null;
  nameplateCapacityMW: number | null;
  so2Controls: string | null;
  noxControls: string | null;
  pmControls: string | null;
  hgControls: string | null;
  programCode: string | null;
}

function mergeFacility(existing: FacilitySeed, incoming: FacilitySeed) {
  if (!existing.county && incoming.county) existing.county = incoming.county;
  if (existing.latitude === null && incoming.latitude !== null) {
    existing.latitude = incoming.latitude;
  }
  if (existing.longitude === null && incoming.longitude !== null) {
    existing.longitude = incoming.longitude;
  }
  if (existing.epaRegion === null && incoming.epaRegion !== null) {
    existing.epaRegion = incoming.epaRegion;
  }
  if (!existing.nercRegion && incoming.nercRegion) {
    existing.nercRegion = incoming.nercRegion;
  }
  if (!existing.sourceCategory && incoming.sourceCategory) {
    existing.sourceCategory = incoming.sourceCategory;
  }
  if (!existing.ownerOperator && incoming.ownerOperator) {
    existing.ownerOperator = incoming.ownerOperator;
  }
}

function mergeUnit(existing: UnitSeed, incoming: UnitSeed) {
  if (!existing.unitType && incoming.unitType)
    existing.unitType = incoming.unitType;
  if (!existing.primaryFuel && incoming.primaryFuel) {
    existing.primaryFuel = incoming.primaryFuel;
  }
  if (!existing.secondaryFuel && incoming.secondaryFuel) {
    existing.secondaryFuel = incoming.secondaryFuel;
  }
  if (!existing.operatingStatus && incoming.operatingStatus) {
    existing.operatingStatus = incoming.operatingStatus;
  }
  if (!existing.commercialOpDate && incoming.commercialOpDate) {
    existing.commercialOpDate = incoming.commercialOpDate;
  }
  if (existing.maxHourlyHIRate === null && incoming.maxHourlyHIRate !== null) {
    existing.maxHourlyHIRate = incoming.maxHourlyHIRate;
  }
  if (
    existing.nameplateCapacityMW === null &&
    incoming.nameplateCapacityMW !== null
  ) {
    existing.nameplateCapacityMW = incoming.nameplateCapacityMW;
  }
  if (!existing.so2Controls && incoming.so2Controls) {
    existing.so2Controls = incoming.so2Controls;
  }
  if (!existing.noxControls && incoming.noxControls) {
    existing.noxControls = incoming.noxControls;
  }
  if (!existing.pmControls && incoming.pmControls) {
    existing.pmControls = incoming.pmControls;
  }
  if (!existing.hgControls && incoming.hgControls) {
    existing.hgControls = incoming.hgControls;
  }
  if (!existing.programCode && incoming.programCode) {
    existing.programCode = incoming.programCode;
  }
}

async function main() {
  const db = createSeedDb();
  const { csvDir } = parseArgs();

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
    .sort()
    .map((name) => path.join(csvDir, name));

  console.log(`Found ${csvFiles.length} CSV files in ${csvDir}`);

  const facilitiesMap = new Map<number, FacilitySeed>();
  const unitsMap = new Map<string, UnitSeed>();

  for (const csvPath of csvFiles) {
    console.log(`Processing ${path.basename(csvPath)}...`);
    const rows = readCsvFile(csvPath);

    for (const row of rows) {
      const stateCode = cleanStr(row.State);
      const facilityName = cleanStr(row["Facility Name"]);
      const facilityIdRaw = cleanStr(row["Facility ID"]);
      const unitId = cleanStr(row["Unit ID"]);

      if (
        !stateCode ||
        !facilityIdRaw ||
        !unitId ||
        facilityIdRaw === "Facility ID"
      ) {
        continue;
      }

      const facilityId = Number.parseInt(facilityIdRaw, 10);
      if (Number.isNaN(facilityId)) continue;

      const incomingFacility: FacilitySeed = {
        id: facilityId,
        name: facilityName ?? `Facility #${facilityId}`,
        stateCode: stateCode.toUpperCase().slice(0, 2),
        county: cleanStr(row.County),
        latitude: parseFloatVal(row.Latitude),
        longitude: parseFloatVal(row.Longitude),
        epaRegion: parseIntVal(row["EPA Region"]),
        nercRegion: cleanStr(row["NERC Region"]),
        sourceCategory: cleanStr(row["Source Category"]),
        ownerOperator: cleanStr(row["Owner/Operator"]),
      };

      const existingFacility = facilitiesMap.get(facilityId);
      if (existingFacility) {
        mergeFacility(existingFacility, incomingFacility);
      } else {
        facilitiesMap.set(facilityId, incomingFacility);
      }

      const unitKey = `${facilityId}:${unitId}`;
      const incomingUnit: UnitSeed = {
        id: crypto.randomUUID(),
        unitId,
        facilityId,
        unitType: cleanStr(row["Unit Type"]),
        primaryFuel: cleanStr(row["Primary Fuel Type"]),
        secondaryFuel: cleanStr(row["Secondary Fuel Type"]),
        operatingStatus: cleanStr(row["Operating Status"]),
        commercialOpDate: cleanStr(row["Commercial Operation Date"]),
        maxHourlyHIRate: parseFloatVal(row["Max Hourly HI Rate (mmBtu/hr)"]),
        nameplateCapacityMW: parseMw(
          row["Associated Generators & Nameplate Capacity (MWe)"],
        ),
        so2Controls: cleanStr(row["SO2 Controls"]),
        noxControls: cleanStr(row["NOx Controls"]),
        pmControls: cleanStr(row["PM Controls"]),
        hgControls: cleanStr(row["Hg Controls"]),
        programCode: cleanStr(row["Program Code"]),
      };

      const existingUnit = unitsMap.get(unitKey);
      if (existingUnit) {
        mergeUnit(existingUnit, incomingUnit);
      } else {
        unitsMap.set(unitKey, incomingUnit);
      }
    }
  }

  console.log(`Total unique facilities: ${facilitiesMap.size}`);
  console.log(`Total unique units: ${unitsMap.size}`);

  console.log("Upserting facilities...");
  for (const facility of facilitiesMap.values()) {
    await db
      .insert(facilities)
      .values(facility)
      .onConflictDoUpdate({
        target: facilities.id,
        set: {
          name: facility.name,
          stateCode: facility.stateCode,
          county: facility.county,
          latitude: facility.latitude,
          longitude: facility.longitude,
          epaRegion: facility.epaRegion,
          nercRegion: facility.nercRegion,
          sourceCategory: facility.sourceCategory,
          ownerOperator: facility.ownerOperator,
        },
      });
  }

  console.log("Upserting units...");
  const unitRows = Array.from(unitsMap.values());
  for (let i = 0; i < unitRows.length; i += 50) {
    await db
      .insert(units)
      .values(unitRows.slice(i, i + 50))
      .onConflictDoUpdate({
        target: [units.facilityId, units.unitId],
        set: {
          unitType: sql`COALESCE(excluded.unit_type, ${units.unitType})`,
          primaryFuel: sql`COALESCE(excluded.primary_fuel, ${units.primaryFuel})`,
          secondaryFuel: sql`COALESCE(excluded.secondary_fuel, ${units.secondaryFuel})`,
          operatingStatus: sql`COALESCE(excluded.operating_status, ${units.operatingStatus})`,
          commercialOpDate: sql`COALESCE(excluded.commercial_op_date, ${units.commercialOpDate})`,
          maxHourlyHIRate: sql`COALESCE(excluded.max_hourly_hi_rate, ${units.maxHourlyHIRate})`,
          nameplateCapacityMW: sql`COALESCE(excluded.nameplate_capacity_mw, ${units.nameplateCapacityMW})`,
          so2Controls: sql`COALESCE(excluded.so2_controls, ${units.so2Controls})`,
          noxControls: sql`COALESCE(excluded.nox_controls, ${units.noxControls})`,
          pmControls: sql`COALESCE(excluded.pm_controls, ${units.pmControls})`,
          hgControls: sql`COALESCE(excluded.hg_controls, ${units.hgControls})`,
          programCode: sql`COALESCE(excluded.program_code, ${units.programCode})`,
        },
      });
  }

  console.log("Seed completed successfully.");
}

main().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
