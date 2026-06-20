/**
 * FinWar — cross-check: the current-holdings facts catalog must NOT leak into the
 * portfolio-INDEPENDENT WorldState contract. The catalog (engine/current_holdings)
 * is a sibling facts layer; WorldState (src/contracts/world_state.ts) stays free of
 * holdings, stated percentages, and the catalog's richer bucket taxonomy.
 *   node --import tsx --test test/current_holdings_worldstate.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { assembleWorldState } from "../src/engine/assemble.js";
import { ALL_BUCKETS } from "../src/engine/model.js";
import { SCENARIOS } from "../src/engine/scenarios.js";
import {
  CURRENT_HOLDINGS,
  WORLDSTATE_RISK_BUCKETS,
  worldStateBucketOf,
} from "../engine/current_holdings/assets.js";

const TS = "2026-06-19T00:00:00.000Z";
const worldFor = (scenario: string) => assembleWorldState({ timestamp: TS, scenario, seed: 0 });

test("no current-holding id or catalog-only field appears anywhere in WorldState", () => {
  for (const key of Object.keys(SCENARIOS)) {
    const s = JSON.stringify(worldFor(key));
    for (const h of CURRENT_HOLDINGS) {
      assert.ok(!s.includes(h.id), `WorldState leaked holding id ${h.id} (scenario ${key})`);
    }
    // catalog-only holding DATA fields must never surface as WorldState keys
    for (const forbidden of ["stated_pct", "declared_path_pct", "ticker", "ultimate_custodian", "account_jurisdiction"]) {
      assert.ok(!s.includes(`"${forbidden}"`), `WorldState must not contain key "${forbidden}" (scenario ${key})`);
    }
  }
});

test("the catalog's richer bucket taxonomy never widens WorldState's bucket set", () => {
  // catalog buckets (incl. SG_EQUITY / ISSUER_*) only ever MAP to one of the 8 WorldState buckets
  for (const h of CURRENT_HOLDINGS) {
    const mapped = worldStateBucketOf(h);
    assert.ok(mapped, `holding ${h.id} has no WorldState bucket mapping`);
    assert.ok(WORLDSTATE_RISK_BUCKETS.includes(mapped!.worldstate_bucket), `${h.id} maps to a non-contract bucket`);
  }
  // the WorldState matrix is keyed ONLY by the 8 canonical buckets — no catalog buckets bleed in
  const matrixKeys = Object.keys(worldFor("us_china_escalation").asset_risk_matrix);
  for (const k of matrixKeys) assert.ok(ALL_BUCKETS.includes(k as (typeof ALL_BUCKETS)[number]), `unexpected matrix bucket ${k}`);
  for (const gapBucket of ["SG_EQUITY", "ISSUER_STABLECOIN", "ISSUER_GOLD_TOKEN"]) {
    assert.ok(!matrixKeys.includes(gapBucket), `catalog-only bucket ${gapBucket} leaked into asset_risk_matrix`);
  }
});
