/**
 * Plant Narrative & Real-World Impact Engine
 *
 * Translates complex technical EPA CEMS data into plain-English stories
 * and tangible real-world equivalents for laypeople.
 */

export interface PlantRoleInfo {
  role: string;
  badgeLabel: string;
  badgeVariant: "sky" | "warning" | "success" | "secondary" | "destructive";
  badgeClass: string;
  icon: "zap" | "clock" | "activity" | "factory" | "power";
  description: string;
}

/**
 * Determine the plain-English grid role of a power plant
 */
export function getPlantRole(params: {
  operatingHours?: number;
  capacityMW?: number;
  sourceCategory?: string | null;
  primaryFuels?: string[];
}): PlantRoleInfo {
  const category = (params.sourceCategory ?? "").toLowerCase();
  const hours = params.operatingHours ?? 0;
  const fuels = params.primaryFuels?.map((f) => f.toLowerCase()) ?? [];

  // Cogeneration / Industrial
  if (
    category.includes("cogeneration") ||
    category.includes("industrial") ||
    category.includes("commercial")
  ) {
    return {
      role: "Industrial Cogenerator",
      badgeLabel: "Industrial Cogen",
      badgeVariant: "secondary",
      badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/20",
      icon: "factory",
      description:
        "Generates electricity while capturing waste heat to power on-site manufacturing, refining, or heating.",
    };
  }

  // Zero-carbon generation
  if (
    fuels.some(
      (f) =>
        f.includes("solar") ||
        f.includes("wind") ||
        f.includes("hydro") ||
        f.includes("nuclear"),
    )
  ) {
    return {
      role: "Zero-Carbon Generator",
      badgeLabel: "Zero-Carbon",
      badgeVariant: "success",
      badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      icon: "zap",
      description:
        "Generates clean, carbon-free electricity without direct fossil combustion.",
    };
  }

  // Peaking plant: runs fewer than 1,500 hours/year (or mostly sits idle until demand surges)
  if (hours > 0 && hours < 1800) {
    return {
      role: "On-Demand Peaker",
      badgeLabel: "On-Demand Peaker",
      badgeVariant: "warning",
      badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/20",
      icon: "clock",
      description:
        "Sits on standby most of the year and fires up quickly only during extreme heatwaves, freezes, or supply shortages.",
    };
  }

  // Baseload workhorse: runs continuously (> 5,000 hours/year)
  if (hours >= 4800 || (params.capacityMW ?? 0) > 1200) {
    return {
      role: "Baseload Workhorse",
      badgeLabel: "Baseload Plant",
      badgeVariant: "sky",
      badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/20",
      icon: "zap",
      description:
        "Runs steadily around the clock 24/7 to provide the continuous foundation of electricity needed by cities and industries.",
    };
  }

  // Standby or minimal operation
  if (hours === 0 && (params.capacityMW ?? 0) > 0) {
    return {
      role: "Standby / Reserve",
      badgeLabel: "Standby Reserve",
      badgeVariant: "secondary",
      badgeClass: "bg-surface-2 text-fg-muted border-edge",
      icon: "power",
      description:
        "Held in operational reserve or pending seasonal activation with minimal reported generation.",
    };
  }

  // Default: Load-following / Intermediate
  return {
    role: "Load-Following Plant",
    badgeLabel: "Load-Following",
    badgeVariant: "success",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    icon: "activity",
    description:
      "Ramps power output up and down throughout the day to match fluctuating consumer demand and balance solar/wind.",
  };
}

export function formatLargeNumber(num: number, suffix = "") {
  if (num <= 0) return "0" + suffix;
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M" + suffix;
  }
  if (num >= 1_000) {
    return Math.round(num / 1_000).toLocaleString() + "K" + suffix;
  }
  return num.toLocaleString() + suffix;
}

export interface CarbonIntensityTier {
  tier: "clean" | "intermediate" | "high" | "unknown";
  label: string;
  badgeText: string;
  badgeClass: string;
  description: string;
  narrativeDescription: string;
}

export function getCarbonIntensityTier(intensity: number | null): CarbonIntensityTier {
  if (intensity === null || intensity === 0) {
    return {
      tier: "unknown",
      label: "Zero / Unreported",
      badgeText: "Zero / Clean",
      badgeClass: "bg-surface-2 text-fg-muted border-edge",
      description: "No direct fossil carbon intensity reported.",
      narrativeDescription: "No direct annual carbon emissions were reported.",
    };
  }
  if (intensity < 950) {
    return {
      tier: "clean",
      label: "Low Carbon CCGT",
      badgeText: `${intensity} lbs/MWh • Clean Gas`,
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      description: `${intensity} lbs CO2 emitted per MWh generated (Highly efficient CCGT)`,
      narrativeDescription: `Its emissions intensity is ${intensity.toLocaleString()} lbs CO2/MWh, typical of modern, high-efficiency combined-cycle natural gas generation.`,
    };
  }
  if (intensity <= 1600) {
    return {
      tier: "intermediate",
      label: "Intermediate Peaker",
      badgeText: `${intensity} lbs/MWh • Peaker`,
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      description: `${intensity} lbs CO2 emitted per MWh generated (Peaker / Intermediate)`,
      narrativeDescription: `Its emissions intensity is ${intensity.toLocaleString()} lbs CO2/MWh, indicative of load-following or simple-cycle gas peakers.`,
    };
  }
  return {
    tier: "high",
    label: "High Carbon Coal",
    badgeText: `${intensity} lbs/MWh • High Carbon`,
    badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    description: `${intensity} lbs CO2 emitted per MWh generated (High-emission fossil / coal)`,
    narrativeDescription: `Its emissions intensity is ${intensity.toLocaleString()} lbs CO2/MWh, characteristic of carbon-dense coal or older thermal generation.`,
  };
}

/**
 * Translates megawatts and carbon tonnage into tangible, real-world human equivalents.
 * Formulas derived from EPA Greenhouse Gas Equivalencies Calculator:
 * - 1 ton CO2 ≈ 0.217 passenger vehicles driven for 1 year
 * - 1 ton CO2 ≈ 16.5 tree seedlings grown for 10 years
 * - 1 MW capacity ≈ 750 average American homes powered
 */
export function getHumanEquivalents(capacityMW: number, co2Tons: number) {
  const homes = Math.round(capacityMW * 750);
  const cars = Math.round(co2Tons * 0.217);
  const trees = Math.round(co2Tons * 16.5);

  return {
    homesPoweredRaw: homes,
    homesPoweredFormatted: formatLargeNumber(homes, " homes"),
    carsDrivenRaw: cars,
    carsDrivenFormatted: formatLargeNumber(cars, " cars/yr"),
    treesNeededRaw: trees,
    treesNeededFormatted: formatLargeNumber(trees, " trees"),
  };
}

/**
 * Generate a 3-part plain-English storytelling narrative for a facility
 */
export function generatePlantStory(params: {
  name: string;
  county: string | null;
  stateCode: string;
  nercRegion: string | null;
  sourceCategory: string | null;
  ownerOperator: string | null;
  totalCapacityMW: number;
  unitCount: number;
  primaryFuels: string[];
  co2Tons: number;
  operatingHours: number;
  grossGenerationMWh: number;
  carbonIntensity: number | null;
  hasControls: boolean;
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

  const fuelString =
    params.primaryFuels.length > 0
      ? params.primaryFuels.join(" & ")
      : "fossil fuel";

  const locationString = params.county
    ? `${params.county} County, ${params.stateCode}`
    : params.stateCode;

  // 1. Headline
  const headline = `${params.name} is a ${
    params.totalCapacityMW > 0
      ? `${params.totalCapacityMW.toLocaleString()} MW `
      : ""
  }${fuelString} facility in ${locationString}, operating as a ${roleInfo.role}.`;

  // 2. What it does on the grid
  let gridStory = "";
  if (params.totalCapacityMW > 0) {
    gridStory = `At full capacity, it can supply electricity to approximately ${equivalents.homesPoweredFormatted}. `;
  }
  if (params.operatingHours > 0) {
    const pctYear = Math.min(
      Math.round((params.operatingHours / 8760) * 100),
      100,
    );
    gridStory += `In 2022, it was actively generating power for ${params.operatingHours.toLocaleString()} hours (about ${pctYear}% of the year), producing ${
      params.grossGenerationMWh > 0
        ? `${(params.grossGenerationMWh / 1_000_000).toFixed(2)} million MWh`
        : "energy"
    } into the ${params.nercRegion ?? "regional"} electric grid.`;
  } else {
    gridStory += `It operates as part of the ${
      params.nercRegion ?? "regional"
    } electric reliability network, managed by ${
      params.ownerOperator ?? "its utility operator"
    }.`;
  }

  // 3. Environmental footprint & Air quality
  let environmentalStory = "";
  if (params.co2Tons > 0) {
    environmentalStory = `The plant emitted ${params.co2Tons.toLocaleString()} tons of carbon dioxide (CO2), which is roughly equivalent to the annual greenhouse emissions of ${equivalents.carsDrivenFormatted}. `;
    if (params.carbonIntensity) {
      const tier = getCarbonIntensityTier(params.carbonIntensity);
      environmentalStory += `${tier.narrativeDescription} `;
    }
  } else {
    environmentalStory =
      "No direct annual carbon emissions were reported for 2022. ";
  }

  if (params.hasControls) {
    environmentalStory +=
      "Its smokestacks are equipped with environmental control scrubbers to capture sulfur dioxide (SO2) and catalytic converters to neutralize smog-forming nitrogen oxides (NOx).";
  } else {
    environmentalStory +=
      "It operates with standard emissions controls configured for its generator units.";
  }

  return {
    roleInfo,
    equivalents,
    headline,
    gridStory,
    environmentalStory,
  };
}
