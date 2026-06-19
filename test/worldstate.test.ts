/**
 * FinWar v4 — WorldState contract + engine tests. Zero external deps.
 *   node --import tsx --test test/worldstate.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleWorldState } from "../src/engine/assemble.js";
import { ALL_BUCKETS, FINOS_REQUIRED_BUCKETS } from "../src/engine/model.js";
import { resolveScenarioKey, SCENARIOS } from "../src/engine/scenarios.js";
import { getLatest, getStatus, resetState, runSimulation } from "../src/state.js";
import type { RiskBucket, WorldInput, WorldState } from "../src/contracts/index.js";

const TS = "2026-06-19T00:00:00.000Z";
const inputFor = (scenario: string, macro_inputs: Record<string, number> = {}): WorldInput => ({
  timestamp: TS,
  scenario,
  seed: 0,
  macro_inputs,
});

const EVENT_TYPES = new Set(["sanction", "war", "capital_control", "tax_change", "banking_restriction"]);
const CONSTRAINT_TYPES = new Set(["freeze", "transfer_limit", "reporting", "tax"]);
const JURISDICTION_SCOPES = new Set(["US", "HK", "CN", "SG", "CH", "AE", "self", "GLOBAL"]);
const RISK_DIMS = ["freeze_risk", "liquidity_risk", "regulatory_risk", "capital_control_risk", "censorship_resistance"] as const;

const inUnit = (x: number): boolean => typeof x === "number" && x >= 0 && x <= 1;

/** Collect every score in a WorldState that the contract bounds to [0,1]. */
function allBoundedNumbers(w: WorldState): number[] {
  const nums: number[] = [w.probability];
  for (const e of w.geopolitical_events) nums.push(e.severity);
  for (const c of w.constraints) nums.push(c.intensity);
  for (const b of Object.keys(w.asset_risk_matrix) as RiskBucket[]) {
    const r = w.asset_risk_matrix[b]!;
    for (const d of RISK_DIMS) if (typeof r[d] === "number") nums.push(r[d]!);
  }
  return nums;
}

test("asset_risk_matrix populates ALL 7 FinOS-derived buckets (+ the 8th)", () => {
  const w = assembleWorldState(inputFor("US-China financial escalation"));
  for (const b of FINOS_REQUIRED_BUCKETS) {
    assert.ok(w.asset_risk_matrix[b], `missing required bucket: ${b}`);
    assert.ok(Object.keys(w.asset_risk_matrix[b]!).length > 0, `bucket ${b} carries no risk dims`);
  }
  for (const b of ALL_BUCKETS) assert.ok(w.asset_risk_matrix[b], `missing bucket: ${b}`);
});

test("every severity / intensity / probability / risk score is in [0,1]", () => {
  for (const key of Object.keys(SCENARIOS)) {
    const w = assembleWorldState(inputFor(key, { us_sanction: 0.99, banking_disruption: 1, probability: 0.42 }));
    for (const n of allBoundedNumbers(w)) assert.ok(inUnit(n), `out-of-range value ${n} in scenario ${key}`);
  }
});

test("deterministic: identical inputs ⇒ deep-equal WorldState", () => {
  const i = inputFor("us_china_escalation", { cn_capital_control: 0.7 });
  assert.deepEqual(assembleWorldState(i), assembleWorldState(i));
});

test("timestamp flows through unchanged (engine never reads the clock)", () => {
  assert.equal(assembleWorldState(inputFor("baseline")).timestamp, TS);
});

test("scenario string is echoed verbatim", () => {
  const name = "US-China financial escalation";
  assert.equal(assembleWorldState(inputFor(name)).scenario, name);
});

test("scenario resolver maps free-form strings onto canonical presets", () => {
  const cases: [string, string][] = [
    ["US-China financial escalation", "us_china_escalation"],
    ["US secondary sanctions expand", "us_secondary_sanctions"],
    ["SWIFT cutoff / correspondent banking freeze", "global_banking_disruption"],
    ["tighten RMB capital controls", "china_capital_controls"],
    ["crypto exchange ban", "crypto_dislocation"],
    ["CRS reporting expansion", "tax_transparency_expansion"],
    ["", "baseline"],
    ["something totally unrelated", "baseline"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(resolveScenarioKey(input), expected, `"${input}" → ${expected}`);
  }
});

test("macro_inputs override individual axes (clamped) and probability", () => {
  const calm = assembleWorldState(inputFor("baseline"));
  const hot = assembleWorldState(inputFor("baseline", { us_sanction: 1, probability: 0.9 }));
  assert.ok(
    hot.asset_risk_matrix.US_EQUITY!.freeze_risk! > calm.asset_risk_matrix.US_EQUITY!.freeze_risk!,
    "raising us_sanction must raise US_EQUITY freeze_risk",
  );
  assert.equal(hot.probability, 0.9);
  assert.ok(hot.constraints.some((c) => c.type === "freeze"), "us_sanction=1 must yield a freeze constraint");
});

test("constraints: valid type, valid scope, intensity in [0,1]", () => {
  const buckets = new Set<string>(ALL_BUCKETS);
  for (const key of Object.keys(SCENARIOS)) {
    for (const c of assembleWorldState(inputFor(key)).constraints) {
      assert.ok(CONSTRAINT_TYPES.has(c.type), `bad constraint type ${c.type}`);
      assert.ok(buckets.has(c.scope) || JURISDICTION_SCOPES.has(c.scope), `bad scope ${c.scope}`);
      assert.ok(inUnit(c.intensity), `intensity ${c.intensity} out of range`);
    }
  }
});

test("geopolitical_events use only contract event types", () => {
  for (const key of Object.keys(SCENARIOS)) {
    for (const e of assembleWorldState(inputFor(key)).geopolitical_events) {
      assert.ok(EVENT_TYPES.has(e.type), `bad event type ${e.type}`);
      assert.ok(inUnit(e.severity));
    }
  }
  // the `war` type only surfaces for an explicitly kinetic scenario
  const war = assembleWorldState(inputFor("Taiwan blockade / war"));
  assert.ok(war.geopolitical_events.some((e) => e.type === "war"), "kinetic scenario should emit a war event");
});

test("escalation is strictly riskier than baseline on the US axis", () => {
  const base = assembleWorldState(inputFor("baseline"));
  const esc = assembleWorldState(inputFor("us_china_escalation"));
  assert.ok(esc.asset_risk_matrix.US_EQUITY!.freeze_risk! >= 0.5, "escalation US_EQUITY freeze_risk should be high");
  assert.ok(
    esc.asset_risk_matrix.US_EQUITY!.freeze_risk! > base.asset_risk_matrix.US_EQUITY!.freeze_risk!,
  );
});

test("portfolio-independence: no holding-shaped fields leak into WorldState", () => {
  // Key-form check (like tests/golden.test.js): a WorldState carries no holding
  // DATA fields. Event/constraint prose may mention "custody"/"settlement" — that
  // is world modeling, not a portfolio leak — so we match quoted JSON KEYS only.
  const s = JSON.stringify(assembleWorldState(inputFor("us_china_escalation")));
  for (const forbidden of ["value_usd", "amount", "holdings", "weight", "custody", "exposure_tags"]) {
    assert.ok(!s.includes(`"${forbidden}"`), `WorldState must not contain key "${forbidden}"`);
  }
});

test("reactive state machine: IDLE → SIMULATING → UPDATED → STABLE", () => {
  resetState();
  assert.equal(getStatus(), "IDLE");
  runSimulation(inputFor("us_china_escalation"));
  assert.equal(getStatus(), "UPDATED");
  const latest = getLatest(inputFor("baseline")); // observing decays UPDATED → STABLE
  assert.equal(getStatus(), "STABLE");
  assert.equal(latest.scenario, "us_china_escalation"); // returns the cached simulated state
  resetState();
});
