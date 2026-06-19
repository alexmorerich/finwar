// Spec §9 — Golden Test Cases (mandatory validation). Zero-dependency runner.
//   node tests/golden.test.js
import { readFile } from "node:fs/promises";
import { simulateAsset } from "../engine/engine.js";

const data = JSON.parse(
  await readFile(new URL("../data.json", import.meta.url), "utf8"),
);
const byId = Object.fromEntries(data.assets.map((a) => [a.id, a]));

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m${detail ? `  (${detail})` : ""}`);
  }
}

console.log("\nFINWAR v3.2 — Golden Test Suite\n");

// ── TEST 1 — BTC self custody → MOVEABLE under dual sanctions ──
{
  const r = simulateAsset(byId.btc_self_custody, ["US_SANCTION", "CN_CAPITAL_LOCK"]);
  check(
    "TEST 1 · BTC self-custody → MOVEABLE under dual sanctions",
    r.classification === "MOVEABLE",
    `got ${r.classification} @ ${r.survival_score}`,
  );
  check("TEST 1 · BTC self-custody has zero frozen vectors", r.frozen_vectors.length === 0);
  check("TEST 1 · BTC self-custody escape_window > 0", r.escape_window > 0);
}

// ── TEST 2 — Shenzhen real estate → FROZEN under CN and dual ──
{
  const cn = simulateAsset(byId.shenzhen_real_estate, ["CN_CAPITAL_LOCK"]);
  const dual = simulateAsset(byId.shenzhen_real_estate, ["US_SANCTION", "CN_CAPITAL_LOCK"]);
  check(
    "TEST 2 · Shenzhen real estate → FROZEN under CN_CAPITAL_LOCK",
    cn.classification === "FROZEN",
    `got ${cn.classification} @ ${cn.survival_score}`,
  );
  check(
    "TEST 2 · Shenzhen real estate → FROZEN under dual scenario",
    dual.classification === "FROZEN",
    `got ${dual.classification} @ ${dual.survival_score}`,
  );
  check("TEST 2 · Shenzhen real estate escape_window < 0 (trapped)", dual.escape_window < 0);
}

// ── TEST 3 — IBKR US ETF (HK user) → TRAPPED under US and dual ──
{
  const us = simulateAsset(byId.ibkr_us_etf_hk, ["US_SANCTION"]);
  const dual = simulateAsset(byId.ibkr_us_etf_hk, ["US_SANCTION", "CN_CAPITAL_LOCK"]);
  check(
    "TEST 3 · IBKR US ETF → TRAPPED under US_SANCTION",
    us.classification === "TRAPPED",
    `got ${us.classification} @ ${us.survival_score}`,
  );
  check(
    "TEST 3 · IBKR US ETF → TRAPPED under dual scenario",
    dual.classification === "TRAPPED",
    `got ${dual.classification} @ ${dual.survival_score}`,
  );
  check(
    "TEST 3 · IBKR US ETF custody-chain freeze includes custodian_reg",
    dual.frozen_vectors.includes("custodian_reg"),
  );
}

// ── Time dimension — same asset drifts more frozen from T0 → T7 ──
{
  const r = simulateAsset(byId.ibkr_us_etf_hk, ["US_SANCTION", "CN_CAPITAL_LOCK"]);
  check(
    "TIME · IBKR ETF survival(T7) ≤ survival(T0)",
    r.phases.T7.survival_score <= r.phases.T0.survival_score,
    `T0=${r.phases.T0.survival_score} T7=${r.phases.T7.survival_score}`,
  );
}

// ── Data contract (spec §10) — facts layer carries no computed outputs ──
{
  const forbidden = [
    "FSS",
    "fss",
    "survival_score",
    "classification",
    "effective_srs",
    "effective_ccr",
    "frozen_vectors",
  ];
  let clean = true;
  let offender = "";
  for (const a of data.assets) {
    const s = JSON.stringify(a);
    for (const f of forbidden) {
      if (s.includes(`"${f}"`)) {
        clean = false;
        offender = `${a.id}:${f}`;
      }
    }
  }
  check("DATA · no precomputed outputs in data.json", clean, offender);
  const hasReq = data.assets.every(
    (a) =>
      typeof a.base_srs === "number" &&
      typeof a.base_ccr === "number" &&
      a.position &&
      a.position.custody_mode &&
      typeof a.time_to_liquidate === "number",
  );
  check("DATA · every asset has base_srs / base_ccr / custody_mode / time_to_liquidate", hasReq);
}

console.log(
  `\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`,
);
process.exit(fail === 0 ? 0 : 1);
