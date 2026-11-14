/**
 * Prediction without Python (Phase 2 §5–§6): the models ml/train.py registers carry their
 * preprocessing and parameters as JSON, and these functions reproduce scikit-learn's
 * predictions exactly (checked against ml/fixtures/parity.json by model.test.ts). Keep
 * `modelInputs` and `designRow` in step with `model_inputs` and `design_matrix` in ml/train.py.
 */
import { shortNumber } from "./utils";

/** A unit-year as ml/train.py's query reads it (snake_case, as stored). */
export interface ModelRaw {
  year: number;
  primary_fuel: string | null;
  unit_type: string | null;
  nameplate_capacity_mw: number | null;
  commercial_op_date: string | null;
  operating_hours: number | null;
  gross_generation_mwh: number | null;
  heat_input_mmbtu: number | null;
  nox_controls: string | null;
  prev_nox_mass_tons: number | null;
  prev_heat_input_mmbtu: number | null;
  prev_operating_hours: number | null;
}

/** NOₓ controls the models see, as on/off inputs (matched case-insensitively). */
const CONTROLS = {
  scr: { label: "SCR", pattern: /selective catalytic/ },
  sncr: { label: "SNCR", pattern: /non-catalytic/ },
  low_nox_burner: { label: "Low-NOₓ burners", pattern: /low nox/ },
  injection: {
    label: "Water/steam/ammonia injection",
    pattern: /water injection|steam injection|ammonia injection/,
  },
  overfire_air: { label: "Overfire air", pattern: /overfire|ofa/ },
} as const;
export type Control = keyof typeof CONTROLS;

/** The numeric inputs, with labels and units for the sensitivity controls. */
/**
 * The years the saved model was fit on. Tuning trains on `trainYears` and scores `validationYears`;
 * the registered model is then refit on both, so its fit years span the two.
 */
export const fitYears = (m: { trainYears: string; validationYears: string }) =>
  `${m.trainYears.split("-")[0]}-${m.validationYears.split("-").at(-1)}`;

/** Model colors: kept apart from the fuel colors (amber coal, green gas, blue hydro, rose oil). */
/** Each model's chart color (globals.css palette): the baseline stays neutral. */
export const MODEL_COLORS: Record<string, string> = {
  baseline: "var(--chart-sand)",
  ridge: "var(--chart-slate)",
  tree: "var(--chart-plum)",
};

export const NUMERIC_INPUTS = {
  heat_input_mmbtu: { label: "Heat input", unit: "MMBtu" },
  gross_load_mwh: { label: "Gross load", unit: "MWh" },
  operating_hours: { label: "Operating time", unit: "hr" },
  nameplate_mw: { label: "Nameplate capacity", unit: "MW" },
  unit_age: { label: "Unit age", unit: "years" },
  prior_nox_rate: { label: "Prior-year NOₓ rate", unit: "lb/MMBtu" },
  prior_operating_hours: { label: "Prior-year operating time", unit: "hr" },
} as const;
export type NumericInput = keyof typeof NUMERIC_INPUTS;

export type ModelInputs = Record<NumericInput, number | null> &
  Record<Control, number> & { primary_fuel: string; unit_type: string };

export function modelInputs(raw: ModelRaw): ModelInputs {
  const codYear = Number(raw.commercial_op_date?.slice(0, 4));
  const prevHeat = raw.prev_heat_input_mmbtu;
  const controls = (raw.nox_controls ?? "").toLowerCase();
  return {
    heat_input_mmbtu: raw.heat_input_mmbtu,
    gross_load_mwh: raw.gross_generation_mwh,
    operating_hours: raw.operating_hours,
    nameplate_mw: raw.nameplate_capacity_mw,
    unit_age:
      Number.isFinite(codYear) && raw.commercial_op_date
        ? Math.max(0, raw.year - codYear)
        : null,
    prior_nox_rate:
      prevHeat !== null && prevHeat > 0 && raw.prev_nox_mass_tons !== null
        ? (raw.prev_nox_mass_tons * 2000) / prevHeat
        : null,
    prior_operating_hours: raw.prev_operating_hours,
    primary_fuel: raw.primary_fuel ?? "Not reported",
    unit_type: raw.unit_type ?? "Not reported",
    ...(Object.fromEntries(
      Object.entries(CONTROLS).map(([k, c]) => [
        k,
        c.pattern.test(controls) ? 1 : 0,
      ]),
    ) as Record<Control, number>),
  };
}

interface Spec {
  numeric: {
    name: NumericInput;
    log: boolean;
    median: number;
    mean: number;
    scale: number;
  }[];
  categorical: { name: "primary_fuel" | "unit_type"; categories: string[] }[];
  binary: Control[];
}

export interface ModelArtifact {
  kind: "baseline" | "ridge" | "tree";
  spec: Spec;
  featureNames: string[];
  ranges: {
    numeric: Record<NumericInput, [number, number]>;
    categorical: Record<"primary_fuel" | "unit_type", string[]>;
  };
  importance: Record<string, number>;
  coef?: number[];
  intercept?: number;
  logTarget?: boolean;
  tree?: {
    left: number[];
    right: number[];
    feature: number[];
    threshold: number[];
    value: number[];
  };
  table?: Record<string, number>;
  overall?: number;
}

/** Impute, log, standardize, one-hot, and controls, in the training column order. */
function designRow(inputs: ModelInputs, spec: Spec) {
  const row: number[] = [];
  for (const f of spec.numeric) {
    let x = inputs[f.name] ?? f.median;
    if (f.log) x = Math.log1p(Math.max(0, x));
    row.push((x - f.mean) / f.scale);
  }
  for (const f of spec.categorical) {
    for (const c of f.categories) row.push(inputs[f.name] === c ? 1 : 0);
  }
  for (const name of spec.binary) row.push(inputs[name]);
  return row;
}

/** Predicted NOₓ (short tons) for one unit-year's inputs. */
export function predict(model: ModelArtifact, inputs: ModelInputs) {
  if (model.kind === "baseline") {
    return (
      model.table![`${inputs.primary_fuel}|${inputs.unit_type}`] ??
      model.overall!
    );
  }
  const x = designRow(inputs, model.spec);
  if (model.kind === "ridge") {
    const z = x.reduce(
      (s, xi, i) => s + xi * model.coef![i]!,
      model.intercept!,
    );
    return Math.max(0, model.logTarget ? Math.expm1(z) : z);
  }
  // scikit-learn trees compare float32 features against their thresholds.
  const t = model.tree!;
  let node = 0;
  while (t.left[node] !== -1) {
    node =
      Math.fround(x[t.feature[node]!]!) <= t.threshold[node]!
        ? t.left[node]!
        : t.right[node]!;
  }
  return t.value[node]!;
}

/** Inputs outside what the model saw in training: values past the min–max, or unseen categories. */
export function outOfRange(model: ModelArtifact, inputs: ModelInputs) {
  const warnings: string[] = [];
  for (const [name, [min, max]] of Object.entries(model.ranges.numeric) as [
    NumericInput,
    [number, number],
  ][]) {
    const v = inputs[name];
    if (v !== null && (v < min || v > max)) warnings.push(name);
  }
  for (const [name, seen] of Object.entries(model.ranges.categorical) as [
    "primary_fuel" | "unit_type",
    string[],
  ][]) {
    if (!seen.includes(inputs[name])) warnings.push(name);
  }
  return warnings;
}

const CATEGORY_LABELS: Record<string, string> = {
  primary_fuel: "Primary fuel",
  unit_type: "Unit type",
};

/** A model input or feature in words: "heat_input_mmbtu" → "Heat input", "primary_fuel=Coal" → "Primary fuel: Coal". */
export function featureLabel(name: string) {
  const [field = name, category] = name.split("=");
  const label =
    field in NUMERIC_INPUTS
      ? NUMERIC_INPUTS[field as NumericInput].label
      : field in CONTROLS
        ? CONTROLS[field as Control].label
        : (CATEGORY_LABELS[field] ?? field);
  return category ? `${label}: ${category}` : label;
}

/** Percentage change from `base`; null when the base is 0, where it is undefined. */
export const percentChange = (value: number, base: number) =>
  base ? (value / base - 1) * 100 : null;

/** The most points a sensitivity curve draws. */
export const MAX_SENSITIVITY_POINTS = 401;

/**
 * §6.2: the input values of a sensitivity curve, from `from` to `to` in steps of `step`, as values
 * in the input's own unit or (`asValues` false) as percentages of the baseline value `value0`.
 * The baseline itself is always included. A reversed range is read low to high and a negative,
 * zero, or missing step as its size (or 1); `reversed` and `step` (the step used) let the page say
 * so, and `capped` says the grid stopped at the point limit.
 */
export function sensitivityGrid(
  value0: number,
  from: number,
  to: number,
  step: number,
  asValues: boolean,
  maxPoints = MAX_SENSITIVITY_POINTS,
) {
  const size = Math.abs(step) || 1;
  const reversed = from > to;
  const toValue = (x: number) => (asValues ? x : value0 * (1 + x / 100));
  const grid = [value0];
  for (
    let x = Math.min(from, to);
    x <= Math.max(from, to) + size * 1e-9 && grid.length < maxPoints;
    x += size
  ) {
    grid.push(toValue(x));
  }
  return {
    values: [...new Set(grid)].sort((a, b) => a - b),
    capped: grid.length >= maxPoints,
    reversed,
    step: size,
  };
}

/**
 * §6.2: one model's prediction at each value of one input, every other input held at the
 * baseline, with the input's change from `value0` (its baseline value, or the training median
 * standing in for a missing one), the prediction's absolute and percentage change, and whether
 * the value is outside the training data.
 */
export function sensitivityCurve(
  model: ModelArtifact,
  base: ModelInputs,
  input: NumericInput,
  values: readonly number[],
  value0: number,
) {
  const pred0 = predict(model, base);
  return {
    pred0,
    points: values.map((value) => {
      const inputs = { ...base, [input]: value };
      const prediction = predict(model, inputs);
      return {
        value,
        change: percentChange(value, value0),
        prediction,
        diff: prediction - pred0,
        diffPct: percentChange(prediction, pred0),
        outside: outOfRange(model, inputs).includes(input),
      };
    }),
  };
}

const scaleBy = (v: number | null, pct: number) =>
  v === null ? null : v * (1 + pct / 100);

/** §6.3: the named scenarios, built from the baseline inputs and the chosen percentages. */
export function scenarios(base: ModelInputs, loadPct: number, heatPct: number) {
  const gas = /gas/i.test(base.primary_fuel);
  const fuel = gas ? "Coal" : "Pipeline Natural Gas";
  const scr = base.scr ? 0 : 1;
  const signed = (p: number) => `${p > 0 ? "+" : ""}${p} %`;
  return [
    { name: "Baseline", change: "As reported", inputs: base },
    {
      name: `Gross load ${signed(loadPct)}`,
      change: `Gross load × ${1 + loadPct / 100}`,
      inputs: {
        ...base,
        gross_load_mwh: scaleBy(base.gross_load_mwh, loadPct),
      },
    },
    {
      name: `Heat input ${signed(heatPct)}`,
      change: `Heat input × ${1 + heatPct / 100}`,
      inputs: {
        ...base,
        heat_input_mmbtu: scaleBy(base.heat_input_mmbtu, heatPct),
      },
    },
    {
      name: scr ? "Add SCR" : "Remove SCR",
      change: `Selective catalytic reduction ${scr ? "installed" : "removed"}`,
      inputs: { ...base, scr },
    },
    {
      name: `Fuel: ${fuel}`,
      change: `Primary fuel changed from ${base.primary_fuel}`,
      inputs: { ...base, primary_fuel: fuel },
    },
    {
      name: "High efficiency",
      change: `Heat input × ${1 + heatPct / 100} with the same gross load, plus SCR`,
      inputs: {
        ...base,
        heat_input_mmbtu: scaleBy(base.heat_input_mmbtu, heatPct),
        scr: 1,
      },
    },
  ];
}
export type Scenario = ReturnType<typeof scenarios>[number];

/** "26.4M", "7,839", "0.2266": an input value as the tooltips show it. */
const inputNumber = (v: number) =>
  shortNumber(v) ??
  v.toLocaleString("en-US", {
    maximumSignificantDigits: Math.abs(v) < 1 ? 4 : 6,
  });

/**
 * §6.4 "input values": each input a scenario changes, with its value and the baseline's, e.g.
 * "Heat input 25.1M MMBtu (from 26.4M)", "SCR yes (from no)".
 */
export function changedInputs(base: ModelInputs, inputs: ModelInputs) {
  return (Object.keys(inputs) as (keyof ModelInputs)[]).flatMap((key) => {
    const [now, was] = [inputs[key], base[key]];
    if (now === was) return [];
    if (key in NUMERIC_INPUTS) {
      const unit = NUMERIC_INPUTS[key as NumericInput].unit;
      const show = (v: unknown) =>
        typeof v === "number" ? inputNumber(v) : "missing";
      return [`${featureLabel(key)} ${show(now)} ${unit} (from ${show(was)})`];
    }
    if (key in CONTROLS)
      return [
        `${featureLabel(key)} ${now ? "yes" : "no"} (from ${was ? "yes" : "no"})`,
      ];
    return [`${featureLabel(key)} ${String(now)} (from ${String(was)})`];
  });
}

/** §6.3–§6.4: one model's prediction per scenario, its change from the baseline, and range warnings. */
export function scenarioResults(
  model: ModelArtifact,
  base: ModelInputs,
  list: readonly Scenario[],
) {
  const pred0 = predict(model, base);
  return list.map((scenario) => {
    const prediction = predict(model, scenario.inputs);
    return {
      scenario,
      prediction,
      diff: prediction - pred0,
      diffPct: percentChange(prediction, pred0),
      warnings: outOfRange(model, scenario.inputs),
    };
  });
}
