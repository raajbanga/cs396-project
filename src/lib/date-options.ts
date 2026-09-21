import {
  getDefaultCampdDateForYear,
  toIsoDate,
} from "./campd-reporting-period";

export interface DateSelectOption {
  value: string;
  label: string;
}

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function buildDateOptionsForYear(
  year: number,
  publishedThrough?: string,
): DateSelectOption[] {
  const options: DateSelectOption[] = [];
  const lastPublishedIso = publishedThrough ?? toIsoDate(new Date());

  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (value > lastPublishedIso) return options;
      options.push({
        value,
        label: dateLabelFormatter.format(new Date(year, month, day)),
      });
    }
  }

  return options;
}

export function clampDateToYear(
  isoDate: string,
  year: number,
  publishedThrough?: string,
): string {
  const options = buildDateOptionsForYear(year, publishedThrough);
  const fallback =
    options.at(-1)?.value ??
    (publishedThrough
      ? getDefaultCampdDateForYear(year, publishedThrough)
      : `${year}-12-31`);
  const yearPrefix = String(year);
  const monthDay =
    isoDate.length >= 10 ? isoDate.slice(5, 10) : fallback.slice(5);
  const candidate = `${yearPrefix}-${monthDay}`;
  if (options.some((opt) => opt.value === candidate)) return candidate;
  return fallback;
}
