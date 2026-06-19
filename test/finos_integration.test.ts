/**
 * ACCEPTANCE — FinWar WorldState ⊕ FinArk PortfolioState → FinOS decide() must
 * yield non-empty recommendations (FinWar prompt § ACCEPTANCE).
 *
 * This imports the REAL finos `decide()` from the sibling repo at runtime, so it
 * proves cross-service compatibility against the actual consumer rather than a
 * local mock. It is skipped automatically when the sibling repo is absent (e.g.
 * CI that checks out finwar alone).
 *
 * The dynamic-import specifier is built from an array (a non-literal expression)
 * so tsc does NOT pull the sibling repo into THIS project's typecheck program;
 * tsx resolves it at runtime (.js → .ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { assembleWorldState } from "../src/engine/assemble.js";
import type { Holding, WorldInput } from "../src/contracts/index.js";

const TS = "2026-06-19T00:00:00.000Z";

// Concrete path (literal-free at the tsc layer via the URL ctor) used only to
// detect presence; the import specifier below is the relative one tsx resolves.
const finosDecideTs = fileURLToPath(new URL("../../finos/src/decide.ts", import.meta.url));
const SIBLING_PRESENT = existsSync(finosDecideTs);
const skip = SIBLING_PRESENT ? false : "sibling finos repo not present at ../../finos";

/** A FinArk-shaped portfolio in the CONTRACT-canonical codes finos decide() understands. */
const holdings: Holding[] = [
  {
    asset_id: "ivv", type: "ETF", name: "iShares S&P 500", amount: 1000, currency: "USD", value_usd: 400000,
    custody: { institution: "Schwab", type: "brokerage", jurisdiction: "US" },
    exposure_tags: { country: "US", tax_regime: "US", liquidity_tier: "high" },
  },
  {
    asset_id: "2800hk", type: "stock", name: "Tracker Fund HK", amount: 5000, currency: "HKD", value_usd: 200000,
    custody: { institution: "HSBC", type: "brokerage", jurisdiction: "HK" },
    exposure_tags: { country: "HK", tax_regime: "HK", liquidity_tier: "high" },
  },
  {
    asset_id: "rmb_cash", type: "cash", name: "RMB deposit", amount: 1400000, currency: "CNY", value_usd: 200000,
    custody: { institution: "ICBC", type: "bank", jurisdiction: "CN" },
    exposure_tags: { country: "CN", tax_regime: "CN", liquidity_tier: "medium" },
  },
  {
    asset_id: "btc", type: "crypto", name: "Bitcoin (cold)", amount: 2, currency: "BTC", value_usd: 200000,
    custody: { institution: "Ledger", type: "self_custody", jurisdiction: "self" },
    exposure_tags: { country: "global", tax_regime: "none", liquidity_tier: "medium" },
  },
  {
    asset_id: "offshore_usd", type: "cash", name: "Offshore USD (DBS)", amount: 150000, currency: "USD", value_usd: 150000,
    custody: { institution: "DBS", type: "bank", jurisdiction: "SG" },
    exposure_tags: { country: "SG", tax_regime: "SG", liquidity_tier: "high" },
  },
  {
    asset_id: "usd_cash", type: "cash", name: "USD cash (US bank)", amount: 100000, currency: "USD", value_usd: 100000,
    custody: { institution: "BoA", type: "bank", jurisdiction: "US" },
    exposure_tags: { country: "US", tax_regime: "US", liquidity_tier: "high" },
  },
  {
    asset_id: "sz_house", type: "real_estate", name: "Shenzhen apartment", amount: 1, currency: "CNY", value_usd: 500000,
    custody: { institution: "self", type: "self_custody", jurisdiction: "CN" },
    exposure_tags: { country: "CN", tax_regime: "CN", liquidity_tier: "low" },
  },
  {
    asset_id: "gld", type: "ETF", name: "Physical Gold (vaulted)", amount: 100, currency: "XAU", value_usd: 150000,
    custody: { institution: "BullionVault", type: "brokerage", jurisdiction: "CH" },
    exposure_tags: { country: "CH", tax_regime: "CH", liquidity_tier: "high" },
  },
];

async function loadFinos(): Promise<{ decide: any; assemblePortfolioState: any }> {
  // Array.join keeps the specifier non-literal → out of tsc's module graph.
  const decideSpec = ["..", "..", "finos", "src", "decide.js"].join("/");
  const contractsSpec = ["..", "..", "finos", "src", "contracts", "index.js"].join("/");
  const decideMod = await import(decideSpec);
  const contractsMod = await import(contractsSpec);
  return { decide: decideMod.decide, assemblePortfolioState: contractsMod.assemblePortfolioState };
}

const simulate = (scenario: string, macro_inputs: Record<string, number> = {}) =>
  assembleWorldState({ timestamp: TS, scenario, seed: 0, macro_inputs } satisfies WorldInput);

test("escalation WorldState + portfolio ⇒ FinOS yields non-empty recommendations", { skip }, async () => {
  const { decide, assemblePortfolioState } = await loadFinos();
  const world = simulate("US-China financial escalation");
  const portfolio = assemblePortfolioState(TS, holdings);

  const packet = decide(world, portfolio, {}, TS);

  assert.ok(packet.recommendations.length > 0, "expected at least one recommendation");
  assert.equal(packet.analysis.risk_exposure.length, holdings.length, "one risk_exposure per holding");
  packet.recommendations.forEach((r: { priority: number }, i: number) =>
    assert.equal(r.priority, i + 1, "priorities are 1..N in order"),
  );
  // value is conserved by the projection
  assert.ok(
    Math.abs(packet.projected_state.total_value_usd - portfolio.total_value_usd) < 1,
    "projected_state must preserve total value",
  );
});

test("the US-cleared & onshore holdings are the ones FinOS flags", { skip }, async () => {
  const { decide, assemblePortfolioState } = await loadFinos();
  const world = simulate("US-China financial escalation");
  const portfolio = assemblePortfolioState(TS, holdings);
  const packet = decide(world, portfolio, {}, TS);

  const flagged = new Set(packet.recommendations.map((r: { asset_id: string }) => r.asset_id));
  // US equity (freeze) and onshore RMB (capital control) must surface.
  assert.ok(flagged.has("ivv"), "US equity should be flagged under escalation");
  assert.ok(flagged.has("rmb_cash"), "onshore RMB should be flagged under escalation");
  // cold self-custodied BTC is the haven — it must NOT be flagged.
  assert.ok(!flagged.has("btc"), "cold-custody BTC should not be flagged (censorship-resistant haven)");
});

test("decide() over a FinWar packet is deterministic", { skip }, async () => {
  const { decide, assemblePortfolioState } = await loadFinos();
  const world = simulate("us_china_escalation");
  const portfolio = assemblePortfolioState(TS, holdings);
  assert.deepEqual(decide(world, portfolio, {}, TS), decide(world, portfolio, {}, TS));
});
