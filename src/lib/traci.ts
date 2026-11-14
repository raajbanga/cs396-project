/** TRACI impact assessment (Phase 2 §4.6): factors live in the `traci_factors` table. */

/** CAMPD reports masses in short tons; TRACI factors are per kilogram. */
export const SHORT_TON_KG = 907.18474;

export interface TraciFactor {
  traciVersion: string;
  pollutant: string; // "co2" | "so2" | "nox"
  substance: string;
  cas: string;
  impactCategory: string;
  factor: number;
  factorUnit: string;
}

export const IMPACT_DISCLAIMER =
  "TRACI results are potential impacts for comparing facilities, fuels, and years. They do not measure actual illness, local exposure, or proven environmental damage.";

/**
 * §6.4 "impact indicators" for a predicted NOₓ mass: each TRACI category NOₓ contributes to, as
 * short tons × 907.18474 kg × the characterization factor. NOₓ only (the models predict nothing
 * else), so these are NOₓ's share of each category, not a unit's whole impact.
 */
export function noxImpacts(tons: number, factors: readonly TraciFactor[]) {
  return factors
    .filter((f) => f.pollutant === "nox")
    .map((f) => ({
      category: f.impactCategory,
      unit: f.factorUnit,
      value: tons * SHORT_TON_KG * f.factor,
    }));
}
