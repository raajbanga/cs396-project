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

export type FuelIconKind =
  | "gas"
  | "nuclear"
  | "solar"
  | "wind"
  | "hydro"
  | "fossil"
  | "other";

export interface FuelTheme {
  name: string;
  color: string;
  glow: string;
  variant: "sky" | "destructive" | "warning" | "secondary" | "success" | "default";
  icon: FuelIconKind;
}

function classifyFuel(fuel: string | null | undefined): FuelIconKind {
  const f = (fuel ?? "").toLowerCase();
  if (f.includes("gas") || f.includes("methane")) return "gas";
  if (f.includes("nuclear")) return "nuclear";
  if (f.includes("solar")) return "solar";
  if (f.includes("wind")) return "wind";
  if (f.includes("hydro") || f.includes("water")) return "hydro";
  if (
    f.includes("coal") ||
    f.includes("lignite") ||
    f.includes("oil") ||
    f.includes("petroleum") ||
    f.includes("diesel")
  ) {
    return "fossil";
  }
  return "other";
}

export function isZeroCarbonFuel(fuel: string): boolean {
  const kind = classifyFuel(fuel);
  return kind === "nuclear" || kind === "solar" || kind === "wind" || kind === "hydro";
}

export function getFuelIcon(fuel: string | null | undefined): FuelIconKind {
  return classifyFuel(fuel);
}

export function getFuelTheme(fuel: string | null | undefined): FuelTheme {
  const icon = classifyFuel(fuel);
  const f = (fuel ?? "").toLowerCase();

  if (icon === "fossil" && (f.includes("coal") || f.includes("lignite"))) {
    return {
      name: "Coal",
      color: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.45)",
      variant: "destructive",
      icon,
    };
  }
  if (icon === "gas") {
    return {
      name: "Natural Gas",
      color: "#10b981",
      glow: "rgba(16, 185, 129, 0.45)",
      variant: "sky",
      icon,
    };
  }
  if (icon === "nuclear") {
    return {
      name: "Nuclear",
      color: "#06b6d4",
      glow: "rgba(6, 182, 212, 0.45)",
      variant: "sky",
      icon,
    };
  }
  if (icon === "fossil") {
    return {
      name: "Oil / Petroleum",
      color: "#f43f5e",
      glow: "rgba(244, 63, 94, 0.45)",
      variant: "warning",
      icon,
    };
  }
  if (icon === "hydro") {
    return {
      name: "Hydro",
      color: "#3b82f6",
      glow: "rgba(59, 130, 246, 0.45)",
      variant: "success",
      icon,
    };
  }
  if (icon === "solar" || icon === "wind") {
    return {
      name: "Solar / Wind",
      color: "#84cc16",
      glow: "rgba(132, 204, 22, 0.45)",
      variant: "success",
      icon,
    };
  }

  return {
    name: fuel && fuel !== "Unknown" ? fuel : "Other / Mixed",
    color: "#a1a1aa",
    glow: "rgba(161, 161, 170, 0.35)",
    variant: "secondary",
    icon,
  };
}

export function getMarkerRadius(
  plant: Pick<MapFacility, "totalCapacityMW" | "totalCo2Tons">,
  metricMode: MetricMode,
  options?: {
    zoomBonus?: number;
    min?: number;
    max?: number;
    capacityScale?: number;
    co2Scale?: number;
    uniformBase?: number;
  },
): number {
  const min = options?.min ?? 3;
  const max = options?.max ?? 14;
  const zoomBonus = options?.zoomBonus ?? 0;
  const capacityScale = options?.capacityScale ?? 0.15;
  const co2Scale = options?.co2Scale ?? 0.0035;
  const uniformBase = options?.uniformBase ?? min;

  if (metricMode === "uniform") {
    return uniformBase + zoomBonus;
  }
  if (metricMode === "capacity") {
    return (
      Math.max(min, Math.min(max, Math.sqrt(plant.totalCapacityMW) * capacityScale)) +
      zoomBonus
    );
  }
  return (
    Math.max(min, Math.min(max, Math.sqrt(plant.totalCo2Tons) * co2Scale)) +
    zoomBonus
  );
}

export const FUEL_CATEGORIES = [
  { label: "Natural Gas", color: "#10b981", query: "Pipeline Natural Gas" },
  { label: "Coal", color: "#f59e0b", query: "Coal" },
  { label: "Nuclear", color: "#06b6d4", query: "Nuclear" },
  { label: "Oil / Petroleum", color: "#f43f5e", query: "Residual Oil" },
  { label: "Other / Mixed", color: "#a1a1aa", query: "ALL" },
] as const;
