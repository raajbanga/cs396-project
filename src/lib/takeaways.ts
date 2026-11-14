/**
 * Plain-language readings of the analysis results: the sentences each Analyze and Predict tab
 * opens with, so a reader gets the answer before the chart and the table. Pure functions over
 * numbers the tabs already have; every one returns null when there's nothing worth saying.
 */
import type { Aggregation } from "./analysis";
import { formatStat } from "./analysis";

/** "18 %", "0.4 %", "103 %". */
const pct = (share: number) => {
  const p = Math.abs(share * 100);
  return `${p >= 10 ? Math.round(p) : Number(p.toPrecision(2))} %`;
};

/** "5.6×", "103×": a ratio to a sensible precision. */
const times = (x: number) =>
  `${x >= 10 ? Math.round(x).toLocaleString() : x.toFixed(1)}×`;

/** "Total CO₂ mass", "The average heat rate", "The pooled NOₓ rate". */
export function measureName(label: string, aggregation: Aggregation) {
  const l = label.charAt(0).toLowerCase() + label.slice(1);
  // Chemical names (CO₂, SO₂, NOₓ) keep their capitals.
  const lower = /^[A-Z][A-Z]/.test(label) ? label : l;
  return aggregation === "sum"
    ? `Total ${lower}`
    : aggregation === "mean"
      ? `The average ${lower}`
      : `The pooled ${lower}`;
}

/** "Total CO₂ mass fell 25 % from 2015 to 2025 (2.1B → 1.6B short tons)." */
export function trendSentence({
  label,
  unit,
  aggregation,
  points,
}: {
  label: string;
  unit: string;
  aggregation: Aggregation;
  points: { year: number; value: number | null }[];
}) {
  const known = points
    .filter((p): p is { year: number; value: number } => p.value !== null)
    .sort((a, b) => a.year - b.year);
  const first = known[0];
  const last = known.at(-1);
  if (!first || !last || first.year === last.year || first.value === 0)
    return null;
  const change = (last.value - first.value) / Math.abs(first.value);
  const span = `from ${first.year} to ${last.year} (${formatStat(first.value)} → ${formatStat(last.value)} ${unit})`;
  // Per year: "the yearly total", so it doesn't read as the overall total said just before.
  const what =
    aggregation === "sum"
      ? `The yearly total of ${/^[A-Z][A-Z]/.test(label) ? label : label.toLowerCase()}`
      : measureName(label, aggregation);
  return Math.abs(change) < 0.02
    ? `${what} stayed about the same ${span}.`
    : `${what} ${change < 0 ? "fell" : "rose"} ${pct(change)} ${span}.`;
}

/** "Coal made up 58 % of the total from 12 % of the unit-years." Totals only. */
export function shareSentence(
  groups: { group: string; value: number | null; n: number }[],
) {
  const total = groups.reduce((s, g) => s + (g.value ?? 0), 0);
  const count = groups.reduce((s, g) => s + g.n, 0);
  const top = [...groups].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  if (!top?.value || total <= 0 || groups.length < 2 || !count) return null;
  const share = top.value / total;
  const ofRows = top.n / count;
  return `${top.group} made up ${pct(share)} of the total${
    Math.abs(share - ofRows) > 0.1
      ? `, from ${pct(ofRows)} of the unit-years`
      : ""
  }.`;
}

/** "The largest, James H Miller Jr (6002), was 1.2 % of it on its own." Totals only. */
export function leaderSentence(
  top: { group: string; value: number | null } | undefined,
  total: number,
  noun = "facility",
) {
  if (!top?.value || total <= 0) return null;
  return `The largest ${noun}, ${top.group}, accounts for ${pct(top.value / total)} of it on its own (${formatStat(top.value)}).`;
}

interface Spread {
  count: number;
  mean: number | null;
  median: number | null;
  q1: number | null;
  q3: number | null;
}

/**
 * "Half of the unit-years fall between 13K and 626K short tons; the typical one is 89K." Plus,
 * when the mean is far from the median, why: a few large values pull it.
 */
export function spreadSentences(s: Spread, unit: string) {
  const out: string[] = [];
  if (s.q1 === null || s.q3 === null || s.median === null || !s.count)
    return out;
  out.push(
    `Half of the unit-years fall between ${formatStat(s.q1)} and ${formatStat(s.q3)} ${unit}; the typical (median) one is ${formatStat(s.median)}.`,
  );
  if (s.mean !== null && s.median > 0 && s.mean / s.median >= 2)
    out.push(
      `The average (${formatStat(s.mean)}) is ${times(s.mean / s.median)} the typical value: a few very large unit-years pull it up, so the median is the better summary.`,
    );
  return out;
}

/** "2,077 unit-years (5 %) are far above the rest; the most extreme is …, 103× the median." */
export function outlierSentence(
  u: {
    above: number;
    below: number;
    extreme: { label: string; value: number }[];
  },
  count: number,
  median: number | null,
) {
  const n = u.above + u.below;
  if (!n || !count) return null;
  const top = u.extreme[0];
  const where =
    u.below === 0 ? "far above" : u.above === 0 ? "far below" : "far from";
  return `${formatStat(n)} unit-years (${pct(n / count)}) are ${where} the rest${
    top && median
      ? `; the most extreme, ${top.label}, is ${times(top.value / median)} the typical value`
      : ""
  }.`;
}

/** "TX has the highest median (364K short tons) and IL the lowest (14.4K)." */
export function groupMedianSentence(
  groups: { group: string; median: number | null }[],
  unit: string,
) {
  const known = groups.filter(
    (g): g is { group: string; median: number } => g.median !== null,
  );
  if (known.length < 2) return null;
  const sorted = [...known].sort((a, b) => b.median - a.median);
  const hi = sorted[0]!;
  const lo = sorted.at(-1)!;
  return `${hi.group} has the highest typical value (median ${formatStat(hi.median)} ${unit}) and ${lo.group} the lowest (${formatStat(lo.median)}).`;
}

/** How strong a correlation is, in words. */
export function correlationStrength(r: number) {
  const a = Math.abs(r);
  return a < 0.1
    ? "no"
    : a < 0.3
      ? "a weak"
      : a < 0.5
        ? "a moderate"
        : a < 0.7
          ? "a fairly strong"
          : "a strong";
}

/** "A strong link (r = 0.72): unit-years with more heat input tend to have more NOₓ mass." */
export function correlationSentence(
  r: number | null | undefined,
  x: string,
  y: string,
) {
  if (r === null || r === undefined || !Number.isFinite(r)) return null;
  const strength = correlationStrength(r);
  const lower = (s: string) =>
    /^[A-Z][A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
  if (strength === "no")
    return `No clear link (r = ${r.toFixed(2)}): ${lower(y)} doesn't move with ${lower(x)}.`;
  return `${strength.charAt(0).toUpperCase()}${strength.slice(1)} link (r = ${r.toFixed(2)}): unit-years with more ${lower(x)} tend to have ${r > 0 ? "more" : "less"} ${lower(y)}.`;
}

/**
 * The strongest pairs of a correlation matrix, skipping each variable with itself and pairs
 * that are the same quantity twice (|r| ≥ 0.995, e.g. CO₂ intensity and heat rate).
 */
export function strongestPairs(
  labels: string[],
  matrix: (number | null)[][],
  count = 2,
) {
  const pairs: { a: string; b: string; r: number }[] = [];
  matrix.forEach((row, i) =>
    row.forEach((r, j) => {
      if (j > i && r !== null && Math.abs(r) < 0.995)
        pairs.push({ a: labels[i]!, b: labels[j]!, r });
    }),
  );
  const strongest = [...pairs]
    .sort((p, q) => Math.abs(q.r) - Math.abs(p.r))
    .slice(0, count);
  const negative = pairs.filter((p) => p.r < -0.1).sort((p, q) => p.r - q.r)[0];
  return { strongest, negative };
}

/**
 * "The best model, decision tree, is off by 26.3 t of NOₓ per unit-year on average (21 % of the
 * actual value), 76 % less than the simple baseline. …" Relative error is the scale that reads
 * right: most units are small, so tons alone look large against a typical unit.
 */
export function modelSentence(
  best: { name: string; mae: number | null; r2: number | null },
  baselineMae: number | null,
  mapePct: number | null,
) {
  if (best.mae === null) return null;
  let s = `The best model, ${best.name.charAt(0).toLowerCase()}${best.name.slice(1)}, is off by ${formatStat(best.mae)} t of NOₓ per unit-year on average`;
  if (mapePct !== null) s += ` (${pct(mapePct / 100)} of the actual value)`;
  if (baselineMae)
    s += `, ${pct((baselineMae - best.mae) / baselineMae)} less than the simple baseline`;
  s += ".";
  if (best.r2 !== null)
    s += ` It accounts for ${pct(best.r2)} of the variation in NOₓ between unit-years (R²).`;
  return s;
}
