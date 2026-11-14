import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  changedInputs,
  featureLabel,
  modelInputs,
  outOfRange,
  percentChange,
  predict,
  scenarioResults,
  scenarios,
  sensitivityCurve,
  sensitivityGrid,
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

void test("percentChange: relative to the base, undefined from zero", () => {
  assert.equal(percentChange(110, 100), 10.000000000000009);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(5, 0), null);
});

const close = (a: number, b: number) =>
  Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

void test("sensitivityGrid: percentages of the baseline, the baseline included once", () => {
  const { values, capped } = sensitivityGrid(200, -50, 50, 25, false);
  assert.deepEqual(values, [100, 150, 200, 250, 300]);
  assert.equal(capped, false);
});

void test("sensitivityGrid: values in the input's unit, with an off-grid baseline", () => {
  const { values } = sensitivityGrid(7, 0, 20, 10, true);
  assert.deepEqual(values, [0, 7, 10, 20]);
});

void test("sensitivityGrid: a reversed range and a negative step give the same grid", () => {
  const fixed = sensitivityGrid(100, 50, -50, -25, false);
  const plain = sensitivityGrid(100, -50, 50, 25, false);
  assert.deepEqual(fixed.values, plain.values);
  // Each correction is reported, so the page can say what it changed.
  assert.equal(fixed.reversed, true);
  assert.equal(fixed.step, 25);
  assert.equal(plain.reversed, false);
  assert.equal(plain.step, 25);
  // A zero or missing step is read as a step of 1.
  const zero = sensitivityGrid(100, 0, 10, 0, true);
  assert.equal(zero.values.length, 12);
  assert.equal(zero.step, 1);
  assert.equal(sensitivityGrid(100, 0, 10, Number(""), true).step, 1);
  assert.equal(sensitivityGrid(100, 0, 10, NaN, true).step, 1);
});

void test("sensitivityGrid: stops at the point limit and says so", () => {
  const { values, capped } = sensitivityGrid(0, 0, 1000, 1, true, 50);
  assert.equal(capped, true);
  assert.ok(values.length <= 50 && values.at(-1)! < 1000);
  assert.equal(sensitivityGrid(0, 0, 10, 1, true, 50).capped, false);
});

void test("sensitivityCurve: one input changes, the rest held; changes from the baseline", () => {
  const base = modelInputs({ ...raw, prev_heat_input_mmbtu: 10_000_000 });
  const value0 = base.heat_input_mmbtu!;
  const { values } = sensitivityGrid(value0, -50, 50, 10, false);
  const ridge = models.ridge!;
  const { pred0, points } = sensitivityCurve(
    ridge,
    base,
    "heat_input_mmbtu",
    values,
    value0,
  );
  assert.equal(pred0, predict(ridge, base));
  for (const q of points) {
    const expected = predict(ridge, { ...base, heat_input_mmbtu: q.value });
    assert.equal(q.prediction, expected);
    assert.ok(close(q.diff, expected - pred0));
    assert.ok(close(q.diffPct!, ((expected - pred0) / pred0) * 100));
    assert.ok(close(q.change!, (q.value / value0 - 1) * 100));
  }
  const at0 = points.find((q) => q.value === value0)!;
  assert.equal(at0.diff, 0);
  assert.equal(at0.change, 0);
  // Ridge rises with heat input along the whole curve.
  assert.ok(
    points.every((q, i) => i === 0 || q.prediction > points[i - 1]!.prediction),
  );
});

void test("sensitivityCurve: values past the training maximum are flagged", () => {
  const base = modelInputs(raw);
  const [, max] = models.tree!.ranges.numeric.heat_input_mmbtu;
  const { points } = sensitivityCurve(
    models.tree!,
    base,
    "heat_input_mmbtu",
    [max / 2, max, max * 1.5],
    base.heat_input_mmbtu!,
  );
  assert.deepEqual(
    points.map((q) => q.outside),
    [false, false, true],
  );
});

void test("scenarios: each changes only what it names", () => {
  const base = modelInputs(raw); // coal, with SCR
  const list = scenarios(base, 10, -5);
  assert.deepEqual(
    list.map((s) => s.name),
    [
      "Baseline",
      "Gross load +10 %",
      "Heat input -5 %",
      "Remove SCR",
      "Fuel: Pipeline Natural Gas",
      "High efficiency",
    ],
  );
  const changed = (s: (typeof list)[number]) =>
    Object.keys(base).filter(
      (k) => s.inputs[k as keyof typeof base] !== base[k as keyof typeof base],
    );
  assert.deepEqual(list.map(changed), [
    [],
    ["gross_load_mwh"],
    ["heat_input_mmbtu"],
    ["scr"],
    ["primary_fuel"],
    ["heat_input_mmbtu"], // SCR was already on
  ]);
  assert.equal(list[1]!.inputs.gross_load_mwh, 2_200_000);
  assert.equal(list[2]!.inputs.heat_input_mmbtu, 19_000_000);
  // A gas unit without SCR gets the opposite fuel and control changes.
  const gas = scenarios(
    { ...base, primary_fuel: "Pipeline Natural Gas", scr: 0 },
    10,
    -5,
  );
  assert.equal(gas[3]!.name, "Add SCR");
  assert.equal(gas[3]!.inputs.scr, 1);
  assert.equal(gas[4]!.inputs.primary_fuel, "Coal");
  assert.equal(gas[5]!.inputs.scr, 1);
});

void test("scenarioResults: predictions and changes against the baseline prediction", () => {
  const base = modelInputs(raw);
  const list = scenarios(base, 10, -5);
  const results = scenarioResults(models.ridge!, base, list);
  const pred0 = predict(models.ridge!, base);
  assert.equal(results[0]!.diff, 0);
  assert.equal(results[0]!.diffPct, 0);
  for (const r of results) {
    assert.equal(r.prediction, predict(models.ridge!, r.scenario.inputs));
    assert.ok(close(r.diffPct!, ((r.prediction - pred0) / pred0) * 100));
  }
  // Less heat input lowers Ridge's prediction.
  assert.ok(results[2]!.diff < 0);
  // An unseen fuel is an out-of-range warning.
  const unseen = scenarioResults(models.ridge!, base, [
    { ...list[0]!, inputs: { ...base, primary_fuel: "Plasma" } },
  ]);
  assert.deepEqual(unseen[0]!.warnings, ["primary_fuel"]);
});

void test("changedInputs names each changed input with its value and the baseline's", () => {
  const base = modelInputs(raw); // coal, with SCR
  const [, load, heat, scr, fuel, efficient] = scenarios(base, 10, -5);
  assert.deepEqual(changedInputs(base, base), []);
  assert.match(
    changedInputs(base, load!.inputs)[0]!,
    /^Gross load .+ MWh \(from .+\)$/,
  );
  assert.match(
    changedInputs(base, heat!.inputs)[0]!,
    /^Heat input .+ MMBtu \(from .+\)$/,
  );
  assert.deepEqual(changedInputs(base, scr!.inputs), ["SCR no (from yes)"]);
  assert.match(
    changedInputs(base, fuel!.inputs)[0]!,
    /Pipeline Natural Gas \(from Coal\)$/,
  );
  assert.equal(changedInputs(base, efficient!.inputs).length, 1); // heat input; SCR already on
});

void test("sensitivityGrid: drops impossible negative values and counts them", () => {
  const pct = sensitivityGrid(100, -200, 0, 50, false);
  assert.deepEqual(pct.values, [0, 50, 100]);
  assert.equal(pct.negative, 2); // -200 % and -150 %
  const raw = sensitivityGrid(10, -10, 10, 10, true);
  assert.deepEqual(raw.values, [0, 10]);
  assert.equal(raw.negative, 1);
  assert.equal(sensitivityGrid(100, -50, 50, 25, false).negative, 0);
});

void test("scenarios: high efficiency always cuts heat input", () => {
  const base = modelInputs(raw);
  const heat = base.heat_input_mmbtu!;
  const efficient = (pct: number) =>
    scenarios(base, 10, pct).find((s) => s.name === "High efficiency")!;
  assert.equal(efficient(-8).inputs.heat_input_mmbtu, heat * 0.92);
  // A rise in heat input isn't efficiency: a 5 % cut is used, and the description says so.
  assert.equal(efficient(10).inputs.heat_input_mmbtu, heat * 0.95);
  assert.match(efficient(10).change, /5 % cut/);
});
