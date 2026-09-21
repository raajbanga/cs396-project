import {
  computeCo2IntensityLbsMWh,
  computeHeatRateMMBtuMWh,
} from "~/lib/emissions-metrics";

export interface AnnualRecordForRollup {
  id: string | number;
  year: number;
  grossGenerationMWh: number;
  co2MassTons: number;
  so2MassTons: number;
  noxMassTons: number;
  heatInputMMBtu: number;
  operatingHours: number;
  unitInternalId?: string | null;
  co2IntensityLbsMWh?: number | null;
  heatRateMMBtuMWh?: number | null;
  unit?: {
    unitId: string;
    primaryFuel?: string | null;
  } | null;
}

export interface YearlyRollup {
  year: number;
  grossGenerationMWh: number;
  co2MassTons: number;
  so2MassTons: number;
  noxMassTons: number;
  heatInputMMBtu: number;
  operatingHours: number;
  maxOperatingHours: number;
  unitCount: number;
  records: AnnualRecordForRollup[];
  co2IntensityLbsMWh: number | null;
  heatRateMMBtuMWh: number | null;
}

export function buildYearlyRollups(
  annualRecords: AnnualRecordForRollup[] | undefined,
): YearlyRollup[] {
  if (!annualRecords?.length) return [];

  const map = new Map<
    number,
    Omit<YearlyRollup, "co2IntensityLbsMWh" | "heatRateMMBtuMWh">
  >();

  for (const rec of annualRecords) {
    let entry = map.get(rec.year);
    if (!entry) {
      entry = {
        year: rec.year,
        grossGenerationMWh: 0,
        co2MassTons: 0,
        so2MassTons: 0,
        noxMassTons: 0,
        heatInputMMBtu: 0,
        operatingHours: 0,
        maxOperatingHours: 0,
        unitCount: 0,
        records: [],
      };
      map.set(rec.year, entry);
    }
    entry.grossGenerationMWh += rec.grossGenerationMWh;
    entry.co2MassTons += rec.co2MassTons;
    entry.so2MassTons += rec.so2MassTons;
    entry.noxMassTons += rec.noxMassTons;
    entry.heatInputMMBtu += rec.heatInputMMBtu;
    entry.operatingHours += rec.operatingHours;
    if (rec.operatingHours > entry.maxOperatingHours) {
      entry.maxOperatingHours = rec.operatingHours;
    }
    entry.unitCount += 1;
    entry.records.push(rec);
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
