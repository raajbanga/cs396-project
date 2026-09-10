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
  "gas" | "nuclear" | "solar" | "wind" | "hydro" | "fossil" | "other";

export interface FuelTheme {
  name: string;
  color: string;
  glow: string;
  variant:
    "sky" | "destructive" | "warning" | "secondary" | "success" | "default";
  icon: FuelIconKind;
}

const FUEL_STYLES = {
  coal: ["Coal", "#f59e0b", "rgba(245, 158, 11, 0.45)", "destructive"],
  gas: ["Natural Gas", "#10b981", "rgba(16, 185, 129, 0.45)", "sky"],
  nuclear: ["Nuclear", "#06b6d4", "rgba(6, 182, 212, 0.45)", "sky"],
  oil: ["Oil / Petroleum", "#f43f5e", "rgba(244, 63, 94, 0.45)", "warning"],
  hydro: ["Hydro", "#3b82f6", "rgba(59, 130, 246, 0.45)", "success"],
  renewable: ["Solar / Wind", "#84cc16", "rgba(132, 204, 22, 0.45)", "success"],
  other: ["Other / Mixed", "#a1a1aa", "rgba(161, 161, 170, 0.35)", "secondary"],
} as const;

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
  return (
    kind === "nuclear" ||
    kind === "solar" ||
    kind === "wind" ||
    kind === "hydro"
  );
}

export function getFuelIcon(fuel: string | null | undefined): FuelIconKind {
  return classifyFuel(fuel);
}

export function getFuelTheme(fuel: string | null | undefined): FuelTheme {
  const icon = classifyFuel(fuel);
  const f = (fuel ?? "").toLowerCase();
  const style =
    icon === "fossil"
      ? f.includes("coal") || f.includes("lignite")
        ? FUEL_STYLES.coal
        : FUEL_STYLES.oil
      : icon === "solar" || icon === "wind"
        ? FUEL_STYLES.renewable
        : FUEL_STYLES[icon];
  const [defaultName, color, glow, variant] = style;
  return {
    name: icon === "other" && fuel && fuel !== "Unknown" ? fuel : defaultName,
    color,
    glow,
    variant,
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
      Math.max(
        min,
        Math.min(max, Math.sqrt(plant.totalCapacityMW) * capacityScale),
      ) + zoomBonus
    );
  }
  return (
    Math.max(min, Math.min(max, Math.sqrt(plant.totalCo2Tons) * co2Scale)) +
    zoomBonus
  );
}

export const FUEL_CATEGORIES = [
  {
    label: FUEL_STYLES.gas[0],
    color: FUEL_STYLES.gas[1],
    query: "Pipeline Natural Gas",
  },
  { label: FUEL_STYLES.coal[0], color: FUEL_STYLES.coal[1], query: "Coal" },
  {
    label: FUEL_STYLES.nuclear[0],
    color: FUEL_STYLES.nuclear[1],
    query: "Nuclear",
  },
  {
    label: FUEL_STYLES.oil[0],
    color: FUEL_STYLES.oil[1],
    query: "Residual Oil",
  },
] as const;
