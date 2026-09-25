export interface EmissionTotals {
  operatingHours: number;
  grossGenerationMWh: number;
  heatInputMMBtu: number;
  co2MassTons: number;
  so2MassTons: number;
  noxMassTons: number;
}

export const TOTAL_KEYS = [
  "operatingHours",
  "grossGenerationMWh",
  "heatInputMMBtu",
  "co2MassTons",
  "so2MassTons",
  "noxMassTons",
] as const satisfies readonly (keyof EmissionTotals)[];

export const emptyTotals = (): EmissionTotals => ({
  operatingHours: 0,
  grossGenerationMWh: 0,
  heatInputMMBtu: 0,
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
