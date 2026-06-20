// FINWAR v4.0 — Asset Coordinate Engine validation. Zero deps.
//   node tests/coordinate.test.js
import {
  calculateExposure,
  toVector,
  exposureWeight,
  assetCoordinate,
  mapAssets,
} from "../engine/coordinate/coordinate_engine.js";
import {
  SETTLEMENT_SYSTEMS,
  CUSTODY_JURISDICTIONS,
  OWNERSHIP_MODELS,
  ASSET_CLASSES,
  LAYER_PRIORITY,
  bi,
} from "../engine/coordinate/layers.js";
import { SAMPLE_ASSETS } from "../engine/coordinate/assets.js";

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
const A = Object.fromEntries(SAMPLE_ASSETS.map((a) => [a.id, a]));
const exp = (id) => calculateExposure(A[id]);
const inUnit = (v) => v >= 0 && v <= 1;

console.log("\nFINWAR v4.0 — Asset Coordinate Engine · test suite\n");

// ── Normalization — every axis of every asset stays in [0,1] (spec: 0.0 ~ 1.0) ──
{
  let allIn = true;
  for (const a of SAMPLE_ASSETS) {
    const e = calculateExposure(a);
    if (!(inUnit(e.OFAC) && inUnit(e.SAFE) && inUnit(e.TAX))) allIn = false;
  }
  check("every (OFAC,SAFE,TAX) is normalized to [0,1]", allIn);
  // an all-max synthetic asset must still clamp to ≤ 1
  const maxAsset = { settlement_system: "US_Settlement", custody_jurisdiction: "US", ownership_model: "nominee", asset_class: "ETF" };
  const m = calculateExposure(maxAsset);
  check("a maximal asset never exceeds 1.0", inUnit(m.OFAC) && inUnit(m.SAFE) && inUnit(m.TAX), JSON.stringify(m));
}

// ── Determinism — same AssetNode ⇒ identical coordinate (no clock, no randomness) ──
{
  const a = A.SGOV;
  check("calculateExposure is deterministic", JSON.stringify(calculateExposure(a)) === JSON.stringify(calculateExposure(a)));
  check("toVector mirrors exposure (x=OFAC, y=SAFE, z=TAX)", (() => {
    const e = calculateExposure(a), v = toVector(a);
    return v.x === e.OFAC && v.y === e.SAFE && v.z === e.TAX;
  })());
}

// ── Layer-priority weights sum to 1 (settlement ≫ custody ≫ ownership ≫ class) ──
{
  const sum = Object.values(LAYER_PRIORITY).reduce((s, w) => s + w, 0);
  check("LAYER_PRIORITY weights sum to 1.0", Math.abs(sum - 1) < 1e-9, sum);
  check("settlement is highest priority, asset class lowest",
    LAYER_PRIORITY.settlement_system > LAYER_PRIORITY.custody_jurisdiction &&
    LAYER_PRIORITY.custody_jurisdiction > LAYER_PRIORITY.ownership_model &&
    LAYER_PRIORITY.ownership_model > LAYER_PRIORITY.asset_class);
}

// ── OFAC axis — US-settled assets dominate; self-custody / physical escape ──
{
  check("SGOV (US settlement+custody) sits high on OFAC (>0.8)", exp("SGOV").OFAC > 0.8, exp("SGOV").OFAC);
  check("BTC self-custody sits near the OFAC origin (<0.12)", exp("BTC_COLD").OFAC < 0.12, exp("BTC_COLD").OFAC);
  check("Gold bearer sits low on OFAC (<0.2)", exp("GOLD_DMCC").OFAC < 0.2, exp("GOLD_DMCC").OFAC);
  // the "label lies" lesson: O87 (US-cleared) outranks D05 (true SG settlement) on OFAC
  check("O87 (US-cleared) > D05 (pure-SG) on the OFAC axis", exp("O87").OFAC > exp("D05").OFAC + 0.2, `${exp("O87").OFAC} vs ${exp("D05").OFAC}`);
}

// ── SAFE axis — China capital-control trap is the dominant signal onshore ──
{
  check("RMB onshore deposit tops the SAFE axis (>0.8)", exp("RMB_ICBC").SAFE > 0.8, exp("RMB_ICBC").SAFE);
  check("Shenzhen real estate is SAFE-trapped (>0.6)", exp("SZ_PROPERTY").SAFE > 0.6, exp("SZ_PROPERTY").SAFE);
  check("US assets have low SAFE exposure (SGOV <0.3)", exp("SGOV").SAFE < 0.3, exp("SGOV").SAFE);
  check("BTC self-custody escapes SAFE (<0.12)", exp("BTC_COLD").SAFE < 0.12, exp("BTC_COLD").SAFE);
}

// ── TAX axis — visibility tracks the regulated book; self-custody is invisible ──
{
  check("US nominee-held ETF is highly visible on TAX (>0.7)", exp("SGOV").TAX > 0.7, exp("SGOV").TAX);
  check("BTC self-custody is invisible on TAX (<0.1)", exp("BTC_COLD").TAX < 0.1, exp("BTC_COLD").TAX);
  check("bearer gold is low-visibility on TAX (<0.35)", exp("GOLD_DMCC").TAX < 0.35, exp("GOLD_DMCC").TAX);
}

// ── Exposure weight — bubble size = vector magnitude ÷√3, a per-asset property ──
{
  for (const a of SAMPLE_ASSETS) {
    if (!inUnit(exposureWeight(a))) { check(`exposure_weight(${a.id}) in [0,1]`, false, exposureWeight(a)); break; }
  }
  check("every exposure_weight is in [0,1]", SAMPLE_ASSETS.every((a) => inUnit(exposureWeight(a))));
  // SGOV (high on 2 of 3 axes) must outweigh BTC (near the origin on all 3)
  check("SGOV exposure_weight > BTC exposure_weight", exposureWeight(A.SGOV) > exposureWeight(A.BTC_COLD), `${exposureWeight(A.SGOV)} vs ${exposureWeight(A.BTC_COLD)}`);
  check("an origin-corner asset has near-zero weight (BTC <0.12)", exposureWeight(A.BTC_COLD) < 0.12, exposureWeight(A.BTC_COLD));
}

// ── Tolerant — an out-of-enum value scores the neutral midpoint, never throws ──
{
  let threw = false, e;
  try { e = calculateExposure({ settlement_system: "???", custody_jurisdiction: "???", ownership_model: "???", asset_class: "???" }); }
  catch { threw = true; }
  check("out-of-enum asset does not throw", !threw);
  check("out-of-enum asset scores the 0.5 midpoint", e && e.OFAC === 0.5 && e.SAFE === 0.5 && e.TAX === 0.5, JSON.stringify(e));
}

// ── assetCoordinate bundle — the per-asset object the six UI panels consume ──
{
  const c = assetCoordinate(A.SGOV);
  check("assetCoordinate echoes the four input layers", c.settlement_system === "US_Settlement" && c.custody_jurisdiction === "US" && c.ownership_model === "nominee" && c.asset_class === "ETF");
  check("assetCoordinate.vector matches its exposure", c.vector.x === c.exposure.OFAC && c.vector.y === c.exposure.SAFE && c.vector.z === c.exposure.TAX);
  check("mapAssets returns one bundle per asset", mapAssets(SAMPLE_ASSETS).length === SAMPLE_ASSETS.length);
  // HARD RULE: no allocation / percentage weight / buy-sell field leaks into output
  const forbidden = ["allocation", "weight_pct", "percent", "recommendation", "action", "buy", "sell", "target"];
  check("coordinate bundle carries NO allocation / recommendation field", !forbidden.some((k) => k in c), Object.keys(c).join(","));
}

// ── Bilingual integrity — every enum value & axis carries an en + zh label ──
{
  const tables = [SETTLEMENT_SYSTEMS, CUSTODY_JURISDICTIONS, OWNERSHIP_MODELS, ASSET_CLASSES];
  const everyBilingual = tables.every((t) => Object.values(t).every((r) => typeof r.en === "string" && r.en.length > 0 && typeof r.zh === "string" && r.zh.length > 0));
  check("every layer enum value has a non-empty en + zh label", everyBilingual);
  check("enum counts match the spec (8 · 6 · 6 · 9)",
    Object.keys(SETTLEMENT_SYSTEMS).length === 8 && Object.keys(CUSTODY_JURISDICTIONS).length === 6 &&
    Object.keys(OWNERSHIP_MODELS).length === 6 && Object.keys(ASSET_CLASSES).length === 9,
    `${Object.keys(SETTLEMENT_SYSTEMS).length}·${Object.keys(CUSTODY_JURISDICTIONS).length}·${Object.keys(OWNERSHIP_MODELS).length}·${Object.keys(ASSET_CLASSES).length}`);
  check('bi() renders the "English / 中文" on-screen format', bi(ASSET_CLASSES.PhysicalGold) === "Physical Gold / 实物黄金", bi(ASSET_CLASSES.PhysicalGold));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
