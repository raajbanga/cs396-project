export interface EmissionTotals {
  operatingHours: number;
  grossGenerationMWh: number;
  heatInputMMBtu: number;
  steamLoadKlb: number;
  co2MassTons: number;
  so2MassTons: number;
  noxMassTons: number;
}

/** A unit-year's metrics as reported: null when the source left the value out (not the same as 0). */
export type ReportedTotals = { [K in keyof EmissionTotals]: number | null };

export const TOTAL_KEYS = [
  "operatingHours",
  "grossGenerationMWh",
  "heatInputMMBtu",
  "steamLoadKlb",
  "co2MassTons",
  "so2MassTons",
  "noxMassTons",
] as const satisfies readonly (keyof EmissionTotals)[];

export const emptyTotals = (): EmissionTotals => ({
  operatingHours: 0,
  grossGenerationMWh: 0,
  heatInputMMBtu: 0,
  steamLoadKlb: 0,
  co2MassTons: 0,
  so2MassTons: 0,
  noxMassTons: 0,
});

/** Adds `rec` into `acc`; values that weren't reported count as 0 in a total. */
export function addTotals(acc: EmissionTotals, rec: ReportedTotals) {
  for (const key of TOTAL_KEYS) acc[key] += rec[key] ?? 0;
  return acc;
}

export const sumTotals = (records: ReportedTotals[]) =>
  records.reduce(addTotals, emptyTotals());

/** CO₂ intensity (lbs/MWh) and heat rate (MMBtu/MWh); null when an input is missing or gross load is 0. */
export function deriveRates({
  co2MassTons: co2,
  heatInputMMBtu: heat,
  grossGenerationMWh: gen,
}: Pick<
  ReportedTotals,
  "co2MassTons" | "heatInputMMBtu" | "grossGenerationMWh"
>) {
  const ok = gen !== null && gen > 0;
  return {
    co2IntensityLbsMWh:
      ok && co2 !== null ? Math.round((co2 * 2000) / gen) : null,
    heatRateMMBtuMWh:
      ok && heat !== null ? Number((heat / gen).toFixed(2)) : null,
  };
}

/**
 * Physical-sanity audit thresholds:
 * Operational bounds every stored unit-year is checked against.
 */
export const AUDIT_THRESHOLDS = {
  ZERO_EMISSIONS_MIN_HEAT_INPUT_MMBTU: 1000,
  PHANTOM_GENERATION_MIN_MWH: 0,
  HEAT_RATE_MIN_MMBTU_MWH: 5.0,
  HEAT_RATE_MAX_MMBTU_MWH: 25.0,
} as const;

/** The physical-sanity rules and the severity each one logs (filter options and labels). */
export const AUDIT_RULES = [
  {
    flagType: "ZERO_EMISSIONS_HIGH_HEAT",
    severity: "ERROR",
    label: "Heat input but zero CO₂",
  },
  {
    flagType: "CO2_NOT_REPORTED",
    severity: "WARN",
    label: "Heat input but no CO₂ reported",
  },
  {
    flagType: "PHANTOM_GENERATION",
    severity: "ERROR",
    label: "Generation with zero hours",
  },
  {
    flagType: "EXTREME_HEAT_RATE",
    severity: "WARN",
    label: "Heat rate outside 5–25 MMBtu/MWh",
  },
] as const;
export const AUDIT_SEVERITIES = ["ERROR", "WARN"] as const;

export function evaluatePhysicalSanityRules(
  m: ReportedTotals & { heatRateMMBtuMWh: number | null },
) {
  const { HEAT_RATE_MIN_MMBTU_MWH: minRate, HEAT_RATE_MAX_MMBTU_MWH: maxRate } =
    AUDIT_THRESHOLDS;
  const flags: {
    flagType: string;
    severity: "WARN" | "ERROR";
    details: string;
  }[] = [];

  const heat = m.heatInputMMBtu;
  // A reported 0 is implausible (ERROR); a missing value is a reporting gap (WARN).
  if (
    heat !== null &&
    heat > AUDIT_THRESHOLDS.ZERO_EMISSIONS_MIN_HEAT_INPUT_MMBTU
  ) {
    if (m.co2MassTons === 0) {
      flags.push({
        flagType: "ZERO_EMISSIONS_HIGH_HEAT",
        severity: "ERROR",
        details: `Heat input was ${heat.toLocaleString()} MMBtu, but CO2 reported was 0.0 tons.`,
      });
    } else if (m.co2MassTons === null) {
      flags.push({
        flagType: "CO2_NOT_REPORTED",
        severity: "WARN",
        details: `Heat input was ${heat.toLocaleString()} MMBtu, but no CO2 mass was reported.`,
      });
    }
  }
  if (
    m.grossGenerationMWh !== null &&
    m.grossGenerationMWh > AUDIT_THRESHOLDS.PHANTOM_GENERATION_MIN_MWH &&
    m.operatingHours === 0
  ) {
    flags.push({
      flagType: "PHANTOM_GENERATION",
      severity: "ERROR",
      details: `Gross generation was ${m.grossGenerationMWh.toLocaleString()} MWh while operating time was 0 hours.`,
    });
  }
  const rate = m.heatRateMMBtuMWh;
  if (rate !== null && (rate > maxRate || rate < minRate)) {
    flags.push({
      flagType: "EXTREME_HEAT_RATE",
      severity: "WARN",
      details: `Heat rate of ${rate.toFixed(2)} MMBtu/MWh is outside normal thermal envelope (${minRate.toFixed(1)} - ${maxRate.toFixed(1)}).`,
    });
  }
  return flags;
}

/** Lowest lbs/MWh wins; zero-emission plants (0 intensity) rank above all fossil plants. */
export function pickCleanestByCarbonIntensity<
  T extends { carbonIntensityLbsMWh: number | null },
>(items: T[]): T | undefined {
  return items
    .filter((item) => item.carbonIntensityLbsMWh !== null)
    .sort((a, b) => a.carbonIntensityLbsMWh! - b.carbonIntensityLbsMWh!)[0];
}

interface AnnualRecordForRollup extends ReportedTotals {
  id: string | number;
  year: number;
  co2IntensityLbsMWh?: number | null;
  heatRateMMBtuMWh?: number | null;
  unit?: { unitId: string; primaryFuel?: string | null } | null;
  dataset?: { name: string; source: string; importedAt: Date } | null;
  supersededUpload?: { originalFilename: string | null } | null;
}

export type YearlyRollup = ReturnType<typeof buildYearlyRollups>[number];

export function buildYearlyRollups(records: AnnualRecordForRollup[] = []) {
  const byYear = new Map<number, AnnualRecordForRollup[]>();
  for (const rec of records) {
    const list = byYear.get(rec.year);
    if (list) list.push(rec);
    else byYear.set(rec.year, [rec]);
  }

  return [...byYear]
    .sort(([a], [b]) => b - a)
    .map(([year, yearRecords]) => {
      const totals = sumTotals(yearRecords);
      return {
        ...totals,
        ...deriveRates(totals),
        year,
        records: yearRecords,
        unitCount: yearRecords.length,
        maxOperatingHours: Math.max(
          ...yearRecords.map((r) => r.operatingHours ?? 0),
        ),
      };
    });
}
