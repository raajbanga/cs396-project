export const CAMPD_EARLIEST_ISO = "1995-01-01";

const QUARTER_END_RE = /quarter ending on (\d{1,2})\/(\d{1,2})\/(\d{4})/i;

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse EPA's 400 copy, e.g. "the quarter ending on 06/30/2026". */
export function parseCampdQuarterEndFromError(message: string): string | null {
  const match = QUARTER_END_RE.exec(message);
  if (!match) return null;
  const month = match[1]!.padStart(2, "0");
  const day = match[2]!.padStart(2, "0");
  const year = match[3]!;
  return `${year}-${month}-${day}`;
}

export function getCampdPublishedYear(publishedThrough: string): number {
  return Number.parseInt(publishedThrough.slice(0, 4), 10);
}

export function getCampdValidMonthsForYear(
  year: number,
  publishedThrough: string,
): number[] {
  const endYear = getCampdPublishedYear(publishedThrough);
  const endMonth = Number.parseInt(publishedThrough.slice(5, 7), 10);
  if (year < endYear) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  if (year > endYear || !endMonth) return [];
  return Array.from({ length: endMonth }, (_, i) => i + 1);
}

export function clampYearToCampdPublished(
  year: number,
  publishedThrough: string,
): number {
  const publishedYear = getCampdPublishedYear(publishedThrough);
  return year > publishedYear ? publishedYear : year;
}

export function clampIsoDateToCampdPublished(
  isoDate: string,
  publishedThrough: string,
): string {
  if (isoDate < CAMPD_EARLIEST_ISO) return CAMPD_EARLIEST_ISO;
  if (isoDate > publishedThrough) return publishedThrough;
  return isoDate;
}

export function getDefaultCampdDateForYear(
  year: number,
  publishedThrough: string,
): string {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (publishedThrough < yearStart) return publishedThrough;
  return yearEnd < publishedThrough ? yearEnd : publishedThrough;
}

export function getDefaultCampdYearOptions(publishedThrough: string): number[] {
  const last = getCampdPublishedYear(publishedThrough);
  return [last, last - 1, last - 2];
}

export function clampCampdDateRange(
  beginDate: string,
  endDate: string,
  publishedThrough: string,
): { beginDate: string; endDate: string } {
  const begin = clampIsoDateToCampdPublished(beginDate, publishedThrough);
  const end = clampIsoDateToCampdPublished(endDate, publishedThrough);
  return end < begin
    ? { beginDate: begin, endDate: begin }
    : { beginDate: begin, endDate: end };
}
