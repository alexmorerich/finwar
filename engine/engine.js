// FINWAR v3.2 — top-level orchestrator.
// Runs the full position-chain simulation for an asset under a (possibly composed)
// set of scenarios, across all time phases, and emits the spec §12 output bundle.
import { composeScenarios } from "./scenario/compose.js";
import { matchedVectors, survivalAtPhase } from "./core/survival.js";
import { classify, degradationBand, CLASS_EMOJI } from "./core/classifier.js";
import { exitAnalysis } from "./simulation/exit_engine.js";
import { PHASES, PHASE_DAYS } from "./simulation/time_phases.js";

const round = (x) => Math.round(x * 1000) / 1000;

// Spec §11 — explanation trace. Human-readable "why" for every active vector.
function traceLine(v) {
  const verb =
    v.type === "lock" ? "locked by" : v.type === "market" ? "halted by" : "matched";
  return `${v.id} ${verb} ${v.scenario} (${v.type}, activates ${v.active_from}) → survival ×${round(
    v.eff,
  )}`;
}

export function simulateAsset(asset, scenarioNames) {
  const composed = composeScenarios(scenarioNames);
  const matched = matchedVectors(asset.position, composed);

  const phases = {};
  for (const p of PHASES) {
    const { score, active } = survivalAtPhase(matched, p);
    const klass = classify(score);
    phases[p] = {
      phase: p,
      day: PHASE_DAYS[p],
      survival_score: round(score),
      classification: klass,
      emoji: CLASS_EMOJI[klass],
      degradation_band: degradationBand(score),
      frozen_vectors: active.map((v) => v.id),
      explanation_trace: active.map(traceLine),
    };
  }

  const exit = exitAnalysis(matched, asset.time_to_liquidate);
  const final = phases.T7; // headline = fully-executed worst case

  return {
    asset_id: asset.id,
    label: asset.label,
    custody_mode: asset.position.custody_mode,
    scenario: composed.name,
    mode: composed.mode,
    base: { base_srs: asset.base_srs, base_ccr: asset.base_ccr },
    // ── spec §12 system output ──
    survival_score: final.survival_score,
    classification: final.classification,
    emoji: final.emoji,
    escape_window: exit.escape_window,
    frozen_vectors: final.frozen_vectors,
    explanation_trace: final.explanation_trace,
    // ── detail ──
    exit,
    phases,
  };
}

export function simulateAll(assets, scenarioNames) {
  return assets.map((a) => simulateAsset(a, scenarioNames));
}

// ─────────────────────────── CLI (Node only) ───────────────────────────
// Guarded so importing this module in the browser never touches Node APIs.
const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(
    await readFile(new URL("../data.json", import.meta.url), "utf8"),
  );
  const args = process.argv.slice(2);
  const names = args.length ? args : ["US_SANCTION", "CN_CAPITAL_LOCK"];
  console.log(`\nFINWAR v3.2 — scenario: ${names.join(" + ")}\n`);
  const rows = simulateAll(data.assets, names).sort(
    (a, b) => a.survival_score - b.survival_score,
  );
  for (const r of rows) {
    const esc = r.escape_window === Infinity ? "∞" : `${r.escape_window}d`;
    console.log(
      `${r.emoji} ${r.classification.padEnd(8)} surv=${String(r.survival_score).padEnd(
        5,
      )} escape=${esc.padEnd(7)} ${r.label}`,
    );
  }
  console.log("");
}
