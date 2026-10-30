import assert from "node:assert/strict";
import test from "node:test";

import {
  anova,
  chiSquareUpper,
  describe,
  kruskalWallis,
  mannWhitney,
  meanCi,
  pearson,
  quantile,
  spearman,
  welchT,
} from "./stats";

// Reference values from NumPy 2.5 / SciPy 1.18 on the same samples (see ml/ for the venv).
const a = [3.1, 4.7, 2.2, 5.9, 4.4, 3.8, 6.1, 2.9, 5.0, 4.2];
const b = [5.5, 6.8, 7.1, 4.9, 6.0, 8.2, 5.7, 6.6];
const c = [1.0, 2.5, 2.0, 3.1, 1.7];

const close = (got: number | null | undefined, want: number, tol = 1e-9) =>
  assert.ok(
    got != null && Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)),
    `${got} vs ${want}`,
  );

void test("quantile and describe match NumPy (linear interpolation)", () => {
  const sorted = [...a].sort((x, y) => x - y);
  [0.05, 0.25, 0.5, 0.75, 0.95].forEach((p, i) =>
    close(quantile(sorted, p), [2.515, 3.275, 4.3, 4.925, 6.01][i]!),
  );
  const s = describe([...a, null, null]);
  assert.equal(s.count, 10);
  assert.equal(s.missing, 2);
  close(s.sd, 1.2684636376341263);
  close(s.iqr, 4.925 - 3.275);
  assert.deepEqual(describe([null]).mean, null);
});

void test("correlations match SciPy", () => {
  close(pearson(a.slice(0, 8), b), -0.5043110550780484);
  close(spearman(a.slice(0, 8), b), -0.4761904761904762);
  // Pairwise-complete: a missing value drops its pair, not the whole series.
  close(pearson([1, 2, null, 4], [2, 4, 100, 8]), 1);
  assert.equal(pearson([1, 1, 1], [1, 2, 3]), null);
});

void test("two-sample tests match SciPy", () => {
  const w = welchT(a, b)!;
  close(w.t, -3.8902590962632884);
  close(w.p, 0.001303963953432436, 1e-6);
  const m = mannWhitney(a, b)!;
  close(m.u, 8);
  close(m.p, 0.004465257872326401, 1e-5);
  const ci = meanCi(a)!;
  close(ci.low, 3.3225957768457577, 1e-6);
  close(ci.high, 5.137404223154244, 1e-6);
});

void test("k-sample tests match SciPy", () => {
  const f = anova([a, b, c])!;
  close(f.f, 23.49554062330667);
  close(f.p, 5.625097860848096e-6, 1e-6);
  const k = kruskalWallis([a, b, c])!;
  close(k.h, 15.082995551161641);
  close(k.p, 0.0005306023031697081, 1e-6);
  close(chiSquareUpper(7.3, 3), 0.06292623645904312, 1e-8);
});
