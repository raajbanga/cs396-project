export interface MapFacility {
  id: number;
  name: string;
  stateCode: string;
  county: string | null;
  latitude: number;
  longitude: number;
  nercRegion: string | null;
  sourceCategory: string | null;
  ownerOperator: string | null;
  primaryFuel: string;
  totalCapacityMW: number;
  totalCo2Tons: number;
  unitCount: number;
}

export type MetricMode = "capacity" | "co2" | "uniform";

export interface FuelTheme {
  name: string;
  color: string;
  glow: string;
  variant: "sky" | "destructive" | "warning" | "secondary" | "success" | "default";
}

export function getFuelTheme(fuel: string | null | undefined): FuelTheme {
  const f = (fuel ?? "").toLowerCase();

  if (f.includes("coal") || f.includes("lignite")) {
    return {
      name: "Coal",
      color: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.45)",
      variant: "destructive",
    };
  }
  if (f.includes("gas") || f.includes("methane")) {
    return {
      name: "Natural Gas",
      color: "#10b981",
      glow: "rgba(16, 185, 129, 0.45)",
      variant: "sky",
    };
  }
  if (f.includes("nuclear")) {
    return {
      name: "Nuclear",
      color: "#06b6d4",
      glow: "rgba(6, 182, 212, 0.45)",
      variant: "sky",
    };
  }
  if (f.includes("oil") || f.includes("petroleum") || f.includes("diesel")) {
    return {
      name: "Oil / Petroleum",
      color: "#f43f5e",
      glow: "rgba(244, 63, 94, 0.45)",
      variant: "warning",
    };
  }
  if (f.includes("hydro") || f.includes("water")) {
    return {
      name: "Hydro",
      color: "#3b82f6",
      glow: "rgba(59, 130, 246, 0.45)",
      variant: "success",
    };
  }
  if (f.includes("wind") || f.includes("solar")) {
    return {
      name: "Solar / Wind",
      color: "#84cc16",
      glow: "rgba(132, 204, 22, 0.45)",
      variant: "success",
    };
  }

  return {
    name: fuel && fuel !== "Unknown" ? fuel : "Other / Mixed",
    color: "#a1a1aa",
    glow: "rgba(161, 161, 170, 0.35)",
    variant: "secondary",
  };
}

export const FUEL_CATEGORIES = [
  { label: "Natural Gas", color: "#10b981", query: "Pipeline Natural Gas" },
  { label: "Coal", color: "#f59e0b", query: "Coal" },
  { label: "Nuclear", color: "#06b6d4", query: "Nuclear" },
  { label: "Oil / Petroleum", color: "#f43f5e", query: "Residual Oil" },
  { label: "Other / Mixed", color: "#a1a1aa", query: "ALL" },
] as const;

