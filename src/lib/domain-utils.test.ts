import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildDateOptionsForYear,
  clampCampdDateRange,
  clampDateToYear,
  clampIsoDateToCampdPublished,
  getCampdValidMonthsForYear,
  getDefaultCampdDateForYear,
  parseCampdQuarterEndFromError,
  toIsoDate,
} from "./campd-reporting-period";
import { type PythonValidationReport } from "./data-import-types";
import {
  buildYearlyRollups,
  computeCo2IntensityLbsMWh,
  computeHeatRateMMBtuMWh,
  pickCleanestByCarbonIntensity,
} from "./emissions-metrics";
import { FUEL_CATEGORIES, getFuelTheme, getMarkerRadius } from "./map-utils";
import {
  cleanOwnerOperator,
  getCarbonIntensityTier,
  hasAirQualityControls,
  isOperatingStatus,
} from "./plant-narrative";

void test("emissions metrics handle valid and missing generation", () => {
  assert.equal(computeCo2IntensityLbsMWh(1, 2), 1000);
  assert.equal(computeCo2IntensityLbsMWh(1, 0), null);
  assert.equal(computeHeatRateMMBtuMWh(75, 10), 7.5);
  assert.equal(
    pickCleanestByCarbonIntensity([
      { carbonIntensityLbsMWh: 900 },
      { carbonIntensityLbsMWh: 0 },
    ])?.carbonIntensityLbsMWh,
    0,
  );
});

void test("fuel metadata stays consistent and filters remain distinct", () => {
  assert.equal(getFuelTheme("Pipeline Natural Gas").name, "Natural Gas");
  assert.equal(getFuelTheme("Coal").color, "#f59e0b");
  assert.ok(FUEL_CATEGORIES.every(({ query }) => String(query) !== "ALL"));
  assert.ok(
    getMarkerRadius({ totalCapacityMW: 1000, totalCo2Tons: 100 }, "capacity") >
      3,
  );
});

void test("unit status and controls use shared rules", () => {
  assert.equal(isOperatingStatus("Operating"), true);
  assert.equal(isOperatingStatus("Non-Operating"), false);
  assert.equal(hasAirQualityControls({ pmControls: "Baghouse" }), true);
  assert.equal(hasAirQualityControls({}), false);
  assert.equal(
    cleanOwnerOperator("Acme (Owner) | acme (Operator) | Beta Co (Parent)"),
    "Acme, Beta Co",
  );
  assert.equal(cleanOwnerOperator(null), "Owner unlisted");
  assert.equal(getCarbonIntensityTier(0).label, "Zero-Carbon");
  assert.equal(getCarbonIntensityTier(1600).variant, "warning");
  assert.equal(getCarbonIntensityTier(2100).variant, "destructive");
});

void test("date options cover every day in a reporting year", () => {
  const options2024 = buildDateOptionsForYear(2024, "2026-06-30");
  assert.equal(options2024.length, 366);
  assert.equal(options2024[0]?.value, "2024-01-01");
  assert.equal(clampDateToYear("2023-03-10", 2024, "2026-06-30"), "2024-03-10");
  assert.equal(clampDateToYear("2024-02-29", 2025, "2026-06-30"), "2025-12-31");
  assert.equal(clampDateToYear("2026-07-15", 2026, "2026-06-30"), "2026-06-30");
  assert.equal(clampDateToYear("", 2025, "2026-06-30"), "2025-12-31");
  assert.equal(clampDateToYear("2025-05-01", 2027, "2026-06-30"), "2026-06-30");
  assert.equal(
    buildDateOptionsForYear(2026, "2026-06-30").at(-1)?.value,
    "2026-06-30",
  );
});

void test("CAMPD published-through is parsed from EPA errors and used to clamp", () => {
  const publishedThrough = "2026-06-30";
  assert.equal(
    parseCampdQuarterEndFromError(
      "Ensure that beginDate and endDate are of the form YYYY-MM-DD, are now or in the past, are after 01/01/1995, and are between 01/01/1995 and the quarter ending on 06/30/2026",
    ),
    publishedThrough,
  );
  assert.equal(parseCampdQuarterEndFromError("no quarter mentioned"), null);
  assert.deepEqual(
    getCampdValidMonthsForYear(2026, publishedThrough),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    getCampdValidMonthsForYear(2025, publishedThrough),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.deepEqual(getCampdValidMonthsForYear(2027, publishedThrough), []);
  assert.equal(
    clampIsoDateToCampdPublished("2026-07-15", publishedThrough),
    "2026-06-30",
  );
  assert.equal(
    getDefaultCampdDateForYear(2026, publishedThrough),
    "2026-06-30",
  );
  assert.equal(
    getDefaultCampdDateForYear(2025, publishedThrough),
    "2025-12-31",
  );
  assert.deepEqual(
    clampCampdDateRange("2026-01-01", "2026-12-31", publishedThrough),
    {
      beginDate: "2026-01-01",
      endDate: "2026-06-30",
    },
  );
  assert.equal(toIsoDate(new Date(2026, 5, 30)), "2026-06-30");
});

void test("yearly rollups aggregate records by reporting year", () => {
  const rollups = buildYearlyRollups([
    {
      id: "rec-1",
      year: 2022,
      grossGenerationMWh: 100,
      co2MassTons: 50,
      so2MassTons: 0,
      noxMassTons: 0,
      heatInputMMBtu: 800,
      operatingHours: 4000,
    },
    {
      id: "rec-2",
      year: 2022,
      grossGenerationMWh: 50,
      co2MassTons: 25,
      so2MassTons: 0,
      noxMassTons: 0,
      heatInputMMBtu: 400,
      operatingHours: 2000,
    },
  ]);

  assert.equal(rollups.length, 1);
  assert.equal(rollups[0]?.year, 2022);
  assert.equal(rollups[0]?.grossGenerationMWh, 150);
  assert.equal(rollups[0]?.co2MassTons, 75);
  assert.equal(rollups[0]?.unitCount, 2);
  assert.equal(rollups[0]?.co2IntensityLbsMWh, 1000);
  assert.equal(rollups[0]?.maxOperatingHours, 4000);
  assert.equal(rollups[0]?.heatRateMMBtuMWh, 8);
});

void test("python data import engine detects schema, duplicates, and anomalies", () => {
  const testCsv = path.resolve(process.cwd(), "test_unit_import.csv");
  const csvContent = [
    '"Facility ID","Facility Name","State","Unit ID","Year","Heat Input (mmBtu)","CO2 Mass (short tons)","Gross Load (MWh)","Operating Time"',
    '3,"Barry","AL","1",2025,1500,0,100,500', // Anomaly: heat input > 1000 and co2 = 0
    '3,"Barry","AL","1",2025,1200,100,80,400', // Duplicate facility-unit-year!
    'BAD_ID,"Ghost","CA","2",2025,100,50,50,200', // Invalid Facility ID format
    '10,"Normal Plant","TX","U1",2025,500,200,100,500', // Valid record
  ].join("\n");

  fs.writeFileSync(testCsv, csvContent, "utf-8");

  try {
    const scriptPath = path.resolve(
      process.cwd(),
      "scripts",
      "parse_import.py",
    );
    const output = execFileSync("python3", [scriptPath, testCsv], {
      encoding: "utf-8",
    });
    const report = JSON.parse(output) as PythonValidationReport;

    assert.equal(report.targetSchema, "ANNUAL_EMISSIONS");
    assert.equal(report.totalRows, 4);
    assert.equal(report.summary.validCount, 3);
    assert.equal(report.summary.invalidCount, 1);
    assert.equal(report.summary.duplicateCount, 1);
    assert.ok(
      report.anomalies.some(
        (a) => a.flagType === "ZERO_EMISSIONS_HIGH_HEAT",
      ),
    );
    assert.equal(report.schemaComparison.isSchemaCompatible, true);
  } finally {
    if (fs.existsSync(testCsv)) fs.unlinkSync(testCsv);
  }
});

void test("dataImports facility-2025.csv matches FACILITIES_AND_UNITS schema", () => {
  const facilityCsv = path.resolve(
    process.cwd(),
    "dataImports",
    "facility-2025.csv",
  );
  if (!fs.existsSync(facilityCsv)) return;

  const scriptPath = path.resolve(process.cwd(), "scripts", "parse_import.py");
  const output = execFileSync(
    "python3",
    [scriptPath, facilityCsv, "--limit", "10"],
    {
      encoding: "utf-8",
    },
  );
  const report = JSON.parse(output) as PythonValidationReport;

  assert.equal(report.targetSchema, "FACILITIES_AND_UNITS");
  assert.equal(report.totalRows, 4057);
  assert.equal(report.summary.validCount, 4057);
  assert.equal(report.schemaComparison.isSchemaCompatible, true);
  assert.deepEqual(report.destinationTables, [
    "facilities",
    "units",
    "datasets",
  ]);
});

void test("python data import engine handles Excel xlsx files", () => {
  const testXlsx = path.resolve(process.cwd(), "test_excel_import.xlsx");

  // Create test Excel file using python openpyxl
  execFileSync("python3", [
    "-c",
    `
import openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Facilities"
ws.append(["Facility ID", "Facility Name", "State", "Unit ID", "Unit Type", "Primary Fuel Type"])
ws.append([3, "Barry", "AL", "1", "Tangentially-fired", "Coal"])
ws.append([3, "Barry", "AL", "2", "Tangentially-fired", "Coal"])
ws.append(["BAD", "Bad Plant", "ZZ", "3", "Unknown", "Gas"])
wb.save("${testXlsx}")
`,
  ]);

  try {
    const scriptPath = path.resolve(
      process.cwd(),
      "scripts",
      "parse_import.py",
    );
    const output = execFileSync("python3", [scriptPath, testXlsx], {
      encoding: "utf-8",
    });
    const report = JSON.parse(output) as PythonValidationReport;

    assert.equal(report.targetSchema, "FACILITIES_AND_UNITS");
    assert.equal(report.totalRows, 3);
    assert.equal(report.summary.validCount, 2);
    assert.equal(report.summary.invalidCount, 1);
    assert.equal(report.fileExtension, "xlsx");
  } finally {
    if (fs.existsSync(testXlsx)) fs.unlinkSync(testXlsx);
  }
});
