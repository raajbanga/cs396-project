import { getFuelTheme } from "~/lib/map-utils";
import { SHORT_TON_KG, type TraciFactor } from "~/lib/traci";

/**
 * The Analyze page's vocabulary (Phase 2 §4.1–§4.3, §4.6): the unit-year row every analysis reads,
 * the dimensions it can be grouped by, and the variables it can measure. Derived indicators and
 * TRACI impacts are ordinary variables, so statistics, charts, comparisons, and exports treat
 * them like measured values. A value the inputs cannot define is null (missing), never 0.
 */

/** One unit-year with the prior year's values for the same unit (null when not on file). */
export interface AnalysisRow {
  facilityId: number;
  facilityName: string;
  stateCode: string;
  unitInternalId: string;
  unitId: string;
  unitType: string | null;
  primaryFuel: string | null;
  noxControls: string | null;
  so2Controls: string | null;
  year: number;
  nameplateCapacityMW: number | null;
  operatingHours: number | null;
  grossGenerationMWh: number | null;
  heatInputMMBtu: number | null;
  co2MassTons: number | null;
  so2MassTons: number | null;
  noxMassTons: number | null;
  prevGrossGenerationMWh: number | null;
  prevCo2MassTons: number | null;
  prevSo2MassTons: number | null;
  prevNoxMassTons: number | null;
}

// ─── Dimensions ──────────────────────────────────────────────────────────

/** NOₓ controls as reported, reduced to the post-combustion control that matters most. */
export function noxControlClass(controls: string | null) {
  const c = controls ?? "";
  if (/selective catalytic/i.test(c)) return "SCR";
  if (/non-catalytic/i.test(c)) return "SNCR";
  return c.trim() ? "Combustion controls only" : "None";
}

/** SO₂ controls as reported: a scrubber (FGD), sorbent injection, or none. */
export function so2ControlClass(controls: string | null) {
  const c = controls ?? "";
  if (!c.trim()) return "None";
  if (/fgd|wet lime|dual alkali|magnesium|sodium/i.test(c)) {
    return "Scrubber (FGD)";
  }
  return /sorbent|fluidized/i.test(c) ? "Sorbent injection" : "Other";
}

export const DIMENSIONS = [
  { key: "year", label: "Year", value: (r: AnalysisRow) => String(r.year) },
  { key: "state", label: "State", value: (r: AnalysisRow) => r.stateCode },
  {
    key: "fuelClass",
    label: "Fuel class",
    value: (r: AnalysisRow) => getFuelTheme(r.primaryFuel).name,
  },
  {
    key: "primaryFuel",
    label: "Primary fuel",
    value: (r: AnalysisRow) => r.primaryFuel ?? "Not reported",
  },
  {
    key: "unitType",
    label: "Unit type",
    value: (r: AnalysisRow) => r.unitType ?? "Not reported",
  },
  {
    key: "noxControl",
    label: "NOₓ control",
    value: (r: AnalysisRow) => noxControlClass(r.noxControls),
  },
  {
    key: "so2Control",
    label: "SO₂ control",
    value: (r: AnalysisRow) => so2ControlClass(r.so2Controls),
  },
  {
    key: "facility",
    label: "Facility",
    value: (r: AnalysisRow) => `${r.facilityName} (${r.facilityId})`,
  },
  {
    key: "unit",
    label: "Unit",
    value: (r: AnalysisRow) =>
      `${r.facilityName} (${r.facilityId}) unit ${r.unitId}`,
  },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];
export const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key) as [
  DimensionKey,
  ...DimensionKey[],
];
export const dimension = (key: DimensionKey) =>
  DIMENSIONS.find((d) => d.key === key)!;

// ─── Variables ───────────────────────────────────────────────────────────

/**
 * How a variable combines over a group: `sum` for masses and energy, `mean` for per-unit
 * quantities, `ratio` for rates (Σ numerator ÷ Σ denominator over the rows where the rate is
 * defined, never a mean of rates).
 */
export type Aggregation = "sum" | "mean" | "ratio";

type Value = (r: AnalysisRow) => number | null;

export interface Variable {
  key: string;
  label: string;
  unit: string;
  group: "Measured" | "Derived" | "Year over year" | "TRACI impact";
  definition: string;
  aggregation: Aggregation;
  value: Value;
  /** Numerator and denominator of a ratio variable (scale applied to their quotient). */
  ratio?: { num: Value; den: Value; scale: number };
}

/** What the browser needs about a variable (functions stay on the server). */
export type VariableInfo = Omit<Variable, "value" | "ratio">;

const LB_PER_TON = 2000;
export const hoursInYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 8784 : 8760;

const measured = (
  key: keyof AnalysisRow,
  label: string,
  unit: string,
  aggregation: Aggregation,
  definition: string,
): Variable => ({
  key,
  label,
  unit,
  group: "Measured",
  definition,
  aggregation,
  value: (r) => r[key] as number | null,
});

/** A rate: null when either input is missing or the denominator is 0 (or negative). */
function ratio(
  base: Omit<Variable, "value" | "ratio" | "aggregation">,
  num: Value,
  den: Value,
  scale = 1,
): Variable {
  return {
    ...base,
    aggregation: "ratio",
    ratio: { num, den, scale },
    value: (r) => {
      const n = num(r);
      const d = den(r);
      return n === null || d === null || d <= 0 ? null : (n / d) * scale;
    },
  };
}

const POLLUTANTS = [
  { key: "co2", label: "CO₂", mass: "co2MassTons", prev: "prevCo2MassTons" },
  { key: "so2", label: "SO₂", mass: "so2MassTons", prev: "prevSo2MassTons" },
  { key: "nox", label: "NOₓ", mass: "noxMassTons", prev: "prevNoxMassTons" },
] as const;

const MEASURED: Variable[] = [
  measured(
    "grossGenerationMWh",
    "Gross load",
    "MWh",
    "sum",
    "Electricity generated, as reported to CAMPD.",
  ),
  measured(
    "heatInputMMBtu",
    "Heat input",
    "MMBtu",
    "sum",
    "Fuel heat burned, as reported.",
  ),
  measured(
    "operatingHours",
    "Operating time",
    "hr",
    "mean",
    "Hours the unit operated in the year; groups show the mean per unit-year.",
  ),
  measured(
    "co2MassTons",
    "CO₂ mass",
    "short tons",
    "sum",
    "CO₂ emitted, as reported.",
  ),
  measured(
    "so2MassTons",
    "SO₂ mass",
    "short tons",
    "sum",
    "SO₂ emitted, as reported.",
  ),
  measured(
    "noxMassTons",
    "NOₓ mass",
    "short tons",
    "sum",
    "NOₓ emitted, as reported.",
  ),
  measured(
    "nameplateCapacityMW",
    "Nameplate capacity",
    "MW",
    "mean",
    "The unit's nameplate capacity; groups show the mean per unit-year.",
  ),
];

const load: Value = (r) => r.grossGenerationMWh;

const DERIVED: Variable[] = [
  ...POLLUTANTS.map((p) =>
    ratio(
      {
        key: `${p.key}Intensity`,
        label: `${p.label} intensity`,
        unit: "lb/MWh",
        group: "Derived",
        definition: `${p.label} mass × 2,000 ÷ gross load. Missing when either is missing or gross load is 0.`,
      },
      (r) => r[p.mass],
      load,
      LB_PER_TON,
    ),
  ),
  ratio(
    {
      key: "noxRate",
      label: "NOₓ emission rate",
      unit: "lb/MMBtu",
      group: "Derived",
      definition:
        "NOₓ mass × 2,000 ÷ heat input. Missing when either is missing or heat input is 0.",
    },
    (r) => r.noxMassTons,
    (r) => r.heatInputMMBtu,
    LB_PER_TON,
  ),
  ratio(
    {
      key: "heatRate",
      label: "Heat rate",
      unit: "MMBtu/MWh",
      group: "Derived",
      definition:
        "Heat input ÷ gross load (lower is more efficient). Missing when either is missing or gross load is 0.",
    },
    (r) => r.heatInputMMBtu,
    load,
  ),
  ratio(
    {
      key: "capacityFactor",
      label: "Capacity factor",
      unit: "%",
      group: "Derived",
      definition:
        "Gross load ÷ (nameplate capacity × hours in the year) × 100. Missing without a nameplate capacity; values above 100 % are kept, not clamped.",
    },
    load,
    (r) =>
      r.nameplateCapacityMW === null
        ? null
        : r.nameplateCapacityMW * hoursInYear(r.year),
    100,
  ),
];

type NumericKey = {
  [K in keyof AnalysisRow]: AnalysisRow[K] extends number | null ? K : never;
}[keyof AnalysisRow];

const YEAR_OVER_YEAR: Variable[] = [
  {
    key: "load",
    label: "Gross load",
    unit: "MWh",
    now: "grossGenerationMWh" as NumericKey,
    prev: "prevGrossGenerationMWh" as NumericKey,
  },
  ...POLLUTANTS.map((p) => ({
    key: p.key,
    label: p.label,
    unit: "short tons",
    now: p.mass,
    prev: p.prev,
  })),
].flatMap(({ key, label, unit, now, prev }) => {
  const change: Value = (r) => {
    const a = r[now];
    const b = r[prev];
    return a === null || b === null ? null : a - b;
  };
  return [
    {
      key: `${key}Change`,
      label: `${label} change`,
      unit,
      group: "Year over year" as const,
      definition: `${label} this year minus the same unit's previous year. Missing when either year is missing.`,
      aggregation: "sum" as const,
      value: change,
    },
    ratio(
      {
        key: `${key}ChangePct`,
        label: `${label} change`,
        unit: "%",
        group: "Year over year",
        definition: `(This year − previous year) ÷ previous year × 100 for the same unit. Missing when either year is missing or the previous year is 0.`,
      },
      change,
      (r) => r[prev],
      100,
    ),
  ];
});

/**
 * TRACI impact categories as variables, from the stored factors: Σ mass_kg × factor over the
 * pollutants with a factor in that category. Missing when any of those pollutants is missing
 * (a partial sum would understate the impact). Each category also gets a per-MWh intensity.
 */
function impactVariables(factors: readonly TraciFactor[]): Variable[] {
  const categories = [...new Set(factors.map((f) => f.impactCategory))];
  return categories.flatMap((category) => {
    const terms = factors.filter((f) => f.impactCategory === category);
    const unit = terms[0]!.factorUnit;
    const parts = terms.map((f) => {
      const p = POLLUTANTS.find((x) => x.key === f.pollutant)!;
      return { p, factor: f.factor };
    });
    const impact: Value = (r) => {
      let total = 0;
      for (const { p, factor } of parts) {
        const tons = r[p.mass];
        if (tons === null) return null;
        total += tons * SHORT_TON_KG * factor;
      }
      return total;
    };
    const formula = parts
      .map(
        ({ p, factor }) => `${p.label} kg × ${Number(factor.toPrecision(6))}`,
      )
      .join(" + ");
    const slug = category.replace(/\W+/g, "");
    return [
      {
        key: `impact${slug}`,
        label: category,
        unit,
        group: "TRACI impact" as const,
        definition: `TRACI ${terms[0]!.traciVersion}: ${formula} (short tons × 907.18474 = kg). Potential impact for comparison, not measured harm. Missing when a pollutant in the sum is missing.`,
        aggregation: "sum" as const,
        value: impact,
      },
      ratio(
        {
          key: `impact${slug}PerMWh`,
          label: `${category} per MWh`,
          unit: `${unit}/MWh`,
          group: "TRACI impact",
          definition: `${category} ÷ gross load. Missing when the impact is missing or gross load is 0.`,
        },
        impact,
        load,
      ),
    ];
  });
}

/** Every variable, with the TRACI ones built from `factors`. */
export const buildVariables = (factors: readonly TraciFactor[]) => [
  ...MEASURED,
  ...DERIVED,
  ...YEAR_OVER_YEAR,
  ...impactVariables(factors),
];

export const variableInfo = ({
  value: _v,
  ratio: _r,
  ...info
}: Variable): VariableInfo => info;

/** A variable's value over a group, by its aggregation; null when no row defines it. */
export function aggregate(v: Variable, rows: readonly AnalysisRow[]) {
  let n = 0;
  let sum = 0;
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const x = v.value(r);
    if (x === null) continue;
    n++;
    sum += x;
    if (v.ratio) {
      num += v.ratio.num(r)!;
      den += v.ratio.den(r)!;
    }
  }
  if (!n) return null;
  if (v.ratio) return den > 0 ? (num / den) * v.ratio.scale : null;
  return v.aggregation === "mean" ? sum / n : sum;
}

/** "Total", "Mean", or "Pooled rate": what a group's single value means. */
export const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: "Total",
  mean: "Mean",
  ratio: "Pooled rate",
};

/** Rows grouped by a dimension's value, in first-seen order. */
export function groupRows(rows: readonly AnalysisRow[], key: DimensionKey) {
  const value = dimension(key).value;
  const groups = new Map<string, AnalysisRow[]>();
  for (const r of rows) {
    const g = value(r);
    const list = groups.get(g);
    if (list) list.push(r);
    else groups.set(g, [r]);
  }
  return groups;
}

/** Display a statistic: whole numbers from 1,000 up, else up to 4 significant digits. */
export function formatStat(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v).toLocaleString();
  if (abs === 0) return "0";
  return Number(v.toPrecision(4)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

/** A signed percentage: "+12.3 %", "-4.0 %"; "—" when undefined. */
export const formatPct = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : `${v > 0 ? "+" : ""}${v.toFixed(1)} %`;
