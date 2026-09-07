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
  badgeClass: string;
}

export function getFuelTheme(fuel: string | null | undefined): FuelTheme {
  const f = (fuel ?? "").toLowerCase();

  if (f.includes("coal")) {
    return {
      name: "Coal",
      color: "#f59e0b", // amber-500
      glow: "rgba(245, 158, 11, 0.45)",
      badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    };
  }
  if (f.includes("gas")) {
    return {
      name: "Natural Gas",
      color: "#10b981", // emerald-500
      glow: "rgba(16, 185, 129, 0.45)",
      badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    };
  }
  if (f.includes("nuclear")) {
    return {
      name: "Nuclear",
      color: "#06b6d4", // cyan-500
      glow: "rgba(6, 182, 212, 0.45)",
      badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    };
  }
  if (f.includes("oil") || f.includes("petroleum") || f.includes("diesel")) {
    return {
      name: "Oil / Petroleum",
      color: "#f43f5e", // rose-500
      glow: "rgba(244, 63, 94, 0.45)",
      badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    };
  }
  if (f.includes("hydro") || f.includes("water")) {
    return {
      name: "Hydro",
      color: "#3b82f6", // blue-500
      glow: "rgba(59, 130, 246, 0.45)",
      badgeClass: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    };
  }
  if (f.includes("wind") || f.includes("solar")) {
    return {
      name: "Solar / Wind",
      color: "#84cc16", // lime-500
      glow: "rgba(132, 204, 22, 0.45)",
      badgeClass: "border-lime-500/30 bg-lime-500/10 text-lime-400",
    };
  }

  return {
    name: fuel && fuel !== "Unknown" ? fuel : "Other / Mixed",
    color: "#a1a1aa", // zinc-400
    glow: "rgba(161, 161, 170, 0.35)",
    badgeClass: "border-zinc-700 bg-zinc-800/50 text-zinc-300",
  };
}

export const FUEL_CATEGORIES = [
  { label: "Natural Gas", color: "#10b981", query: "Pipeline Natural Gas" },
  { label: "Coal", color: "#f59e0b", query: "Coal" },
  { label: "Nuclear", color: "#06b6d4", query: "Nuclear" },
  { label: "Oil / Petroleum", color: "#f43f5e", query: "Residual Oil" },
  { label: "Other / Mixed", color: "#a1a1aa", query: "ALL" },
] as const;

