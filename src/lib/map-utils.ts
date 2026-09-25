import type { BadgeVariant } from "~/components/ui/badge";

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

/** Shared frame for the globe and Leaflet map containers. */
export const MAP_FRAME =
  "border-edge/80 relative h-[420px] w-full overflow-hidden rounded-xl border shadow-xs sm:h-[520px] lg:h-[620px]";

export type MetricMode = "capacity" | "co2" | "uniform";

export type FuelIconKind =
  "gas" | "nuclear" | "solar" | "wind" | "hydro" | "fossil" | "other";

const FUEL_STYLES = {
  coal: { name: "Coal", color: "#f59e0b", variant: "destructive" },
  gas: { name: "Natural Gas", color: "#10b981", variant: "sky" },
  nuclear: { name: "Nuclear", color: "#06b6d4", variant: "sky" },
  oil: { name: "Oil / Petroleum", color: "#f43f5e", variant: "warning" },
  hydro: { name: "Hydro", color: "#3b82f6", variant: "success" },
  renewable: { name: "Solar / Wind", color: "#84cc16", variant: "success" },
  other: { name: "Other / Mixed", color: "#a1a1aa", variant: "secondary" },
} satisfies Record<
  string,
  { name: string; color: string; variant: BadgeVariant }
>;

const FUEL_PATTERNS: [FuelIconKind, RegExp][] = [
  ["gas", /gas|methane/],
  ["nuclear", /nuclear/],
  ["solar", /solar/],
  ["wind", /wind/],
  ["hydro", /hydro|water/],
  ["fossil", /coal|lignite|oil|petroleum|diesel/],
];

function classifyFuel(fuel: string | null | undefined): FuelIconKind {
  const f = (fuel ?? "").toLowerCase();
  return FUEL_PATTERNS.find(([, re]) => re.test(f))?.[0] ?? "other";
}

export const isZeroCarbonFuel = (fuel: string) =>
  ["nuclear", "solar", "wind", "hydro"].includes(classifyFuel(fuel));

export function getFuelTheme(fuel: string | null | undefined) {
  const icon = classifyFuel(fuel);
  const style =
    icon === "fossil"
      ? /coal|lignite/i.test(fuel ?? "")
        ? FUEL_STYLES.coal
        : FUEL_STYLES.oil
      : icon === "solar" || icon === "wind"
        ? FUEL_STYLES.renewable
        : FUEL_STYLES[icon];
  return {
    ...style,
    name: icon === "other" && fuel && fuel !== "Unknown" ? fuel : style.name,
    glow: `${style.color}73`,
    icon,
  };
}

export function getMarkerRadius(
  plant: Pick<MapFacility, "totalCapacityMW" | "totalCo2Tons">,
  metricMode: MetricMode,
  {
    zoomBonus = 0,
    min = 3,
    max = 14,
    capacityScale = 0.15,
    co2Scale = 0.0035,
    uniformBase = min,
  }: Partial<
    Record<
      | "zoomBonus"
      | "min"
      | "max"
      | "capacityScale"
      | "co2Scale"
      | "uniformBase",
      number
    >
  > = {},
): number {
  if (metricMode === "uniform") return uniformBase + zoomBonus;
  const raw =
    metricMode === "capacity"
      ? Math.sqrt(plant.totalCapacityMW) * capacityScale
      : Math.sqrt(plant.totalCo2Tons) * co2Scale;
  return Math.max(min, Math.min(max, raw)) + zoomBonus;
}

export const FUEL_CATEGORIES = (
  [
    ["gas", "Pipeline Natural Gas"],
    ["coal", "Coal"],
    ["nuclear", "Nuclear"],
    ["oil", "Residual Oil"],
  ] as const
).map(([key, query]) => ({
  label: FUEL_STYLES[key].name,
  color: FUEL_STYLES[key].color,
  query,
}));
