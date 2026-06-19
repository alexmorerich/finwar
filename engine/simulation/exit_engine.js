// Spec §6/§7 — Exit Engine (redefined). `liquidity_days` as a standalone meaning
// is removed. The decision-relevant quantity is the escape window:
//
//   escape_window = time_to_freeze - time_to_liquidate
//     > 0  → escape possible (you can liquidate before the freeze lands)
//     < 0  → already trapped (the freeze lands before you can get out)
//
// time_to_freeze = earliest day at which ANY matched freeze vector activates.
// If nothing matches, the position never freezes → time_to_freeze = Infinity.
import { phaseDay } from "./time_phases.js";

export function exitAnalysis(matched, time_to_liquidate) {
  let time_to_freeze = Infinity;
  for (const v of matched) {
    const d = phaseDay(v.active_from);
    if (d < time_to_freeze) time_to_freeze = d;
  }
  const escape_window = time_to_freeze - time_to_liquidate;
  return {
    time_to_liquidate,
    time_to_freeze,
    escape_window,
    escape_possible: escape_window > 0,
  };
}
