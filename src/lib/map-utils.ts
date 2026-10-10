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
  "border-edge relative h-[420px] w-full overflow-hidden rounded-md border sm:h-[520px] lg:h-[620px]";

export type MetricMode = "capacity" | "co2" | "uniform";

type FuelKind =
  "gas" | "nuclear" | "solar" | "wind" | "hydro" | "fossil" | "other";

/** One color per fuel family, shared by the maps, their legend, and every fuel dot in the tables. */
const FUEL_STYLES = {
  coal: { name: "Coal", color: "#f59e0b" },
  gas: { name: "Natural Gas", color: "#10b981" },
  nuclear: { name: "Nuclear", color: "#06b6d4" },
  oil: { name: "Oil / Petroleum", color: "#f43f5e" },
  hydro: { name: "Hydro", color: "#3b82f6" },
  renewable: { name: "Solar / Wind", color: "#84cc16" },
  other: { name: "Other / Mixed", color: "#a1a1aa" },
};

const FUEL_PATTERNS: [FuelKind, RegExp][] = [
  ["gas", /gas|methane/],
  ["nuclear", /nuclear/],
  ["solar", /solar/],
  ["wind", /wind/],
  ["hydro", /hydro|water/],
  ["fossil", /coal|lignite|oil|petroleum|diesel/],
];

function classifyFuel(fuel: string | null | undefined): FuelKind {
  const f = (fuel ?? "").toLowerCase();
  return FUEL_PATTERNS.find(([, re]) => re.test(f))?.[0] ?? "other";
}

export const isZeroCarbonFuel = (fuel: string) =>
  ["nuclear", "solar", "wind", "hydro"].includes(classifyFuel(fuel));

export function getFuelTheme(fuel: string | null | undefined) {
  const kind = classifyFuel(fuel);
  const style =
    kind === "fossil"
      ? /coal|lignite/i.test(fuel ?? "")
        ? FUEL_STYLES.coal
        : FUEL_STYLES.oil
      : kind === "solar" || kind === "wind"
        ? FUEL_STYLES.renewable
        : FUEL_STYLES[kind];
  return {
    ...style,
    name: kind === "other" && fuel && fuel !== "Unknown" ? fuel : style.name,
    glow: `${style.color}73`,
  };
}

/** The theme tokens from globals.css, read at draw time so canvas and Leaflet layers match the page. */
export function readThemeColors() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--${name}`).trim();
  return {
    canvas: token("canvas"),
    surface: token("surface"),
    surface2: token("surface-2"),
    edge: token("edge"),
    fg: token("fg"),
  };
}

/** "#rrggbb" at the given opacity, for canvas strokes and fills. */
export function withAlpha(hex: string, alpha: number) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
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

/** The map's fuel chips (by `getFuelTheme` class); CAMPD covers combustion units only, so no nuclear chip. */
export const FUEL_CATEGORIES = (["gas", "coal", "oil"] as const).map(
  (key) => FUEL_STYLES[key],
);
