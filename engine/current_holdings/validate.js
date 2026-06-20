// FINWAR — Current-holdings catalog validation utilities (zero-dep).
//
//   node engine/current_holdings/validate.js     # prints the report, exits 1 on error
//   import { validateHoldings } from "./validate.js"
//
// Proves the stated facts catalog (assets.js) is internally consistent AND that
// every holding maps cleanly onto BOTH engines (coordinate v4.0 + kill-chain v3.3)
// with no "Unknown" — i.e. the engines' enums genuinely span the user's real book.
// It NEVER rescales the raw stated percentages: the declared/stated gap is a signal.

import {
  PATHS,
  CURRENT_HOLDINGS,
  RISK_BUCKETS,
  WORLDSTATE_RISK_BUCKETS,
  CONTRACT_GAPS,
  statedPctTotal,
  declaredVsStatedReport,
  worldStateBucketOf,
} from "./assets.js";
import {
  SETTLEMENT_SYSTEMS,
  CUSTODY_JURISDICTIONS,
  OWNERSHIP_MODELS,
  ASSET_CLASSES,
} from "../coordinate/layers.js";
import {
  SETTLEMENT_SYSTEMS as T_SETTLEMENT_SYSTEMS,
  SETTLEMENT_NETWORKS,
  CUSTODY_JURISDICTIONS as T_CUSTODY_JURISDICTIONS,
  ULTIMATE_CUSTODIANS,
  BENEFICIAL_OWNERSHIP,
} from "../terrain/nodes.js";
import { toTerrainAsset } from "./assets.js";

// Spec invariants — the catalog must always assert to these exact figures.
export const EXPECTED = { paths: 8, holdings: 26, stated_pct_total: 119 };

// The 26 stated holdings, by id — the canonical "every stated holding exists" set.
export const EXPECTED_HOLDING_IDS = [
  "p1-ibkr-gldm", "p1-schwab-qqqm", "p1-dbs-sg-usd-fd", "p1-sc-sg-o87", "p1-sc-sg-s27",
  "p1-winglung-hk-sgov", "p1-bochk-vgsh", "p1-dbs-hk-usd-fd", "p1-winglung-hk-usd-mmf", "p1-bochk-usd-mmf",
  "p2-dbs-d05", "p2-dbs-gls",
  "p3-sc-hk-3081", "p3-sc-hk-2800", "p3-winglung-hk-hkd-mmf", "p3-bochk-hkd-mmf",
  "p4-huatai-csi300", "p4-rmb-cash",
  "p5-btc-cold", "p5-xmr-cold",
  "p6-usdc-cold", "p6-xaut-cold", "p6-usdt-cold",
  "p7-cn-gold-physical", "p7-dmcc-gold-physical",
  "p8-shenzhen-real-estate",
];

// declared/stated mismatches we EXPECT (and must never "fix" by inventing holdings).
export const EXPECTED_MISMATCHES = { 1: [20, 18], 5: [15, 11], 6: [15, 7] };
export const EXPECTED_MATCHES = [4, 7, 8];

const isKey = (table, k) => Object.prototype.hasOwnProperty.call(table, k);

// ─────────────────── coverage check: a holding maps without "Unknown" ───────────────────
// Returns the list of fields that fail to resolve (empty = fully covered).
export function uncoveredFields(h) {
  const out = [];
  // coordinate engine (v4.0) — four layers
  if (!isKey(SETTLEMENT_SYSTEMS, h.settlement_system)) out.push(`coordinate.settlement_system=${h.settlement_system}`);
  if (!isKey(CUSTODY_JURISDICTIONS, h.custody_jurisdiction)) out.push(`coordinate.custody_jurisdiction=${h.custody_jurisdiction}`);
  if (!isKey(OWNERSHIP_MODELS, h.ownership_model)) out.push(`coordinate.ownership_model=${h.ownership_model}`);
  if (!isKey(ASSET_CLASSES, h.asset_class)) out.push(`coordinate.asset_class=${h.asset_class}`);
  // kill-chain engine (v3.3) — nodes (Unknown is a real enum member, but counts as uncovered)
  if (!isKey(T_SETTLEMENT_SYSTEMS, h.settlement_system) || h.settlement_system === "Unknown") out.push(`terrain.settlementSystem=${h.settlement_system}`);
  for (const n of h.settlement_network) {
    if (!isKey(SETTLEMENT_NETWORKS, n) || n === "Unknown") out.push(`terrain.settlementNetwork=${n}`);
  }
  if (!isKey(ULTIMATE_CUSTODIANS, h.ultimate_custodian) || h.ultimate_custodian === "Unknown") out.push(`terrain.ultimateCustodian=${h.ultimate_custodian}`);
  if (!isKey(BENEFICIAL_OWNERSHIP, h.beneficial_ownership_model) || h.beneficial_ownership_model === "unknown") out.push(`terrain.beneficialOwnershipModel=${h.beneficial_ownership_model}`);
  // the mapped terrain custody jurisdiction must resolve too
  const tj = toTerrainAsset(h).custodyJurisdiction;
  if (!isKey(T_CUSTODY_JURISDICTIONS, tj) || tj === "Unknown") out.push(`terrain.custodyJurisdiction=${tj}`);
  return out;
}

const REQUIRED_FIELDS = [
  "id", "path_id", "path_label", "stated_pct", "institution", "account_jurisdiction",
  "instrument", "currency", "settlement_system", "custody_jurisdiction", "ownership_model",
  "asset_class", "settlement_network", "ultimate_custodian", "beneficial_ownership_model", "risk_bucket",
];

// ─────────────────── the full validation ───────────────────
export function validateHoldings() {
  const errors = [];
  const warnings = [];

  // 1 — exactly 8 paths / 26 holdings
  if (PATHS.length !== EXPECTED.paths) errors.push(`expected ${EXPECTED.paths} paths, got ${PATHS.length}`);
  if (CURRENT_HOLDINGS.length !== EXPECTED.holdings) errors.push(`expected ${EXPECTED.holdings} holdings, got ${CURRENT_HOLDINGS.length}`);

  // 2 — every stated holding exists (by id), and no extras / dupes
  const ids = CURRENT_HOLDINGS.map((h) => h.id);
  if (new Set(ids).size !== ids.length) errors.push("duplicate holding id(s) present");
  for (const id of EXPECTED_HOLDING_IDS) if (!ids.includes(id)) errors.push(`missing stated holding: ${id}`);
  for (const id of ids) if (!EXPECTED_HOLDING_IDS.includes(id)) errors.push(`unexpected (invented?) holding: ${id}`);

  // 3 — required fields present on every holding
  for (const h of CURRENT_HOLDINGS) {
    for (const f of REQUIRED_FIELDS) {
      if (h[f] === undefined || h[f] === null || h[f] === "") errors.push(`${h.id}: missing required field "${f}"`);
    }
  }

  // 4 — raw stated_pct sum is 119 and is NOT normalized to 100
  const total = statedPctTotal();
  if (total !== EXPECTED.stated_pct_total) errors.push(`stated_pct total expected ${EXPECTED.stated_pct_total}, got ${total}`);
  if (total === 100) errors.push("stated_pct total is 100 — the catalog was normalized (forbidden; raw stated data must be preserved)");

  // 5 — declared/stated mismatch report (paths 1/5/6 mismatch; 4/7/8 match) — never invent holdings to close the gap
  const report = declaredVsStatedReport();
  const byPath = Object.fromEntries(report.map((r) => [r.path_id, r]));
  for (const [pid, [declared, stated]] of Object.entries(EXPECTED_MISMATCHES)) {
    const r = byPath[pid];
    if (!r || !r.mismatch) errors.push(`path ${pid}: expected a declared/stated MISMATCH (${declared} vs ${stated})`);
    else if (r.declared_path_pct !== declared || r.stated_sum !== stated)
      errors.push(`path ${pid}: mismatch figures wrong — expected ${declared} vs ${stated}, got ${r.declared_path_pct} vs ${r.stated_sum}`);
  }
  for (const pid of EXPECTED_MATCHES) {
    const r = byPath[pid];
    if (!r || !r.match) errors.push(`path ${pid}: expected declared == stated (a MATCH)`);
  }

  // 6 — coverage: every holding maps to coordinate + terrain fields without Unknown
  for (const h of CURRENT_HOLDINGS) {
    const miss = uncoveredFields(h);
    if (miss.length) errors.push(`${h.id}: uncovered field(s) → ${miss.join(", ")}`);
  }

  // 7 — risk_bucket resolves; WorldState mapping valid; gaps documented
  for (const h of CURRENT_HOLDINGS) {
    const b = RISK_BUCKETS[h.risk_bucket];
    if (!b) { errors.push(`${h.id}: unknown risk_bucket "${h.risk_bucket}"`); continue; }
    if (!WORLDSTATE_RISK_BUCKETS.includes(b.worldstate)) errors.push(`${h.id}: risk_bucket maps to non-WorldState bucket ${b.worldstate}`);
    if (b.gap && !b.reason) errors.push(`${h.id}: contract-gap bucket ${h.risk_bucket} lacks a documented reason`);
  }

  // 8 — issuer-risk crypto must NOT be treated as censorship-resistant BTC/XMR
  const ISSUER = ["p6-usdc-cold", "p6-usdt-cold", "p6-xaut-cold"];
  const SOVEREIGN_FREE = ["p5-btc-cold", "p5-xmr-cold"];
  const byId = Object.fromEntries(CURRENT_HOLDINGS.map((h) => [h.id, h]));
  for (const id of ISSUER) {
    const h = byId[id];
    if (!h) { errors.push(`issuer-crypto holding missing: ${id}`); continue; }
    if (h.risk_bucket === "CRYPTO_COLD") errors.push(`${id}: issuer token must NOT use CRYPTO_COLD (it is issuer-freezable, not censorship-resistant)`);
    if (!["ISSUER_STABLECOIN", "ISSUER_GOLD_TOKEN"].includes(h.risk_bucket)) errors.push(`${id}: expected an ISSUER_* bucket, got ${h.risk_bucket}`);
    if (h.settlement_system !== "Issuer_Crypto_Settlement") errors.push(`${id}: issuer token must settle via Issuer_Crypto_Settlement, got ${h.settlement_system}`);
  }
  for (const id of SOVEREIGN_FREE) {
    const h = byId[id];
    if (h && h.settlement_system !== "Decentralized_Settlement") errors.push(`${id}: BTC/XMR must settle via Decentralized_Settlement`);
    if (h && h.risk_bucket !== "CRYPTO_COLD") errors.push(`${id}: BTC/XMR must use CRYPTO_COLD`);
  }

  // 9 — the ONLY tolerated note is the unverified GLS ticker (everything else resolves)
  for (const h of CURRENT_HOLDINGS) {
    if (h.needs_ticker_verification && h.id !== "p2-dbs-gls")
      warnings.push(`${h.id}: needs_ticker_verification flagged (only GLS is expected to be)`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      paths: PATHS.length,
      holdings: CURRENT_HOLDINGS.length,
      stated_pct_total: total,
      normalized: total === 100,
      declared_vs_stated: report,
      contract_gaps: CONTRACT_GAPS,
    },
  };
}

// ─────────────────── CLI ───────────────────
function isMain() {
  try { return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href; }
  catch { return false; }
}

if (isMain()) {
  const G = "\x1b[32m", R = "\x1b[31m", Y = "\x1b[33m", D = "\x1b[2m", X = "\x1b[0m";
  const v = validateHoldings();
  console.log(`\nFINWAR — Current-holdings catalog validation\n`);
  console.log(`  paths: ${v.summary.paths}   holdings: ${v.summary.holdings}   stated_pct total: ${v.summary.stated_pct_total}` +
    `  ${v.summary.normalized ? R + "(NORMALIZED — error)" : G + "(raw, ≠100 — correct)"}${X}\n`);

  console.log("  declared vs stated (never reconciled):");
  for (const r of v.summary.declared_vs_stated) {
    const tag = r.declared_path_pct === null ? `${D}no declared target${X}`
      : r.mismatch ? `${Y}MISMATCH Δ${r.delta > 0 ? "+" : ""}${r.delta}${X}` : `${G}match${X}`;
    console.log(`    Path ${r.path_id}  declared=${String(r.declared_path_pct).padStart(4)}  stated=${String(r.stated_sum).padStart(3)}  ${tag}  ${D}${r.path_label}${X}`);
  }

  console.log(`\n  documented WorldState contract gaps: ${v.summary.contract_gaps.length}`);
  for (const g of v.summary.contract_gaps) console.log(`    ${Y}${g.catalog_bucket}${X} → ${g.worldstate_bucket}  ${D}(${g.reason.split(".")[0]}.)${X}`);

  if (v.warnings.length) { console.log(`\n  ${Y}warnings:${X}`); for (const w of v.warnings) console.log(`    - ${w}`); }

  if (v.ok) {
    console.log(`\n${G}✓ catalog valid — 8 paths, 26 holdings, raw sum 119, full coordinate+terrain coverage${X}\n`);
    process.exit(0);
  } else {
    console.log(`\n${R}✗ ${v.errors.length} error(s):${X}`);
    for (const e of v.errors) console.log(`    ${R}- ${e}${X}`);
    console.log("");
    process.exit(1);
  }
}
