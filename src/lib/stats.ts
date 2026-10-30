/**
 * Descriptive statistics and tests for the Analyze page (Phase 2 §4.2, §4.5). Missing values
 * (null) are counted, never treated as 0. Quantiles use linear interpolation between order
 * statistics, NumPy's default (`h = (n − 1)·p`).
 */

export const PERCENTILES = [5, 10, 90, 95] as const;

const isValue = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

/** The p-quantile (0–1) of ascending `sorted`; null when empty. */
export function quantile(sorted: readonly number[], p: number) {
  if (!sorted.length) return null;
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

export const mean = (xs: readonly number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Sample variance (n − 1); null below two values. */
export function variance(xs: readonly number[]) {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

export interface Summary {
  count: number;
  missing: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  sd: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  percentiles: Record<(typeof PERCENTILES)[number], number | null>;
}

/** Count, missing, min/max, mean, median, sample SD, quartiles, IQR, and PERCENTILES. */
export function describe(values: readonly (number | null)[]): Summary {
  const xs = values.filter(isValue).sort((a, b) => a - b);
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  const v = variance(xs);
  return {
    count: xs.length,
    missing: values.length - xs.length,
    min: xs[0] ?? null,
    max: xs.at(-1) ?? null,
    mean: mean(xs),
    median: quantile(xs, 0.5),
    sd: v === null ? null : Math.sqrt(v),
    q1,
    q3,
    iqr: q1 === null || q3 === null ? null : q3 - q1,
    percentiles: Object.fromEntries(
      PERCENTILES.map((p) => [p, quantile(xs, p / 100)]),
    ) as Summary["percentiles"],
  };
}

/** Pairs where both values are reported (pairwise-complete). */
export function completePairs(
  xs: readonly (number | null)[],
  ys: readonly (number | null)[],
) {
  const a: number[] = [];
  const b: number[] = [];
  xs.forEach((x, i) => {
    const y = ys[i];
    if (isValue(x) && isValue(y)) {
      a.push(x);
      b.push(y);
    }
  });
  return [a, b] as const;
}

/** Pearson r over complete pairs; null below three pairs or with a constant side. */
export function pearson(
  xs: readonly (number | null)[],
  ys: readonly (number | null)[],
) {
  const [a, b] = completePairs(xs, ys);
  if (a.length < 3) return null;
  const ma = mean(a)!;
  const mb = mean(b)!;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += (a[i]! - ma) * (b[i]! - mb);
    saa += (a[i]! - ma) ** 2;
    sbb += (b[i]! - mb) ** 2;
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : null;
}

/** 1-based ranks, ties sharing their average rank. */
export function ranks(xs: readonly number[]) {
  const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    for (let k = i; k <= j; k++) out[order[k]![1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return out;
}

/** Spearman ρ: Pearson r of the ranks of the complete pairs. */
export function spearman(
  xs: readonly (number | null)[],
  ys: readonly (number | null)[],
) {
  const [a, b] = completePairs(xs, ys);
  return pearson(ranks(a), ranks(b));
}

// ─── Distributions for p-values ──────────────────────────────────────────

/** ln Γ(x), Lanczos approximation (x > 0). */
function lnGamma(x: number): number {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  g.forEach((c, i) => (a += c / (x + i + 1)));
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
  );
}

/** Continued fraction for the incomplete beta function (Numerical Recipes `betacf`). */
function betaContinuedFraction(a: number, b: number, x: number) {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  d = 1 / (Math.abs(d) < tiny ? tiny : d);
  let h = d;
  for (let m = 1; m <= 300; m++) {
    for (const aa of [
      (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m)),
      (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1)),
    ]) {
      d = 1 + aa * d;
      d = 1 / (Math.abs(d) < tiny ? tiny : d);
      c = 1 + aa / c;
      if (Math.abs(c) < tiny) c = tiny;
      h *= d * c;
    }
    if (Math.abs(d * c - 1) < 1e-14) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    lnGamma(a + b) -
      lnGamma(a) -
      lnGamma(b) +
      a * Math.log(x) +
      b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided p-value of Student's t with `df` degrees of freedom. */
export const tTwoSided = (t: number, df: number) =>
  incompleteBeta(df / (df + t * t), df / 2, 0.5);

/** Upper-tail p-value of F(d1, d2). */
export const fUpper = (f: number, d1: number, d2: number) =>
  f <= 0 ? 1 : incompleteBeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2);

/** Upper-tail p-value of χ²(df): the regularized upper incomplete gamma Q(df/2, x/2). */
export function chiSquareUpper(x: number, df: number) {
  if (x <= 0) return 1;
  const a = df / 2;
  const z = x / 2;
  const front = Math.exp(-z + a * Math.log(z) - lnGamma(a));
  if (z < a + 1) {
    // Series for the lower gamma P, then Q = 1 − P.
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500 && Math.abs(term) > Math.abs(sum) * 1e-15; n++) {
      term *= z / (a + n);
      sum += term;
    }
    return Math.max(0, 1 - front * sum);
  }
  // Continued fraction for Q (Lentz).
  const tiny = 1e-300;
  let b = z + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    d = 1 / (Math.abs(d) < tiny ? tiny : d);
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    h *= d * c;
    if (Math.abs(d * c - 1) < 1e-15) break;
  }
  return front * h;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf, |error| < 1.5e-7). */
export function normalCdf(z: number) {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const y =
    1 -
    t *
      (0.254829592 +
        t *
          (-0.284496736 +
            t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Student-t quantile by bisection on `tTwoSided` (for confidence intervals). */
export function tQuantile(p: number, df: number) {
  let lo = 0;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (1 - tTwoSided(mid, df) / 2 < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── Tests ───────────────────────────────────────────────────────────────

/** Mean with its 95 % t confidence interval; null below two values. */
export function meanCi(xs: readonly number[], level = 0.95) {
  const m = mean(xs);
  const v = variance(xs);
  if (m === null || v === null) return null;
  const half =
    tQuantile(1 - (1 - level) / 2, xs.length - 1) * Math.sqrt(v / xs.length);
  return { mean: m, low: m - half, high: m + half };
}

/** Welch's two-sample t-test (unequal variances). */
export function welchT(a: readonly number[], b: readonly number[]) {
  const va = variance(a);
  const vb = variance(b);
  if (va === null || vb === null) return null;
  const sa = va / a.length;
  const sb = vb / b.length;
  if (sa + sb === 0) return null;
  const t = (mean(a)! - mean(b)!) / Math.sqrt(sa + sb);
  const df =
    (sa + sb) ** 2 / (sa ** 2 / (a.length - 1) + sb ** 2 / (b.length - 1));
  return { t, df, p: tTwoSided(t, df) };
}

/** Mann–Whitney U (two-sided, normal approximation with tie correction). */
export function mannWhitney(a: readonly number[], b: readonly number[]) {
  const n1 = a.length;
  const n2 = b.length;
  if (!n1 || !n2) return null;
  const all = [...a, ...b];
  const r = ranks(all);
  const r1 = r.slice(0, n1).reduce((s, x) => s + x, 0);
  const u = r1 - (n1 * (n1 + 1)) / 2;
  const n = n1 + n2;
  const ties = new Map<number, number>();
  for (const x of all) ties.set(x, (ties.get(x) ?? 0) + 1);
  const tieSum = [...ties.values()].reduce((s, t) => s + t ** 3 - t, 0);
  const sd = Math.sqrt(((n1 * n2) / 12) * (n + 1 - tieSum / (n * (n - 1))));
  if (!sd) return null;
  const z = (u - (n1 * n2) / 2) / sd;
  return { u, z, p: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))) };
}

/** One-way ANOVA across `groups` (each with at least one value). */
export function anova(groups: readonly (readonly number[])[]) {
  const k = groups.length;
  const n = groups.reduce((s, g) => s + g.length, 0);
  if (k < 2 || n <= k) return null;
  const grand = groups.flat().reduce((s, x) => s + x, 0) / n;
  let between = 0;
  let within = 0;
  for (const g of groups) {
    const m = mean(g)!;
    between += g.length * (m - grand) ** 2;
    within += g.reduce((s, x) => s + (x - m) ** 2, 0);
  }
  if (!within) return null;
  const f = between / (k - 1) / (within / (n - k));
  return { f, df1: k - 1, df2: n - k, p: fUpper(f, k - 1, n - k) };
}

/** Kruskal–Wallis H (χ² approximation, no tie correction). */
export function kruskalWallis(groups: readonly (readonly number[])[]) {
  const n = groups.reduce((s, g) => s + g.length, 0);
  if (groups.length < 2 || n < 3) return null;
  const r = ranks(groups.flat());
  let offset = 0;
  let h = 0;
  for (const g of groups) {
    const sum = r.slice(offset, offset + g.length).reduce((s, x) => s + x, 0);
    h += sum ** 2 / g.length;
    offset += g.length;
  }
  h = (12 / (n * (n + 1))) * h - 3 * (n + 1);
  const df = groups.length - 1;
  return { h, df, p: chiSquareUpper(h, df) };
}
