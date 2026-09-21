export interface DateSelectOption {
  value: string;
  label: string;
}

const dateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function buildDateOptionsForYear(year: number): DateSelectOption[] {
  const options: DateSelectOption[] = [];

  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      options.push({
        value,
        label: dateLabelFormatter.format(new Date(year, month, day)),
      });
    }
  }

  return options;
}

export function clampDateToYear(isoDate: string, year: number): string {
  const yearPrefix = String(year);
  if (isoDate.startsWith(`${yearPrefix}-`)) return isoDate;

  const monthDay = isoDate.length >= 10 ? isoDate.slice(5, 10) : "07-15";
  const candidate = `${yearPrefix}-${monthDay}`;
  const isValid = buildDateOptionsForYear(year).some(
    (opt) => opt.value === candidate,
  );
  return isValid ? candidate : `${yearPrefix}-07-15`;
}
