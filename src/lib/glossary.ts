/**
 * Plain definitions for the statistics and model terms the tables use. ReportTable looks up each
 * column header here, so "Test MAE (t)" or "IQR" explains itself on hover without each page
 * wiring it. Order matters: the first match wins, so specific terms come before general ones.
 */
const GLOSSARY: [RegExp, string][] = [
  [
    /no same-year activity/i,
    "Ablation: R² when the model can't use this year's heat input, load, or hours, only last year's values and the unit's attributes.",
  ],
  [
    /\bMAPE\b/,
    "Mean absolute percentage error: how far off a prediction is, as a share of the actual value, on average. Counts unit-years of at least 1 ton.",
  ],
  [
    /\bMAE\b/,
    "Mean absolute error: how many tons off a prediction is, on average. Lower is better.",
  ],
  [
    /\bRMSE\b/,
    "Root mean squared error: like MAE, but large misses count more. Lower is better.",
  ],
  [
    /\bR²/,
    "Share of the differences in the actual values that the model accounts for: 1 is perfect, 0 is no better than always guessing the average.",
  ],
  [
    /\bIQR\b/,
    "Interquartile range: Q3 − Q1, the width of the middle half of the values.",
  ],
  [/^Q1$/, "First quartile: a quarter of the values are below it."],
  [/^Q3$/, "Third quartile: three quarters of the values are below it."],
  [/^P(\d+)$/, "Percentile: that share of the values are at or below it."],
  [/^SD$/, "Standard deviation: how far values typically are from the mean."],
  [
    /95 % CI/,
    "95 % confidence interval: the range the true mean very likely falls in, given how many values there are and how spread out.",
  ],
  [
    /Pooled rate/,
    "Total of the numerator over total of the denominator (e.g. all NOₓ ÷ all heat input), so big units count by their size.",
  ],
  [/^Median$/, "The middle value: half are above it, half below."],
  [
    /^Mean$/,
    "The average. A few very large values can pull it far above the median.",
  ],
  [
    /^p-value$/,
    "How likely a difference this large would be by chance if the groups were really the same. Under 0.05 is usually called significant.",
  ],
  [
    /^Statistic$/,
    "The test's score (t, U, F, or H) and degrees of freedom (df); the p-value is what to read.",
  ],
  [
    /^Missing$/,
    "Unit-years without this value; they are left out of every statistic, never counted as 0.",
  ],
];

/** The plain definition of a table header or term, if it has one. */
export function define(term: string): string | undefined {
  const t = term.trim();
  return GLOSSARY.find(([pattern]) => pattern.test(t))?.[1];
}

/**
 * Terms explained where they appear in sentences, subtitles, and notes (not only table
 * headers). Each pattern matches the term as written in running text.
 */
const IN_TEXT: [RegExp, string][] = [
  [
    /\blog(?:–log)? scales?\b|\bLog–log\b/,
    "Each gridline is 10× the one before, so small and very large values both show on one chart.",
  ],
  [
    /\bPearson\b/,
    "Pearson correlation: how closely two variables follow a straight line, from −1 to 1. Large values can dominate it.",
  ],
  [
    /\bSpearman\b/,
    "Spearman correlation: whether one variable rises as the other does, by rank. Less swayed by a few very large values than Pearson.",
  ],
  [
    /\br = -?\d+(?:\.\d+)?/,
    "Correlation r: from −1 (one falls as the other rises) to 1 (they rise together); 0 means no straight-line link.",
  ],
  [
    /\b(?:kg )?(?:CO₂|SO₂|PM2\.5|O₃|N) eq\b/,
    "Equivalent: the amount of a reference pollutant with the same potential effect, so different pollutants add up within one category.",
  ],
  [
    /\bstandardized\b/i,
    "Inputs rescaled to a common spread, so coefficients compare: each is the effect of a typical-size change in that input.",
  ],
  [
    /α = \d/,
    "Ridge's penalty strength: higher values shrink coefficients toward 0, trading a little fit for steadier predictions.",
  ],
  [
    /\bdepth ≤ \d+|\bleaves ≥ \d+/,
    "Tree limits: at most this many questions per prediction, and at least this many training unit-years behind each answer.",
  ],
  [
    /\b95 % intervals?\b|\bbootstrap\b/i,
    "95 % interval from resampling the test unit-years (bootstrap): the range the score would likely fall in on similar data.",
  ],
  [
    /\bablation\b/i,
    "The same models retrained without this year's heat input, load, and hours, to show how much they rely on them.",
  ],
  [
    /\bpersistence\b/i,
    "A rule, not a trained model: last year's NOₓ rate times this year's heat input.",
  ],
  [/\bMAPE\b/, GLOSSARY.find(([p]) => p.source === "\\bMAPE\\b")![1]],
  [/\bMAE\b/, GLOSSARY.find(([p]) => p.source === "\\bMAE\\b")![1]],
  [/\bR²/, GLOSSARY.find(([p]) => p.source === "\\bR²")![1]],
  [/\bIQR\b/, GLOSSARY.find(([p]) => p.source === "\\bIQR\\b")![1]],
  [
    /\bwhiskers?\b/,
    "Whiskers reach the furthest values within 1.5 × IQR of the box; points beyond are unusual.",
  ],
  [
    /\bmedian\b/,
    "The middle value: half are above it, half below. Unlike the average, a few huge values don't pull it.",
  ],
  [
    /\bTRACI\b/,
    "EPA's Tool for the Reduction and Assessment of Chemical and other environmental Impacts: factors that turn emissions into potential-impact indicators.",
  ],
];

/**
 * Splits `text` into plain runs and glossary terms, the first mention of each term only, so a
 * sentence explains its jargon on hover without underlining every repeat. Pass the same `seen`
 * to several texts (a block of sentences) to mark each term once across all of them.
 */
export function glossSegments(text: string, seen = new Set<string>()) {
  const hits = IN_TEXT.flatMap(([pattern, definition]) => {
    if (seen.has(definition)) return [];
    const m = pattern.exec(text);
    return m
      ? [{ start: m.index, end: m.index + m[0].length, definition }]
      : [];
  }).sort((a, b) => a.start - b.start);
  const out: { text: string; definition?: string }[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start < at) continue; // overlaps an earlier term
    seen.add(h.definition);
    if (h.start > at) out.push({ text: text.slice(at, h.start) });
    out.push({ text: text.slice(h.start, h.end), definition: h.definition });
    at = h.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
