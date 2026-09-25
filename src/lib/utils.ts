import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
