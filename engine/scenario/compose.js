// Spec §5 — Scenario Composition Engine.
//
// Dual / multi-blockade = UNION of freeze vectors across the selected scenarios,
// evaluated multiplicatively by the survival function. This is what makes
// `composeScenarios([US_SANCTION, CN_CAPITAL_LOCK])` a true dual-system stress
// test instead of two independent single-axis scores.
//
// Overlapping vectors are de-duplicated by id — compounding across scenarios is
// already captured by the multiplicative survival model, so a shared vector must
// not be double-counted.
import { getScenario } from "./scenarios.js";

export function composeScenarios(names) {
  const list = names.map(getScenario);
  const seen = new Map();
  for (const s of list) {
    for (const v of s.vectors) {
      if (!seen.has(v.id)) seen.set(v.id, v);
    }
  }
  return {
    name: names.join(" + "),
    sources: names.slice(),
    vectors: [...seen.values()],
    mode: names.length > 1 ? "dual_or_multi_blockade" : "single",
  };
}
