import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  aggregate,
  buildVariables,
  hoursInYear,
  noxControlClass,
  so2ControlClass,
  type AnalysisRow,
} from "./analysis";
import { SHORT_TON_KG, type TraciFactor } from "./traci";

/** The committed TRACI extract, as the import script reads it. */
const [header, ...lines] = readFileSync("data/traci/traci_2_2_air.csv", "utf8")
  .trim()
  .split(/\r?\n/)
  .map((l) => l.split(","));
const factors: TraciFactor[] = lines.map((cells) => {
  const r = Object.fromEntries(header!.map((h, i) => [h, cells[i]!]));
  return {
    traciVersion: r.traci_version!,
    pollutant: r.pollutant!,
    substance: r.substance!,
    cas: r.cas!,
    impactCategory: r.impact_category!,
    factor: Number(r.factor),
    factorUnit: r.factor_unit!,
  };
});
const variables = buildVariables(factors);
const v = (key: string) => variables.find((x) => x.key === key)!;

const row = (over: Partial<AnalysisRow> = {}): AnalysisRow => ({
  facilityId: 1,
  facilityName: "Plant",
  stateCode: "KY",
  unitInternalId: "u1",
  unitId: "1",
  unitType: "Tangentially-fired",
  primaryFuel: "Coal",
  noxControls: null,
  so2Controls: null,
  year: 2024,
  nameplateCapacityMW: 100,
  operatingHours: 5000,
  grossGenerationMWh: 400_000,
  heatInputMMBtu: 4_000_000,
  co2MassTons: 400_000,
  so2MassTons: 200,
  noxMassTons: 300,
  prevGrossGenerationMWh: 500_000,
  prevCo2MassTons: 500_000,
  prevSo2MassTons: null,
  prevNoxMassTons: 0,
  ...over,
});

void test("TRACI extract: verified factors, only CAMPD pollutants, air", () => {
  assert.equal(factors.length, 6);
  assert.ok(factors.every((f) => ["co2", "so2", "nox"].includes(f.pollutant)));
  const nox = factors.filter((f) => f.pollutant === "nox");
  assert.ok(nox.every((f) => f.substance === "NITROGEN OXIDES")); // not NITROGEN DIOXIDE
  assert.equal(
    factors.find(
      (f) => f.pollutant === "so2" && f.impactCategory === "Acidification",
    )?.factor,
    1,
  );
});

void test("derived rates: values, and missing (not 0) when undefined", () => {
  assert.equal(v("co2Intensity").value(row()), 2000); // 400,000 t × 2,000 ÷ 400,000 MWh
  assert.equal(v("heatRate").value(row()), 10);
  assert.equal(v("noxRate").value(row()), 0.15);
  assert.equal(v("co2Intensity").value(row({ grossGenerationMWh: 0 })), null);
  assert.equal(v("co2Intensity").value(row({ co2MassTons: null })), null);
  assert.equal(v("heatRate").value(row({ grossGenerationMWh: null })), null);
  // 2024 is a leap year: 100 MW × 8,784 h.
  assert.equal(hoursInYear(2024), 8784);
  assert.equal(hoursInYear(2100), 8760);
  assert.ok(
    Math.abs(v("capacityFactor").value(row())! - (400_000 / 878_400) * 100) <
      1e-9,
  );
  assert.equal(
    v("capacityFactor").value(row({ nameplateCapacityMW: null })),
    null,
  );
});

void test("year over year: change and percent, missing when a year is", () => {
  assert.equal(v("co2Change").value(row()), -100_000);
  assert.equal(v("co2ChangePct").value(row()), -20);
  assert.equal(v("so2Change").value(row()), null); // no prior SO₂
  assert.equal(v("noxChange").value(row()), 300);
  assert.equal(v("noxChangePct").value(row()), null); // prior year 0: undefined
});

void test("aggregate: sums skip missing, rates pool as a ratio of sums", () => {
  const rows = [
    row({ co2MassTons: 100, grossGenerationMWh: 100 }), // 2,000 lb/MWh
    row({ co2MassTons: 300, grossGenerationMWh: 900 }), // 666.7 lb/MWh
    row({ co2MassTons: null, grossGenerationMWh: 1_000 }), // undefined: left out of both sums
  ];
  assert.equal(aggregate(v("co2MassTons"), rows), 400);
  assert.equal(aggregate(v("co2Intensity"), rows), 800); // 400 × 2,000 ÷ 1,000, not the mean of rates
  assert.equal(aggregate(v("co2MassTons"), [row({ co2MassTons: null })]), null);
  assert.equal(aggregate(v("operatingHours"), rows), 5000); // mean
});

void test("TRACI impacts: hand-computed, categories kept apart, missing propagates", () => {
  const r = row({ so2MassTons: 10, noxMassTons: 20, co2MassTons: 1000 });
  const kg = (tons: number) => tons * SHORT_TON_KG;
  assert.equal(v("impactGlobalwarming").value(r), kg(1000));
  assert.ok(
    Math.abs(v("impactAcidification").value(r)! - (kg(10) * 1 + kg(20) * 0.7)) <
      1e-6,
  );
  assert.ok(
    Math.abs(v("impactSmogformation").value(r)! - kg(20) * 24.793589743589738) <
      1e-6,
  );
  // A missing pollutant leaves its categories missing instead of understating them.
  assert.equal(
    v("impactAcidification").value(row({ so2MassTons: null })),
    null,
  );
  assert.notEqual(
    v("impactSmogformation").value(row({ so2MassTons: null })),
    null,
  );
  assert.equal(
    v("impactAcidificationPerMWh").value(row({ grossGenerationMWh: 0 })),
    null,
  );
  assert.equal(v("impactGlobalwarming").unit, "kg CO2 eq");
  assert.equal(v("impactAcidification").unit, "kg SO2 eq");
});

void test("control classes", () => {
  assert.equal(
    noxControlClass("Low NOx Burner|Selective Catalytic Reduction"),
    "SCR",
  );
  assert.equal(noxControlClass("Selective Non-catalytic Reduction"), "SNCR");
  assert.equal(noxControlClass("Water Injection"), "Combustion controls only");
  assert.equal(noxControlClass(null), "None");
  assert.equal(so2ControlClass("Wet Limestone"), "Scrubber (FGD)");
  assert.equal(so2ControlClass("Dry Sorbent Injection"), "Sorbent injection");
});
