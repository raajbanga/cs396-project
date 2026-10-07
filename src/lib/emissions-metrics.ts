export interface EmissionTotals {
  operatingHours: number;
  grossGenerationMWh: number;
  heatInputMMBtu: number;
  steamLoadKlb: number;
  co2MassTons: number;
  so2MassTons: number;
  noxMassTons: number;
}

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

export function addTotals(acc: EmissionTotals, rec: EmissionTotals) {
  for (const key of TOTAL_KEYS) acc[key] += rec[key];
  return acc;
}

export const sumTotals = (records: EmissionTotals[]) =>
  records.reduce(addTotals, emptyTotals());

export function computeCo2IntensityLbsMWh(
  co2Tons: number,
  grossGenMWh: number,
): number | null {
  return grossGenMWh > 0 ? Math.round((co2Tons * 2000.0) / grossGenMWh) : null;
}

export function computeHeatRateMMBtuMWh(
  heatInputMMBtu: number,
  grossGenMWh: number,
  decimals = 2,
): number | null {
  return grossGenMWh > 0
    ? Number((heatInputMMBtu / grossGenMWh).toFixed(decimals))
    : null;
}

export function deriveRates(totals: EmissionTotals, heatRateDecimals = 2) {
  return {
    co2IntensityLbsMWh: computeCo2IntensityLbsMWh(
      totals.co2MassTons,
      totals.grossGenerationMWh,
    ),
    heatRateMMBtuMWh: computeHeatRateMMBtuMWh(
      totals.heatInputMMBtu,
      totals.grossGenerationMWh,
      heatRateDecimals,
    ),
  };
}

/**
 * Physical Sanity Audit Thresholds (PRD Section 3.3):
 * Standard thermodynamic and operational bounds for CEMS data.
 */
const AUDIT_THRESHOLDS = {
  ZERO_EMISSIONS_MIN_HEAT_INPUT_MMBTU: 1000,
  PHANTOM_GENERATION_MIN_MWH: 0,
  HEAT_RATE_MIN_MMBTU_MWH: 5.0,
  HEAT_RATE_MAX_MMBTU_MWH: 25.0,
} as const;

export function evaluatePhysicalSanityRules(
  m: EmissionTotals & { heatRateMMBtuMWh: number | null },
) {
  const { HEAT_RATE_MIN_MMBTU_MWH: minRate, HEAT_RATE_MAX_MMBTU_MWH: maxRate } =
    AUDIT_THRESHOLDS;
  const flags: {
    flagType: string;
    severity: "WARN" | "ERROR";
    details: string;
  }[] = [];

  if (
    m.heatInputMMBtu > AUDIT_THRESHOLDS.ZERO_EMISSIONS_MIN_HEAT_INPUT_MMBTU &&
    m.co2MassTons === 0
  ) {
    flags.push({
      flagType: "ZERO_EMISSIONS_HIGH_HEAT",
      severity: "ERROR",
      details: `Heat input was ${m.heatInputMMBtu.toLocaleString()} MMBtu, but CO2 reported was 0.0 tons.`,
    });
  }
  if (
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

export interface AnnualRecordForRollup extends EmissionTotals {
  id: string | number;
  year: number;
  co2IntensityLbsMWh?: number | null;
  heatRateMMBtuMWh?: number | null;
  unit?: { unitId: string; primaryFuel?: string | null } | null;
  dataset?: { name: string; source: string; importedAt: Date } | null;
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
        ...deriveRates(totals, 1),
        year,
        records: yearRecords,
        unitCount: yearRecords.length,
        maxOperatingHours: Math.max(
          ...yearRecords.map((r) => r.operatingHours),
        ),
      };
    });
}
