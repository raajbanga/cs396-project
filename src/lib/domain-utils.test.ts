import assert from "node:assert/strict";
import test from "node:test";
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
