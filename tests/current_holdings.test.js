// FINWAR — Current-holdings facts catalog · validation suite. Zero deps.
//   node tests/current_holdings.test.js
import {
  PATHS,
  CURRENT_HOLDINGS,
  RISK_BUCKETS,
  CONTRACT_GAPS,
  statedPctTotal,
  declaredVsStatedReport,
  worldStateBucketOf,
  toAssetNode,
} from "../engine/current_holdings/assets.js";
import {
  validateHoldings,
  uncoveredFields,
  EXPECTED,
  EXPECTED_HOLDING_IDS,
  EXPECTED_MISMATCHES,
  EXPECTED_MATCHES,
} from "../engine/current_holdings/validate.js";
import { calculateExposure, assetCoordinate } from "../engine/coordinate/coordinate_engine.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31m✗ ${name}\x1b[0m${detail !== undefined ? `  (${detail})` : ""}`);
  }
}
const byId = Object.fromEntries(CURRENT_HOLDINGS.map((h) => [h.id, h]));
const ofac = (id) => calculateExposure(toAssetNode(byId[id])).OFAC;

console.log("\nFINWAR — Current-holdings facts catalog · test suite\n");

// ── Counts — exactly 8 paths and 26 holdings ──
{
  check("exactly 8 paths", PATHS.length === EXPECTED.paths, PATHS.length);
  check("exactly 26 holdings", CURRENT_HOLDINGS.length === EXPECTED.holdings, CURRENT_HOLDINGS.length);
  check("holding ids are unique", new Set(CURRENT_HOLDINGS.map((h) => h.id)).size === CURRENT_HOLDINGS.length);
}

// ── Every stated holding exists by id (and nothing was invented) ──
{
  const ids = new Set(CURRENT_HOLDINGS.map((h) => h.id));
  check("every stated holding is present by id", EXPECTED_HOLDING_IDS.every((id) => ids.has(id)),
    EXPECTED_HOLDING_IDS.filter((id) => !ids.has(id)).join(","));
  check("no extra/invented holdings", CURRENT_HOLDINGS.every((h) => EXPECTED_HOLDING_IDS.includes(h.id)),
    CURRENT_HOLDINGS.filter((h) => !EXPECTED_HOLDING_IDS.includes(h.id)).map((h) => h.id).join(","));
  // a representative spot-check by human name → ticker
  check("DBS GLS ticker preserved verbatim + flagged for verification",
    byId["p2-dbs-gls"].ticker === "GLS" && byId["p2-dbs-gls"].needs_ticker_verification === true);
}

// ── Raw stated_pct sum is 119 and is NOT normalized to 100 ──
{
  check("stated_pct total is exactly 119", statedPctTotal() === 119, statedPctTotal());
  check("stated_pct total is NOT normalized to 100", statedPctTotal() !== 100);
  check("per-path stated sums: 18·6·12·10·11·7·35·20",
    JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8].map((p) => CURRENT_HOLDINGS.filter((h) => h.path_id === p).reduce((s, h) => s + h.stated_pct, 0)))
    === JSON.stringify([18, 6, 12, 10, 11, 7, 35, 20]));
}

// ── Declared-vs-stated mismatch report exists for Path 1/5/6 — NOT reconciled ──
{
  const r = Object.fromEntries(declaredVsStatedReport().map((x) => [x.path_id, x]));
  for (const [pid, [declared, stated]] of Object.entries(EXPECTED_MISMATCHES)) {
    check(`Path ${pid} reports declared/stated MISMATCH (${declared} vs ${stated})`,
      r[pid].mismatch && r[pid].declared_path_pct === declared && r[pid].stated_sum === stated,
      `${r[pid].declared_path_pct} vs ${r[pid].stated_sum}`);
  }
  for (const pid of EXPECTED_MATCHES) check(`Path ${pid} declared == stated (match)`, r[pid].match);
  check("Paths 2 & 3 carry no declared target (excluded from mismatch)",
    r[2].declared_path_pct === null && r[3].declared_path_pct === null && !r[2].mismatch && !r[3].mismatch);
}

// ── Coverage — every holding maps to coordinate + terrain fields without Unknown ──
{
  const offenders = CURRENT_HOLDINGS.flatMap((h) => uncoveredFields(h).map((f) => `${h.id}:${f}`));
  check("all 26 holdings map to coordinate + terrain fields without Unknown", offenders.length === 0, offenders.slice(0, 4).join(" | "));
  // the GLS exception is ONLY the ticker — its coordinate/terrain fields still fully resolve
  check("GLS exception is confined to the ticker (its coordinate/terrain fields resolve)",
    uncoveredFields(byId["p2-dbs-gls"]).length === 0 && byId["p2-dbs-gls"].needs_ticker_verification === true);
}

// ── Issuer-risk crypto is NOT treated as censorship-resistant BTC/XMR ──
{
  const issuer = ["p6-usdc-cold", "p6-usdt-cold", "p6-xaut-cold"];
  check("USDC/USDT/XAUT never use the CRYPTO_COLD bucket", issuer.every((id) => byId[id].risk_bucket !== "CRYPTO_COLD"));
  check("USDC/USDT use ISSUER_STABLECOIN; XAUT uses ISSUER_GOLD_TOKEN",
    byId["p6-usdc-cold"].risk_bucket === "ISSUER_STABLECOIN" &&
    byId["p6-usdt-cold"].risk_bucket === "ISSUER_STABLECOIN" &&
    byId["p6-xaut-cold"].risk_bucket === "ISSUER_GOLD_TOKEN");
  check("issuer tokens settle via Issuer_Crypto_Settlement (BTC/XMR via Decentralized_Settlement)",
    issuer.every((id) => byId[id].settlement_system === "Issuer_Crypto_Settlement") &&
    byId["p5-btc-cold"].settlement_system === "Decentralized_Settlement" &&
    byId["p5-xmr-cold"].settlement_system === "Decentralized_Settlement");
  check("issuer tokens carry MORE OFAC reach than self-sovereign BTC/XMR",
    issuer.every((id) => ofac(id) > ofac("p5-btc-cold")), `USDC ${ofac("p6-usdc-cold")} vs BTC ${ofac("p5-btc-cold")}`);
  check("BTC/XMR sit at the censorship-resistant origin (OFAC < 0.12)",
    ofac("p5-btc-cold") < 0.12 && ofac("p5-xmr-cold") < 0.12);
}

// ── risk_bucket taxonomy + documented WorldState contract gaps ──
{
  check("every risk_bucket maps to a valid WorldState bucket", CURRENT_HOLDINGS.every((h) => worldStateBucketOf(h) !== null));
  check("exactly 3 documented contract gaps (SG equity + 2 issuer-token)", CONTRACT_GAPS.length === 3, CONTRACT_GAPS.map((g) => g.catalog_bucket).join(","));
  check("every contract-gap bucket carries a documented reason", Object.values(RISK_BUCKETS).filter((b) => b.gap).every((b) => typeof b.reason === "string" && b.reason.length > 20));
}

// ── INVARIANT — catalog percentages NEVER leak into assetCoordinate() output ──
// (the coordinate engine stays portfolio-independent; this mirrors tests/coordinate.test.js)
{
  const forbidden = ["allocation", "weight_pct", "percent", "recommendation", "action", "buy", "sell", "target",
    "stated_pct", "declared_path_pct", "risk_bucket", "path_id"];
  const leaky = CURRENT_HOLDINGS.filter((h) => {
    const c = assetCoordinate(toAssetNode(h));
    return forbidden.some((k) => k in c);
  }).map((h) => h.id);
  check("assetCoordinate output carries NO allocation / stated_pct / risk_bucket field", leaky.length === 0, leaky.join(","));
}

// ── The all-in validator agrees ──
{
  const v = validateHoldings();
  check("validateHoldings() reports OK with zero errors", v.ok, v.errors.slice(0, 3).join(" | "));
}

console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
