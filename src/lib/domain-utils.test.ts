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
