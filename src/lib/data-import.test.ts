import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildImportReport,
  canImport,
  checkUploadFile,
  type ParsedUpload,
} from "./data-import";
import { PYTHON } from "./python";
import { recordKey } from "./record-diff";

const SCRIPT = path.resolve("scripts", "parse_import.py");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "data-import-test-"));
test.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

const parse = (file: string) =>
  JSON.parse(
    execFileSync(PYTHON, [SCRIPT, file], {
      encoding: "utf-8",
      maxBuffer: 1024 ** 3,
    }),
  ) as ParsedUpload;

void test("upload check enforces extension and size", () => {
  assert.equal(checkUploadFile({ name: "a.CSV", size: 10 }), null);
  assert.equal(checkUploadFile({ name: "a.xlsx", size: 10 }), null);
  assert.match(checkUploadFile({ name: "a.pdf", size: 10 })!, /Unsupported/);
  assert.match(checkUploadFile({ name: "a.csv", size: 0 })!, /empty/);
  assert.match(
    checkUploadFile({ name: "a.csv", size: 101 * 1024 ** 2 })!,
    /limit/,
  );
});

void test("parser rejects invalid rows, skips duplicates, and reports audit flags", () => {
  const csvPath = path.join(tmpDir, "annual.csv");
  fs.writeFileSync(
    csvPath,
    [
      '"Facility ID","Facility Name","State","Unit ID","Year","Latitude","Heat Input (mmBtu)","CO2 Mass (short tons)","Gross Load (MWh)","Operating Time"',
      '3,"Barry","AL","1",2025,31,1500,0,100,500', // valid, but zero CO2 at high heat
      '3,"Barry","AL","1",2025,31,1200,100,80,400', // duplicate facility-unit-year
      'BAD_ID,"Ghost","CA","2",2025,34,100,50,50,200', // invalid facility ID
      '10,"Plant","TX","U1",2025,999,500,200,100,500', // latitude out of range
      '11,"Plant","TX","U1",2025,30,500,abc,100,500', // non-numeric CO2
      '12,"Plant","TX","U1",2025,30,3000,200,100,500', // valid, but extreme heat rate
    ].join("\n"),
  );

  const parsed = parse(csvPath);
  assert.equal(parsed.targetSchema, "ANNUAL_EMISSIONS");
  assert.deepEqual(parsed.summary, {
    totalRows: 6,
    validCount: 2,
    invalidCount: 3,
    duplicateCount: 1,
  });
  assert.deepEqual(
    parsed.validationErrors.map((e) => [e.rowNumber, e.field]),
    [
      [3, "Facility ID"],
      [4, "Latitude"],
      [5, "CO2 Mass (short tons)"],
    ],
  );
  assert.equal(parsed.duplicates[0]?.firstSeenRow, 1);
  assert.deepEqual(
    parsed.records.annual.map((r) => [r.facilityId, r.unitId, r.year]),
    [
      [3, "1", 2025],
      [12, "U1", 2025],
    ],
  );
  assert.deepEqual(
    parsed.rejectedRows.map((r) => [r.rowNumber, r.kind]),
    [
      [2, "DUPLICATE"],
      [3, "REJECTED"],
      [4, "REJECTED"],
      [5, "REJECTED"],
    ],
  );
  assert.equal(parsed.rejectedRows[1]?.data["Facility ID"], "BAD_ID");
  assert.ok(canImport(parsed));

  const stored = parsed.records.annual.find((r) => r.facilityId === 12)!;
  const report = buildImportReport(
    parsed,
    new Map([
      ["12:U1:2025", { ...stored, co2MassTons: stored.co2MassTons + 1 }],
    ]),
  );
  assert.deepEqual(report.diff, { inserted: 1, updated: 1, unchanged: 0 });
  assert.match(
    report.duplicates.find((d) => d.rowNumber === 6)!.reason,
    /update co2MassTons/,
  );
  assert.deepEqual(
    report.anomalies.map((a) => a.flagType),
    ["ZERO_EMISSIONS_HIGH_HEAT", "EXTREME_HEAT_RATE"],
  );
  assert.equal(report.previewRows[0]?.status, "flagged");
  assert.ok(
    report.duplicates.some((d) => d.rowNumber === 6 && !d.firstSeenRow),
  );
  assert.ok(!("records" in report));
  assert.ok(!("rejectedRows" in report));
});

void test("parser maps steam load and retirement date", () => {
  const csvPath = path.join(tmpDir, "steam.csv");
  fs.writeFileSync(
    csvPath,
    [
      '"Facility ID","Unit ID","Year","Steam Load (1000 lb)","Heat Input (mmBtu)","Retirement Date"',
      '3,"1",2025,"1,250.5",900,2030-12-31',
    ].join("\n"),
  );
  const parsed = parse(csvPath);
  assert.equal(parsed.records.annual[0]?.steamLoadKlb, 1250.5);
  assert.equal(parsed.records.units[0]?.retirementDate, "2030-12-31");
});

void test("parser refuses files without facility and unit IDs", () => {
  const csvPath = path.join(tmpDir, "other.csv");
  fs.writeFileSync(csvPath, "Transaction ID,Total\n1,5\n");
  const parsed = parse(csvPath);
  assert.equal(parsed.targetSchema, "UNRECOGNIZED");
  assert.equal(canImport(parsed), false);
});

const hasOpenpyxl = spawnSync(PYTHON, ["-c", "import openpyxl"]).status === 0;

void test(
  "parser reads Excel workbooks",
  { skip: !hasOpenpyxl && "openpyxl missing: pip install -r requirements.txt" },
  () => {
    const xlsxPath = path.join(tmpDir, "facilities.xlsx");
    execFileSync(PYTHON, [
      "-c",
      `import sys, openpyxl
wb = openpyxl.Workbook()
ws = wb.active
ws.append(["Facility ID", "Facility Name", "State", "Unit ID", "Unit Type", "Primary Fuel Type"])
ws.append([3, "Barry", "AL", 1, "Tangentially-fired", "Coal"])
ws.append([3, "Barry", "AL", 2, "Tangentially-fired", "Coal"])
ws.append(["BAD", "Bad Plant", "ZZ", 3, "Unknown", "Gas"])
wb.save(sys.argv[1])`,
      xlsxPath,
    ]);

    const parsed = parse(xlsxPath);
    assert.equal(parsed.targetSchema, "FACILITIES_AND_UNITS");
    assert.deepEqual(parsed.summary, {
      totalRows: 3,
      validCount: 2,
      invalidCount: 1,
      duplicateCount: 0,
    });
    assert.deepEqual(
      parsed.records.units.map((u) => u.unitId),
      ["1", "2"],
    );
  },
);

const facilityCsv = path.resolve("dataImports", "facility-2025.csv");

void test(
  "dataImports/facility-2025.csv maps to facilities and units",
  { skip: !fs.existsSync(facilityCsv) && "dataImports/ not present" },
  () => {
    const parsed = parse(facilityCsv);
    assert.equal(parsed.targetSchema, "FACILITIES_AND_UNITS");
    assert.equal(parsed.summary.totalRows, 4057);
    assert.equal(parsed.summary.validCount, 4057);
    assert.equal(parsed.reportingYear, 2025);
    assert.deepEqual(parsed.destinationTables, [
      "datasets",
      "facilities",
      "units",
    ]);
    assert.equal(parsed.records.units[0]?.nameplateCapacityMW, 153.1);
  },
);

void test("samples/ upload files give the report documented in samples/README.md", () => {
  for (const file of ["csv", "xlsx"]) {
    const parsed = parse(
      path.resolve("samples", `annual-emissions-sample.${file}`),
    );
    assert.equal(parsed.targetSchema, "ANNUAL_EMISSIONS");
    assert.equal(parsed.reportingYear, 2014);
    assert.deepEqual(parsed.summary, {
      totalRows: 25,
      validCount: 21,
      invalidCount: 3,
      duplicateCount: 1,
    });
    assert.deepEqual(
      parsed.rejectedRows.map((r) => [r.rowNumber, r.kind]),
      [
        [12, "REJECTED"],
        [18, "REJECTED"],
        [19, "REJECTED"],
        [25, "DUPLICATE"],
      ],
    );

    // Store rows 22 and 23 (Trimble County 2023) as the database has them: row 23's CO2 is 1,000 t lower in the file.
    const annual = parsed.records.annual;
    const stored = new Map(
      annual
        .filter((r) => r.year === 2023)
        .map((r) => [
          recordKey(r.facilityId, r.unitId, r.year),
          r.rowNumber === 23 ? { ...r, co2MassTons: r.co2MassTons + 1000 } : r,
        ]),
    );
    const report = buildImportReport(parsed, stored);
    assert.deepEqual(report.diff, { inserted: 19, updated: 1, unchanged: 1 });
    assert.deepEqual(
      report.anomalies.map((a) => [a.rowNumber, a.flagType]),
      [[16, "ZERO_EMISSIONS_HIGH_HEAT"]],
    );
  }
});
