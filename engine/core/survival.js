// Spec §2 — Multiplicative survival model. REPLACES FSS = min(SRS, CCR).
//
//   survival_score = ∏ effectiveImpact(vector) over every matched, active vector
//
// effectiveImpact attenuates a vector's raw severity by custody resilience R:
//   eff = 1 - (1 - severity) * (1 - R)
//     R = 0  → full severity (no protection)
//     R = 1  → eff = 1 (custody fully neutralises the vector)
import { custodyResilience } from "./custody.js";
import { phaseLte } from "../simulation/time_phases.js";

export function effectiveImpact(severity, R) {
  return 1 - (1 - severity) * (1 - R);
}

// Every vector that matches this position (phase-independent), annotated with the
// effective impact under the position's custody mode. Used by both the per-phase
// survival score and the forward-looking exit analysis.
export function matchedVectors(position, composed) {
  const R = custodyResilience(position.custody_mode);
  const out = [];
  for (const v of composed.vectors) {
    if (v.match(position)) out.push({ ...v, eff: effectiveImpact(v.severity, R) });
  }
  return out;
}

// Survival score at a given phase = product of effective impacts of all matched
// vectors that have activated by that phase.
export function survivalAtPhase(matched, phase) {
  let score = 1.0;
  const active = matched.filter((v) => phaseLte(v.active_from, phase));
  for (const v of active) score *= v.eff;
  return { score, active };
}

// Spec §2 reference signature — pure multiplicative survival over a composed
// scenario, ignoring the time dimension (worst-case, all vectors live).
export function survival(position, composed) {
  return survivalAtPhase(matchedVectors(position, composed), "T7").score;
}
