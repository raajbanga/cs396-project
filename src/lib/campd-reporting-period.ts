export const GRANULARITIES = [
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type Granularity = (typeof GRANULARITIES)[number];

const CAMPD_EARLIEST_ISO = "1995-01-01";
const QUARTER_END_RE = /quarter ending on (\d{1,2})\/(\d{1,2})\/(\d{4})/i;

export const pad2 = (n: number | string) => String(n).padStart(2, "0");
const minIso = (a: string, b: string) => (a < b ? a : b);

export const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Parse EPA's 400 copy, e.g. "the quarter ending on 06/30/2026". */
export function parseCampdQuarterEndFromError(message: string): string | null {
  const match = QUARTER_END_RE.exec(message);
  return match ? `${match[3]}-${pad2(match[1]!)}-${pad2(match[2]!)}` : null;
}

export const getCampdPublishedYear = (publishedThrough: string) =>
  Number.parseInt(publishedThrough.slice(0, 4), 10);

export function getCampdValidMonthsForYear(
  year: number,
  publishedThrough: string,
): number[] {
  const endYear = getCampdPublishedYear(publishedThrough);
  const count =
    year < endYear
      ? 12
      : year > endYear
        ? 0
        : Number.parseInt(publishedThrough.slice(5, 7), 10) || 0;
  return Array.from({ length: count }, (_, i) => i + 1);
}

export const clampIsoDateToCampdPublished = (
  isoDate: string,
  publishedThrough: string,
) =>
  isoDate < CAMPD_EARLIEST_ISO
    ? CAMPD_EARLIEST_ISO
    : minIso(isoDate, publishedThrough);

export const getDefaultCampdDateForYear = (
  year: number,
  publishedThrough: string,
) => minIso(`${year}-12-31`, publishedThrough);

export function clampCampdDateRange(
  beginDate: string,
  endDate: string,
  publishedThrough: string,
) {
  const begin = clampIsoDateToCampdPublished(beginDate, publishedThrough);
  const end = clampIsoDateToCampdPublished(endDate, publishedThrough);
  return { beginDate: begin, endDate: end < begin ? begin : end };
}

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function buildDateOptionsForYear(
  year: number,
  publishedThrough = toIsoDate(new Date()),
) {
  const options: { value: string; label: string }[] = [];
  const day = new Date(Date.UTC(year, 0, 1));
  for (; day.getUTCFullYear() === year; day.setUTCDate(day.getUTCDate() + 1)) {
    const value = day.toISOString().slice(0, 10);
    if (value > publishedThrough) break;
    options.push({ value, label: dateLabelFormatter.format(day) });
  }
  return options;
}

/** Move a date's month/day into `year`, falling back to the year's last published day. */
export function clampDateToYear(
  isoDate: string,
  year: number,
  publishedThrough = toIsoDate(new Date()),
): string {
  const candidate = `${year}${isoDate.slice(4, 10)}`;
  const parsed = Date.parse(candidate);
  const isRealDate =
    /^\d{4}-\d{2}-\d{2}$/.test(candidate) &&
    !Number.isNaN(parsed) &&
    new Date(parsed).toISOString().startsWith(candidate);
  return isRealDate && candidate <= publishedThrough
    ? candidate
    : getDefaultCampdDateForYear(year, publishedThrough);
}
