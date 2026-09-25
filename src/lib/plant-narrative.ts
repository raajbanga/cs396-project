import type { BadgeVariant } from "~/components/ui/badge";
import { isZeroCarbonFuel } from "~/lib/map-utils";

/**
 * Plant Narrative & Real-World Impact Engine: translates technical EPA CEMS
 * data into plain-English stories and tangible real-world equivalents.
 */

export interface PlantRoleInfo {
  role: string;
  badgeLabel: string;
  variant: BadgeVariant;
  icon: "zap" | "clock" | "activity" | "factory" | "power";
  description: string;
}

const PLANT_ROLES = {
  cogen: {
    role: "Industrial Cogenerator",
    badgeLabel: "Industrial Cogen",
    variant: "purple",
    icon: "factory",
    description:
      "Generates electricity while capturing waste heat to power on-site manufacturing, refining, or heating.",
  },
  zeroCarbon: {
    role: "Zero-Carbon Generator",
    badgeLabel: "Zero-Carbon",
    variant: "success",
    icon: "zap",
    description:
      "Generates clean, carbon-free electricity without direct fossil combustion.",
  },
  baseload: {
    role: "Baseload Workhorse",
    badgeLabel: "Baseload Plant",
    variant: "sky",
    icon: "zap",
    description:
      "Runs steadily around the clock 24/7 to provide the continuous foundation of electricity needed by cities and industries.",
  },
  peaker: {
    role: "On-Demand Peaker",
    badgeLabel: "On-Demand Peaker",
    variant: "warning",
    icon: "clock",
    description:
      "Sits on standby most of the year and fires up quickly only during extreme heatwaves, freezes, or supply shortages.",
  },
  standby: {
    role: "Standby / Reserve",
    badgeLabel: "Standby Reserve",
    variant: "secondary",
    icon: "power",
    description:
      "Held in operational reserve or pending seasonal activation with minimal reported generation.",
  },
  loadFollowing: {
    role: "Load-Following Plant",
    badgeLabel: "Load-Following",
    variant: "success",
    icon: "activity",
    description:
      "Ramps power output up and down throughout the day to match fluctuating consumer demand and balance solar/wind.",
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
  Boolean(
    unit.so2Controls ?? unit.noxControls ?? unit.pmControls ?? unit.hgControls,
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

export function getCarbonIntensityTier(intensity: number) {
  const tier: { label: string; variant: BadgeVariant; typicalOf: string } =
    intensity === 0
      ? { label: "Zero-Carbon", variant: "success", typicalOf: "" }
      : intensity < 950
        ? {
            label: "Low Carbon CCGT",
            variant: "success",
            typicalOf:
              "typical of modern, high-efficiency combined-cycle natural gas generation",
          }
        : intensity <= 1600
          ? {
              label: "Intermediate Peaker",
              variant: "warning",
              typicalOf:
                "indicative of load-following or simple-cycle gas peakers",
            }
          : {
              label: "High Carbon Coal",
              variant: "destructive",
              typicalOf:
                "characteristic of carbon-dense coal or older thermal generation",
            };
  return {
    ...tier,
    description:
      intensity === 0
        ? "Zero direct stack CO₂ emissions per MWh generated"
        : `${intensity} lbs CO₂ emitted per MWh generated (${tier.label})`,
  };
}

/**
 * EPA Greenhouse Gas Equivalencies: 1 ton CO₂ ≈ 0.217 passenger vehicles/yr,
 * 1 MW capacity ≈ 750 average American homes.
 */
export function getHumanEquivalents(capacityMW: number, co2Tons: number) {
  const homes = Math.round(capacityMW * 750);
  const cars = Math.round(co2Tons * 0.217);
  return {
    homesPoweredRaw: homes,
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
  const article = /^[aeiou]/i.test(roleInfo.role) ? "an" : "a";

  const headline = `${params.name} is a ${
    params.totalCapacityMW > 0
      ? `${params.totalCapacityMW.toLocaleString()} MW `
      : ""
  }${fuels} facility in ${location}, operating as ${article} ${roleInfo.role}.`;

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
    gridStory += `${params.year ? `In ${params.year},` : "In recent reporting,"} it was actively generating power for ${params.operatingHours.toLocaleString()} hours (about ${pctYear}% of the year), producing ${output} into the ${grid} electric grid.`;
  } else {
    gridStory += `It operates as part of the ${grid} electric reliability network, managed by ${
      params.ownerOperator
        ? cleanOwnerOperator(params.ownerOperator)
        : "its utility operator"
    }.`;
  }

  let environmentalStory: string;
  if (params.co2Tons > 0) {
    environmentalStory = `The plant emitted ${params.co2Tons.toLocaleString()} tons of carbon dioxide (CO₂), which is roughly equivalent to the annual greenhouse emissions of ${equivalents.carsDrivenFormatted}. `;
    if (params.carbonIntensity) {
      environmentalStory += `Its emissions intensity is ${params.carbonIntensity.toLocaleString()} lbs CO₂/MWh, ${getCarbonIntensityTier(params.carbonIntensity).typicalOf}. `;
    }
  } else {
    environmentalStory = `No direct annual carbon emissions were reported for ${params.year ?? "this period"}. `;
  }
  environmentalStory += params.hasControls
    ? "Its smokestacks are equipped with environmental control scrubbers to capture sulfur dioxide (SO₂) and catalytic converters to neutralize smog-forming nitrogen oxides (NOₓ)."
    : "It operates with standard emissions controls configured for its generator units.";

  return { roleInfo, equivalents, headline, gridStory, environmentalStory };
}
