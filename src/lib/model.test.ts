import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  featureLabel,
  modelInputs,
  outOfRange,
  predict,
  type ModelArtifact,
  type ModelRaw,
} from "./model";

const read = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const fixture = read<{ raw: ModelRaw; predictions: Record<string, number> }[]>(
  "ml/fixtures/parity.json",
);
const models = Object.fromEntries(
  (["baseline", "ridge", "tree"] as const).map((k) => [
    k,
    read<ModelArtifact>(`ml/models/nox-${k}.json`),
  ]),
);

void test("predict: matches scikit-learn on the parity fixture", () => {
  assert.ok(fixture.length >= 100);
  for (const { raw, predictions } of fixture) {
    for (const [kind, expected] of Object.entries(predictions)) {
      const got = predict(models[kind]!, modelInputs(raw));
      assert.ok(
        Math.abs(got - expected) <= 1e-6 * Math.max(1, Math.abs(expected)),
        `${kind}: ${got} vs ${expected} for ${JSON.stringify(raw)}`,
      );
    }
  }
});

const raw: ModelRaw = {
  year: 2024,
  primary_fuel: "Coal",
  unit_type: "Tangentially-fired",
  nameplate_capacity_mw: 500,
  commercial_op_date: "1978-06-01",
  operating_hours: 6000,
  gross_generation_mwh: 2_000_000,
  heat_input_mmbtu: 20_000_000,
  nox_controls:
    "Low NOx Burner Technology w/ Overfire Air|Selective Catalytic Reduction",
  prev_nox_mass_tons: 1000,
  prev_heat_input_mmbtu: 0,
  prev_operating_hours: null,
};

void test("modelInputs: age, controls, and an undefined prior rate", () => {
  const x = modelInputs(raw);
  assert.equal(x.unit_age, 46);
  assert.equal(x.scr, 1);
  assert.equal(x.sncr, 0);
  assert.equal(x.low_nox_burner, 1);
  assert.equal(x.overfire_air, 1);
  assert.equal(x.prior_nox_rate, null); // prior heat input 0: missing, not infinite
  assert.equal(
    modelInputs({ ...raw, prev_heat_input_mmbtu: 10_000_000 }).prior_nox_rate,
    0.2,
  );
});

void test("outOfRange: flags values past the training range and unseen categories", () => {
  const x = modelInputs(raw);
  assert.deepEqual(outOfRange(models.ridge!, x), []);
  const far = { ...x, heat_input_mmbtu: 1e12, unit_type: "Fusion reactor" };
  assert.deepEqual(outOfRange(models.ridge!, far).sort(), [
    "heat_input_mmbtu",
    "unit_type",
  ]);
});

void test("predict: Ridge responds to heat input in the expected direction", () => {
  const x = modelInputs(raw);
  const more = { ...x, heat_input_mmbtu: x.heat_input_mmbtu! * 1.1 };
  assert.ok(predict(models.ridge!, more) > predict(models.ridge!, x));
});

void test("featureLabel: inputs, categories, and controls in words", () => {
  assert.equal(featureLabel("heat_input_mmbtu"), "Heat input");
  assert.equal(featureLabel("primary_fuel=Coal"), "Primary fuel: Coal");
  assert.equal(featureLabel("unit_type"), "Unit type");
  assert.equal(featureLabel("scr"), "SCR");
  assert.equal(featureLabel("unknown_thing"), "unknown_thing");
});
