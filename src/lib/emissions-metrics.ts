export function computeCo2IntensityLbsMWh(
  co2Tons: number,
  grossGenMWh: number,
): number | null {
  return grossGenMWh > 0 ? Math.round((co2Tons * 2000.0) / grossGenMWh) : null;
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
