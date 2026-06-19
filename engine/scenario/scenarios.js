// Spec §1/§5 — Scenarios are named sets of freeze vectors.
import { ALL_VECTORS } from "./freeze_vectors.js";

function vectorsFor(scenario) {
  return ALL_VECTORS.filter((v) => v.scenario === scenario);
}

export const SCENARIOS = {
  US_SANCTION: { name: "US_SANCTION", vectors: vectorsFor("US_SANCTION") },
  CN_CAPITAL_LOCK: { name: "CN_CAPITAL_LOCK", vectors: vectorsFor("CN_CAPITAL_LOCK") },
  GLOBAL_COLLAPSE: { name: "GLOBAL_COLLAPSE", vectors: vectorsFor("GLOBAL_COLLAPSE") },
};

export const SCENARIO_NAMES = Object.keys(SCENARIOS);

export function getScenario(name) {
  const s = SCENARIOS[name];
  if (!s) throw new Error(`Unknown scenario: ${name}`);
  return s;
}
