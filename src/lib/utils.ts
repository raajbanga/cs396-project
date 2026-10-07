import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Distinct non-empty strings, in first-seen order. */
export const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values)].filter((v): v is string => Boolean(v));

/** Locale-formatted quantity with an optional unit; zero/missing renders `fallback`. */
export function formatQuantity(
  value: number | null | undefined,
  unit = "",
  { fallback = "—", digits = 0 } = {},
) {
  if (!value) return fallback;
  const num = value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
  return unit ? `${num} ${unit}` : num;
}
