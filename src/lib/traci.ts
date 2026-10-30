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
