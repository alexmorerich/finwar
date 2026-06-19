// Spec §4 — Time-dimension model. Sanctions unfold over time, so the SAME asset
// that is MOVEABLE at T0 can be FROZEN by T7.
//
//   T0 = announcement phase      (day 0)
//   T1 = execution phase         (day 1)
//   T7 = settlement collapse     (day 7)
export const PHASES = ["T0", "T1", "T7"];

export const PHASE_DAYS = { T0: 0, T1: 1, T7: 7 };

export const PHASE_LABEL = {
  T0: "T0 · announcement",
  T1: "T1 · execution",
  T7: "T7 · settlement collapse",
};

export function phaseDay(p) {
  const d = PHASE_DAYS[p];
  if (d === undefined) throw new Error(`Unknown phase: ${p}`);
  return d;
}

// True if vector phase `a` has activated by the time we reach phase `b`.
export function phaseLte(a, b) {
  return phaseDay(a) <= phaseDay(b);
}
