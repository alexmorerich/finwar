// Spec §8 — authoritative 3-band classification on survival_score.
export function classify(score) {
  if (score > 0.7) return "MOVEABLE";
  if (score >= 0.3) return "TRAPPED";
  return "FROZEN";
}

export const CLASS_EMOJI = { MOVEABLE: "🟢", TRAPPED: "🟡", FROZEN: "🔴" };

// Spec §2 — finer 4-band degradation label (secondary / descriptive only).
export function degradationBand(score) {
  if (score >= 0.8) return "fully_moveable";
  if (score >= 0.5) return "degraded";
  if (score >= 0.2) return "trapped";
  return "frozen";
}
