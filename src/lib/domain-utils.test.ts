import assert from "node:assert/strict";
import test from "node:test";
import { buildYearlyRollups } from "./annual-rollups";
import { buildDateOptionsForYear, clampDateToYear } from "./date-options";
import {
  computeCo2IntensityLbsMWh,
  computeHeatRateMMBtuMWh,
  pickCleanestByCarbonIntensity,
} from "./emissions-metrics";
import { FUEL_CATEGORIES, getFuelTheme, getMarkerRadius } from "./map-utils";
import { hasAirQualityControls, isOperatingStatus } from "./plant-narrative";

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
});

void test("date options cover every day in a reporting year", () => {
  const options2024 = buildDateOptionsForYear(2024);
  assert.equal(options2024.length, 366);
  assert.equal(options2024[0]?.value, "2024-01-01");
  assert.equal(clampDateToYear("2023-03-10", 2024), "2024-03-10");
  assert.equal(clampDateToYear("2024-02-29", 2025), "2025-07-15");
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
});

void test("granular temporal intensity calculations adhere to bounds", () => {
  // Test valid intensity derivation for hourly / monthly slices
  const hourlyIntensity = computeCo2IntensityLbsMWh(12.5, 25);
  assert.equal(hourlyIntensity, 1000);

  // When zero generation occurs, intensity must be null rather than NaN or Infinity
  const zeroGenIntensity = computeCo2IntensityLbsMWh(5.0, 0);
  assert.equal(zeroGenIntensity, null);

  // Heat rate calculations for thermal efficiency
  const heatRate = computeHeatRateMMBtuMWh(160, 20);
  assert.equal(heatRate, 8.0);
});
