export interface AnnualRecordMetrics {
  year: number;
  operatingHours: number;
  grossGenerationMWh: number;
  heatInputMMBtu: number;
  co2MassTons: number;
  so2MassTons?: number;
  noxMassTons?: number;
}

export interface YearlyRollup extends AnnualRecordMetrics {
  co2IntensityLbsMWh: number | null;
  heatRateMMBtuMWh: number | null;
}

export function computeCo2IntensityLbsMWh(
  co2Tons: number,
  grossGenMWh: number,
): number | null {
  return grossGenMWh > 0
    ? Math.round((co2Tons * 2000.0) / grossGenMWh)
    : null;
}

/** Lowest lbs/MWh wins; zero-emission plants (0 intensity) rank above all fossil plants. */
export function pickCleanestByCarbonIntensity<
  T extends { carbonIntensityLbsMWh: number | null },
>(items: T[]): T | undefined {
  const ranked = items
    .filter((item) => item.carbonIntensityLbsMWh !== null)
    .sort(
      (a, b) =>
        (a.carbonIntensityLbsMWh ?? Number.POSITIVE_INFINITY) -
        (b.carbonIntensityLbsMWh ?? Number.POSITIVE_INFINITY),
    );
  return ranked[0];
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

export function rollupAnnualRecordsByYear<
  T extends AnnualRecordMetrics,
>(records: T[]): Array<
  T & { co2IntensityLbsMWh: number | null; heatRateMMBtuMWh: number | null }
> {
  const map = new Map<number, T>();

  for (const rec of records) {
    const existing = map.get(rec.year);
    if (!existing) {
      map.set(rec.year, { ...rec });
      continue;
    }
    existing.operatingHours += rec.operatingHours;
    existing.grossGenerationMWh += rec.grossGenerationMWh;
    existing.heatInputMMBtu += rec.heatInputMMBtu;
    existing.co2MassTons += rec.co2MassTons;
    if (existing.so2MassTons !== undefined && rec.so2MassTons !== undefined) {
      existing.so2MassTons += rec.so2MassTons;
    }
    if (existing.noxMassTons !== undefined && rec.noxMassTons !== undefined) {
      existing.noxMassTons += rec.noxMassTons;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.year - a.year)
    .map((entry) => ({
      ...entry,
      co2IntensityLbsMWh: computeCo2IntensityLbsMWh(
        entry.co2MassTons,
        entry.grossGenerationMWh,
      ),
      heatRateMMBtuMWh: computeHeatRateMMBtuMWh(
        entry.heatInputMMBtu,
        entry.grossGenerationMWh,
        1,
      ),
    }));
}
