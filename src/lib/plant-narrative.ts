import type { BadgeVariant } from "~/components/ui/badge";
import { isZeroCarbonFuel } from "~/lib/map-utils";

/** Plain-English plant summaries: grid role, carbon-intensity tier, and EPA equivalencies. */

interface PlantRoleInfo {
  label: string;
  description: string;
}

const PLANT_ROLES = {
  cogen: {
    label: "Cogeneration",
    description:
      "Industrial or commercial plant that also supplies heat or steam on site.",
  },
  zeroCarbon: {
    label: "Zero-carbon",
    description: "Generates without fossil combustion.",
  },
  baseload: {
    label: "Baseload",
    description:
      "Runs most of the year (busiest unit over 4,800 h, or over 1,200 MW).",
  },
  peaker: {
    label: "Peaking",
    description:
      "Runs only at times of high demand (busiest unit under 1,800 h).",
  },
  standby: {
    label: "Standby",
    description: "Reported no operating hours.",
  },
  loadFollowing: {
    label: "Load-following",
    description: "Runs part of the year (busiest unit 1,800 to 4,800 h).",
  },
} satisfies Record<string, PlantRoleInfo>;

export const isOperatingStatus = (status: string | null | undefined) =>
  /^operating\b/i.test(status?.trim() ?? "");

export const hasAirQualityControls = (unit: {
  so2Controls?: string | null;
  noxControls?: string | null;
  pmControls?: string | null;
  hgControls?: string | null;
}) =>
  [unit.so2Controls, unit.noxControls, unit.pmControls, unit.hgControls].some(
    (c) => Boolean(c?.trim()),
  );

/** Plain-English grid role, by category, fuel, and dispatch hours (baseload > 4,800 h/yr, peaker < 1,800 h/yr). */
export function getPlantRole(params: {
  operatingHours?: number;
  capacityMW?: number;
  sourceCategory?: string | null;
  primaryFuels?: string[];
}): PlantRoleInfo {
  const hours = params.operatingHours ?? 0;
  const capacity = params.capacityMW ?? 0;
  if (/cogeneration|industrial|commercial/i.test(params.sourceCategory ?? "")) {
    return PLANT_ROLES.cogen;
  }
  if (params.primaryFuels?.some(isZeroCarbonFuel))
    return PLANT_ROLES.zeroCarbon;
  if (hours >= 4800 || capacity > 1200) return PLANT_ROLES.baseload;
  if (hours > 0 && hours < 1800) return PLANT_ROLES.peaker;
  if (hours === 0 && capacity > 0) return PLANT_ROLES.standby;
  return PLANT_ROLES.loadFollowing;
}

function formatLargeNumber(num: number, suffix: string) {
  if (num <= 0) return `0${suffix}`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M${suffix}`;
  if (num >= 1_000)
    return `${Math.round(num / 1_000).toLocaleString()}K${suffix}`;
  return `${num.toLocaleString()}${suffix}`;
}

/** CO₂ rate tier (lbs/MWh); `typicalOf` names the plants such a rate usually comes from. */
export function getCarbonIntensityTier(intensity: number) {
  const tier: { label: string; variant: BadgeVariant; typicalOf: string } =
    intensity === 0
      ? { label: "Zero CO₂", variant: "success", typicalOf: "" }
      : intensity < 950
        ? {
            label: "Low CO₂ rate",
            variant: "success",
            typicalOf: "typical of combined-cycle gas units",
          }
        : intensity <= 1600
          ? {
              label: "Medium CO₂ rate",
              variant: "warning",
              typicalOf: "typical of simple-cycle gas or oil units",
            }
          : {
              label: "High CO₂ rate",
              variant: "destructive",
              typicalOf: "typical of coal or older steam units",
            };
  return {
    ...tier,
    description:
      intensity === 0
        ? "No direct CO₂ per MWh generated"
        : `${intensity} lbs CO₂ per MWh generated (${tier.label})`,
  };
}

/**
 * EPA Greenhouse Gas Equivalencies: 1 ton CO₂ ≈ 0.217 passenger vehicles/yr,
 * 1 MW capacity ≈ 750 average American homes.
 */
function getHumanEquivalents(capacityMW: number, co2Tons: number) {
  const homes = Math.round(capacityMW * 750);
  const cars = Math.round(co2Tons * 0.217);
  return {
    homesPoweredFormatted: formatLargeNumber(homes, " homes"),
    carsDrivenRaw: cars,
    carsDrivenFormatted: formatLargeNumber(cars, " cars/yr"),
  };
}

export function formatCountyShort(county: string | null | undefined): string {
  if (!county) return "County N/A";
  return `${county.trim().replace(/\s+(?:county|co\.?)$/i, "")} Co.`;
}

const OWNER_ROLE_TAG_RE =
  /\s*\((?:Owner|Operator|Holding Company|Parent|Subsidiary|Joint Owner|Managing Partner)\)/gi;

/** Strips "(Owner)"/"(Operator)" tags from EPA owner strings and dedupes entities. */
export function cleanOwnerOperator(raw: string | null | undefined): string {
  const unique = new Map<string, string>();
  for (const part of (raw ?? "").split("|")) {
    const name = part.replace(OWNER_ROLE_TAG_RE, "").trim();
    if (name && !unique.has(name.toLowerCase())) {
      unique.set(name.toLowerCase(), name);
    }
  }
  return unique.size > 0 ? [...unique.values()].join(", ") : "Owner unlisted";
}

/** 3-part plain-English narrative: headline, grid role, environmental footprint. */
export function generatePlantStory(params: {
  name: string;
  county: string | null;
  stateCode: string;
  nercRegion: string | null;
  sourceCategory: string | null;
  ownerOperator: string | null;
  totalCapacityMW: number;
  primaryFuels: string[];
  co2Tons: number;
  operatingHours: number;
  grossGenerationMWh: number;
  carbonIntensity: number | null;
  hasControls: boolean;
  year?: number | null;
}) {
  const roleInfo = getPlantRole({
    operatingHours: params.operatingHours,
    capacityMW: params.totalCapacityMW,
    sourceCategory: params.sourceCategory,
    primaryFuels: params.primaryFuels,
  });
  const equivalents = getHumanEquivalents(
    params.totalCapacityMW,
    params.co2Tons,
  );
  const fuels = params.primaryFuels.join(" & ") || "fossil fuel";
  const county = params.county?.trim();
  const location = county
    ? `${/\bcounty\b/i.test(county) ? county : `${county} County`}, ${params.stateCode}`
    : params.stateCode;
  const grid = params.nercRegion ?? "regional";
  const article = /^[aeiou]/i.test(roleInfo.label) ? "an" : "a";

  const headline = `${params.name} is a ${
    params.totalCapacityMW > 0
      ? `${params.totalCapacityMW.toLocaleString()} MW `
      : ""
  }${fuels} facility in ${location}, operating as ${article} ${roleInfo.label.toLowerCase()} plant.`;

  let gridStory =
    params.totalCapacityMW > 0
      ? `At full capacity, it can supply electricity to approximately ${equivalents.homesPoweredFormatted}. `
      : "";
  if (params.operatingHours > 0) {
    const pctYear = Math.min(
      Math.round((params.operatingHours / 8760) * 100),
      100,
    );
    const output =
      params.grossGenerationMWh > 0
        ? `${(params.grossGenerationMWh / 1_000_000).toFixed(2)} million MWh`
        : "energy";
    gridStory += `${params.year ? `In ${params.year},` : "In recent reporting,"} it was actively generating power for ${Math.round(params.operatingHours).toLocaleString()} hours (about ${pctYear}% of the year), producing ${output} into the ${grid} electric grid.`;
  } else {
    gridStory += `It operates as part of the ${grid} electric reliability network, managed by ${
      params.ownerOperator
        ? cleanOwnerOperator(params.ownerOperator)
        : "its utility operator"
    }.`;
  }

  let environmentalStory: string;
  if (params.co2Tons > 0) {
    environmentalStory = `The plant emitted ${Math.round(params.co2Tons).toLocaleString()} tons of carbon dioxide (CO₂), which is roughly equivalent to the annual greenhouse emissions of ${equivalents.carsDrivenFormatted}. `;
    if (params.carbonIntensity) {
      environmentalStory += `Its emissions intensity is ${params.carbonIntensity.toLocaleString()} lbs CO₂/MWh, ${getCarbonIntensityTier(params.carbonIntensity).typicalOf}. `;
    }
  } else {
    environmentalStory = `No direct annual carbon emissions were reported for ${params.year ?? "this period"}. `;
  }
  environmentalStory += params.hasControls
    ? "At least one of its units reports SO₂, NOₓ, particulate, or mercury controls (see the Units tab)."
    : "None of its units reports SO₂, NOₓ, particulate, or mercury controls.";

  return { roleInfo, equivalents, headline, gridStory, environmentalStory };
}
