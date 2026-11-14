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
