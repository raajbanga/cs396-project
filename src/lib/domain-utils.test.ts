import assert from "node:assert/strict";
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
import {
  buildYearlyRollups,
  computeCo2IntensityLbsMWh,
  computeHeatRateMMBtuMWh,
  deriveRates,
  emptyTotals,
  evaluatePhysicalSanityRules,
  pickCleanestByCarbonIntensity,
  sumTotals,
  type ReportedTotals,
} from "./emissions-metrics";
import {
  activeCampdFilters,
  campdRetrievalSchema,
  DEFAULT_FILTERS,
  DEFAULT_AUDIT_TABLE_STATE,
  DEFAULT_TABLE_STATE,
  DEFAULT_UNIT_TABLE_STATE,
  describeCampdFilters,
  explorerSearchParams,
  multiValueOptions,
  nextSort,
  parseExplorerParams,
  parseFacilityIds,
} from "./facility-filters";
import { FUEL_CATEGORIES, getFuelTheme, getMarkerRadius } from "./map-utils";
import {
  cleanOwnerOperator,
  getCarbonIntensityTier,
  hasAirQualityControls,
  isOperatingStatus,
} from "./plant-narrative";
import { isNumericValue, sortRows } from "./utils";

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

void test("not reported (null) is kept apart from 0 in rates, totals, and sanity rules", () => {
  const record: ReportedTotals = {
    ...emptyTotals(),
    heatInputMMBtu: 38801.9,
    grossGenerationMWh: 2012,
    operatingHours: 111,
    co2MassTons: null,
    steamLoadKlb: null,
  };
  const flags = (r: ReportedTotals) =>
    evaluatePhysicalSanityRules({ ...r, ...deriveRates(r) }).map(
      (f) => `${f.flagType}:${f.severity}`,
    );
  // Missing CO₂ is a reporting gap (WARN); a reported 0 is implausible (ERROR).
  assert.deepEqual(flags(record), ["CO2_NOT_REPORTED:WARN"]);
  assert.deepEqual(flags({ ...record, co2MassTons: 0 }), [
    "ZERO_EMISSIONS_HIGH_HEAT:ERROR",
  ]);
  // Rates need both inputs reported; missing heat input never looks like an extreme heat rate.
  assert.equal(deriveRates(record).co2IntensityLbsMWh, null);
  assert.deepEqual(
    flags({ ...record, heatInputMMBtu: null, co2MassTons: 1 }),
    [],
  );
  // Phantom generation needs a reported 0 hours, not a missing value.
  assert.deepEqual(
    flags({ ...record, co2MassTons: 1, operatingHours: null }),
    [],
  );
  // Totals count unreported values as 0.
  assert.equal(
    sumTotals([record, { ...record, co2MassTons: 5 }]).co2MassTons,
    5,
  );
});

void test("fuel metadata stays consistent and filters remain distinct", () => {
  assert.equal(getFuelTheme("Pipeline Natural Gas").name, "Natural Gas");
  assert.equal(getFuelTheme("Coal").color, "#f59e0b");
  // Each chip is a fuel class getFuelTheme assigns, so its count equals what it filters to.
  assert.deepEqual(
    FUEL_CATEGORIES.map((c) => c.name),
    ["Pipeline Natural Gas", "Coal", "Residual Oil"].map(
      (f) => getFuelTheme(f).name,
    ),
  );
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
  // A blank SO₂ entry must not hide a real NOₓ control (and blanks alone don't count).
  assert.equal(
    hasAirQualityControls({ so2Controls: "", noxControls: "SCR" }),
    true,
  );
  assert.equal(
    hasAirQualityControls({ so2Controls: " ", pmControls: "" }),
    false,
  );
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
      steamLoadKlb: 0,
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
      steamLoadKlb: 0,
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

void test("CAMPD retrieval filters parse, drop 'ALL', and describe themselves", () => {
  assert.deepEqual(parseFacilityIds(" 3, 1355 |7 "), [3, 1355, 7]);
  assert.deepEqual(parseFacilityIds(""), []);
  assert.equal(parseFacilityIds("3, abc"), null);
  assert.equal(parseFacilityIds("2.5"), null);

  const active = activeCampdFilters({
    stateCode: "KY",
    facilityId: [],
    unitFuelType: "Coal",
    unitType: "ALL",
    controlTechnologies: "",
  });
  assert.deepEqual(active, { stateCode: "KY", unitFuelType: "Coal" });
  assert.equal(describeCampdFilters(active), "KY · Coal");
  assert.equal(
    describeCampdFilters({ facilityId: [3, 7], unitType: "Cyclone boiler" }),
    "Facility 3, 7 · Cyclone boiler",
  );
  assert.equal(describeCampdFilters({ stateCode: "ALL" }), "");

  assert.ok(
    campdRetrievalSchema.safeParse({ fromYear: 2020, toYear: 2024 }).success,
  );
  assert.ok(
    !campdRetrievalSchema.safeParse({ fromYear: 2024, toYear: 2020 }).success,
  );
  assert.ok(
    !campdRetrievalSchema.safeParse({ fromYear: 1990, toYear: 1991 }).success,
  );
});

void test("explorer state round-trips through URL query params", () => {
  const state = {
    tab: "units" as const,
    q: "coal units in KY",
    filters: {
      ...DEFAULT_FILTERS,
      stateCode: "KY",
      primaryFuel: "Coal",
      year: "2025",
      co2MassTonsMin: "500000",
      topN: "10",
      rankGroup: "state",
    },
    table: DEFAULT_TABLE_STATE,
    auditTable: DEFAULT_AUDIT_TABLE_STATE,
    unitTable: {
      ...DEFAULT_UNIT_TABLE_STATE,
      sortBy: "noxMassTons" as const,
      sortDir: "asc" as const,
      page: 3,
      pageSize: 25,
    },
  };
  const qs = explorerSearchParams(state);
  assert.equal(
    qs,
    "tab=units&q=coal+units+in+KY&stateCode=KY&primaryFuel=Coal&year=2025&topN=10&rankGroup=state&co2MassTonsMin=500000&sort=noxMassTons&dir=asc&page=3&size=25",
  );
  assert.deepEqual(
    parseExplorerParams(Object.fromEntries(new URLSearchParams(qs))),
    state,
  );
  assert.equal(explorerSearchParams(parseExplorerParams({})), "");
});

void test("explorer params ignore unknown keys and invalid values", () => {
  const parsed = parseExplorerParams({
    tab: "nope",
    sort: "co2MassTons", // a unit sort key is not valid on the Facilities tab
    dir: "sideways",
    page: "-2",
    size: "7",
    bogus: "1",
    stateCode: ["TX", "KY"],
  });
  assert.equal(parsed.tab, "explorer");
  assert.deepEqual(parsed.table, DEFAULT_TABLE_STATE);
  assert.equal(parsed.filters.stateCode, "TX");
  assert.equal("bogus" in parsed.filters, false);
});

void test("multiValueOptions splits combined unit values into distinct options", () => {
  assert.deepEqual(
    multiValueOptions([
      "Wet Lime FGD|Wet Limestone",
      "Diesel Oil, Pipeline Natural Gas",
      "Selective Non-catalytic Reduction (Began Oct 28, 2025)|Overfire Air",
      "Wet Limestone",
    ]),
    [
      "Diesel Oil",
      "Overfire Air",
      "Pipeline Natural Gas",
      "Selective Non-catalytic Reduction",
      "Wet Lime FGD",
      "Wet Limestone",
    ],
  );
});

void test("nextSort flips on the same field and resets the page", () => {
  const desc = (f: string) => f === "co2";
  const t = { ...DEFAULT_TABLE_STATE, page: 4 };
  assert.deepEqual(nextSort(t, "co2", desc), {
    ...t,
    page: 1,
    sortBy: "co2",
    sortDir: "desc",
  });
  assert.equal(nextSort(t, "name", desc).sortDir, "desc"); // already name/asc
  assert.equal(nextSort(t, "id", desc).sortDir, "asc");
});

void test("sortRows: numbers, formatted numbers, dates, natural text; missing values last", () => {
  const rows = ["1,250", "987", "—", "12", null, "10,000.5"];
  assert.deepEqual(
    sortRows(rows, (r) => r, "asc"),
    ["12", "987", "1,250", "10,000.5", "—", null],
  );
  assert.deepEqual(
    sortRows(rows, (r) => r, "desc"),
    ["10,000.5", "1,250", "987", "12", "—", null],
  );
  assert.deepEqual(
    sortRows(["Unit 10", "Unit 2", "unit 1"], (r) => r, "asc"),
    ["unit 1", "Unit 2", "Unit 10"],
  );
  const d = (iso: string) => new Date(iso);
  assert.deepEqual(
    sortRows([d("2026-10-07"), d("2025-01-01")], (r) => r, "asc").map((x) =>
      x.getUTCFullYear(),
    ),
    [2025, 2026],
  );
  assert.equal(isNumericValue("1,234.5"), true);
  assert.equal(isNumericValue("CT1"), false);
});

void test("audit tab sort and page round-trip through the URL", () => {
  const state = parseExplorerParams({
    tab: "audit",
    sort: "severity",
    dir: "asc",
    page: "3",
    auditFlag: "EXTREME_HEAT_RATE",
  });
  assert.deepEqual(state.auditTable, {
    ...DEFAULT_AUDIT_TABLE_STATE,
    sortBy: "severity",
    sortDir: "asc",
    page: 3,
  });
  assert.equal(state.filters.auditFlag, "EXTREME_HEAT_RATE");
  assert.equal(
    explorerSearchParams(state),
    "tab=audit&auditFlag=EXTREME_HEAT_RATE&sort=severity&dir=asc&page=3",
  );
  // A unit-view sort key is not valid on the Audits tab.
  assert.equal(
    parseExplorerParams({ tab: "audit", sort: "co2MassTons" }).auditTable
      .sortBy,
    "year",
  );
});
