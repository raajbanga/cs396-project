import assert from "node:assert/strict";
import test from "node:test";
import {
  correlationSentence,
  groupMedianSentence,
  leadersSentence,
  leaderSentence,
  modelSentence,
  outlierSentence,
  scenarioSentences,
  shareSentence,
  spreadSentences,
  strongestPairs,
  trendSentence,
} from "./takeaways";

void test("a trend reads as a rise or fall between the first and last year", () => {
  const points = [
    { year: 2016, value: 1.5e9 },
    { year: 2015, value: 2e9 },
    { year: 2025, value: null },
    { year: 2024, value: 1.5e9 },
  ];
  assert.equal(
    trendSentence({
      label: "CO₂ mass",
      unit: "short tons",
      aggregation: "sum",
      points,
    }),
    "The yearly total of CO₂ mass fell 25 % from 2015 to 2024 (2B → 1.5B short tons).",
  );
  assert.match(
    trendSentence({
      label: "Heat rate",
      unit: "MMBtu/MWh",
      aggregation: "mean",
      points: [
        { year: 2015, value: 10 },
        { year: 2020, value: 10.1 },
      ],
    })!,
    /^The average heat rate stayed about the same/,
  );
  assert.equal(
    trendSentence({ label: "x", unit: "", aggregation: "sum", points: [] }),
    null,
  );
});

void test("shares name the largest group, and its share of rows when they differ", () => {
  assert.equal(
    shareSentence([
      { group: "Coal", value: 60, n: 10 },
      { group: "Gas", value: 40, n: 90 },
    ]),
    "Coal made up 60 % of the total, from 10 % of the unit-years.",
  );
  assert.equal(
    shareSentence([
      { group: "Coal", value: 50, n: 50 },
      { group: "Gas", value: 50, n: 50 },
    ]),
    "Coal made up 50 % of the total.",
  );
  assert.equal(shareSentence([{ group: "Coal", value: 1, n: 1 }]), null);
  assert.match(
    leaderSentence({ group: "Miller (6002)", value: 12 }, 1000)!,
    /Miller \(6002\), accounts for 1.2 % of it/,
  );
});

void test("spread, skew, outliers, and groups read in words", () => {
  const [half, skew] = spreadSentences(
    { count: 100, mean: 500_000, median: 89_000, q1: 13_000, q3: 626_000 },
    "short tons",
  );
  assert.equal(
    half,
    "Half of the unit-years fall between 13K and 626K short tons; the typical (median) one is 89K.",
  );
  assert.match(skew!, /5.6× the typical value/);
  assert.equal(
    spreadSentences({ count: 10, mean: 10, median: 9, q1: 5, q3: 12 }, "t")
      .length,
    1,
  );
  assert.equal(
    outlierSentence(
      { above: 5, below: 0, extreme: [{ label: "Gavin unit 1", value: 100 }] },
      100,
      10,
    ),
    "5 unit-years (5 %) are far above the rest; the most extreme, Gavin unit 1, is 10× the typical value.",
  );
  assert.equal(
    outlierSentence({ above: 0, below: 0, extreme: [] }, 100, 1),
    null,
  );
  assert.equal(
    groupMedianSentence(
      [
        { group: "TX", median: 300 },
        { group: "IL", median: 10 },
        { group: "NY", median: null },
      ],
      "t",
    ),
    "TX has the highest typical value (median 300 t) and IL the lowest (10).",
  );
});

void test("correlations get a strength in words; pairs skip duplicates of one quantity", () => {
  assert.equal(
    correlationSentence(0.72, "Heat input", "NOₓ mass"),
    "A strong link (r = 0.72): unit-years with more heat input tend to have more NOₓ mass.",
  );
  assert.match(
    correlationSentence(-0.35, "a", "b")!,
    /^A moderate link.*less b/,
  );
  assert.match(correlationSentence(0.05, "a", "b")!, /^No clear link/);
  assert.equal(correlationSentence(null, "a", "b"), null);
  const { strongest, negative } = strongestPairs(
    ["A", "B", "C"],
    [
      [1, 0.999, 0.6],
      [0.999, 1, -0.3],
      [0.6, -0.3, 1],
    ],
    1,
  );
  assert.deepEqual(strongest, [{ a: "A", b: "C", r: 0.6 }]);
  assert.deepEqual(negative, { a: "B", b: "C", r: -0.3 });
});

void test("the model verdict gives relative error and the gain over the baseline", () => {
  assert.equal(
    modelSentence(
      { name: "Decision tree", mae: 26.31, r2: 0.95 },
      109.4,
      20.87,
    ),
    "The best model, decision tree, is off by 26.31 t of NOₓ per unit-year on average (21 % of the actual value), 76 % less than the simple baseline. It accounts for 95 % of the variation in NOₓ between unit-years (R²).",
  );
  assert.equal(modelSentence({ name: "x", mae: null, r2: null }, 1, 1), null);
});

void test("impact leaders are grouped by who leads", () => {
  assert.equal(
    leadersSentence([
      { category: "Global warming", group: "TX" },
      { category: "Acidification", group: "TX" },
      { category: "Smog formation", group: "TX" },
      { category: "Human health (particulate)", group: "TX" },
    ]),
    "TX leads all four categories.",
  );
  assert.equal(
    leadersSentence([
      { category: "Global warming", group: "TX" },
      { category: "Acidification", group: "MO" },
      { category: "Smog formation", group: "TX" },
    ]),
    "TX leads global warming and smog formation; MO leads acidification.",
  );
  assert.equal(leadersSentence([]), null);
});

void test("scenarios read as the largest change and the biggest disagreement", () => {
  const rows = [
    { model: "Ridge", scenario: "Baseline", diffPct: 0 },
    { model: "Ridge", scenario: "Add SCR", diffPct: -58.9 },
    { model: "Ridge", scenario: "Gas", diffPct: -68.8 },
    { model: "the tree", scenario: "Baseline", diffPct: 0 },
    { model: "the tree", scenario: "Add SCR", diffPct: 0 },
    { model: "the tree", scenario: "Gas", diffPct: -9.1 },
  ];
  assert.deepEqual(scenarioSentences(rows), [
    "Largest change: Gas with Ridge (-69 %); Gas with the tree (-9 %).",
    "The models disagree most on Gas (Ridge -69 %, the tree -9 %), so treat that effect as uncertain.",
  ]);
  assert.deepEqual(scenarioSentences([]), []);
});
