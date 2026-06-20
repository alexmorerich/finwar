// FINWAR — TAX Engine v2.0 · validation suite. Zero deps.
//   node tests/tax.test.js
import {
  computeTaxExposure,
  migrateLegacyTax,
  mapTaxExposure,
} from "../engine/tax/tax_engine.js";
import {
  TAX_CATEGORIES,
  TAX_RISK_NODES,
  AGG_WEIGHTS,
  levelOf,
  LEVELS,
} from "../engine/tax/tax_nodes.js";
import { CURRENT_HOLDINGS } from "../engine/current_holdings/assets.js";

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
const inUnit100 = (x) => typeof x === "number" && x >= 0 && x <= 100;
const byId = Object.fromEntries(CURRENT_HOLDINGS.map((h) => [h.id, h]));
const tax = (id, ctx) => computeTaxExposure(byId[id], ctx);
const CATEGORY_KEYS = ["informationExchange", "incomeTax", "exitTax", "estateGiftTax", "cfcRisk", "antiAvoidance", "specialAssetTax"];

console.log("\nFINWAR — TAX Engine v2.0 · test suite\n");

// ── Structure — 7 categories, 17 risk nodes ──
{
  check("exactly 7 tax categories", TAX_CATEGORIES.length === 7, TAX_CATEGORIES.length);
  check("exactly 17 risk nodes", TAX_RISK_NODES.length === 17, TAX_RISK_NODES.length);
  const nodeSum = TAX_CATEGORIES.reduce((s, c) => s + c.nodes.length, 0);
  check("category node counts sum to 17 (4·1·1·5·3·1·2)", nodeSum === 17, nodeSum);
  check("every risk node belongs to a declared category",
    TAX_RISK_NODES.every((n) => CATEGORY_KEYS.includes(n.category)));
  const t = tax("p1-winglung-hk-sgov");
  check("TaxExposure carries all 7 categories", CATEGORY_KEYS.every((k) => k in t));
  check("each category returns { score, level, reasons[] }",
    CATEGORY_KEYS.every((k) => inUnit100(t[k].score) && LEVELS.includes(t[k].level) && Array.isArray(t[k].reasons) && t[k].reasons.length > 0));
}

// ── Aggregation weights (spec §9) sum to 1.0 and key the 7 categories ──
{
  const sum = Object.values(AGG_WEIGHTS).reduce((s, w) => s + w, 0);
  check("AGG_WEIGHTS sum to 1.0", Math.abs(sum - 1) < 1e-9, sum);
  check("AGG_WEIGHTS cover exactly the 7 categories",
    CATEGORY_KEYS.every((k) => k in AGG_WEIGHTS) && Object.keys(AGG_WEIGHTS).length === 7);
  check("information-exchange is the heaviest axis (0.25), estate next (0.20)",
    AGG_WEIGHTS.informationExchange === 0.25 && AGG_WEIGHTS.estateGiftTax === 0.20);
}

// ── Levels — band boundaries ──
{
  check("levelOf maps NONE/LOW/MEDIUM/HIGH at the right bands",
    levelOf(0) === "NONE" && levelOf(30) === "LOW" && levelOf(50) === "MEDIUM" && levelOf(90) === "HIGH",
    `${levelOf(0)}/${levelOf(30)}/${levelOf(50)}/${levelOf(90)}`);
}

// ── Bounds — every score in [0,100] across the whole book ──
{
  const ok = CURRENT_HOLDINGS.every((h) => {
    const t = computeTaxExposure(h);
    return inUnit100(t.taxScore) && CATEGORY_KEYS.every((k) => inUnit100(t[k].score));
  });
  check("all category + aggregate scores are in [0,100]", ok);
  check("taxLevel is always a valid level", CURRENT_HOLDINGS.every((h) => LEVELS.includes(computeTaxExposure(h).taxLevel)));
}

// ── §2 Information Exchange ──
{
  const sgov = tax("p1-winglung-hk-sgov").informationExchange; // US-situs ETF via a HK bank
  check("US ETF via HK bank: CRS+FATCA+EOIR+AML all true → score 100 HIGH",
    sgov.CRS && sgov.FATCA && sgov.EOIR && sgov.AMLVisibility && sgov.score === 100 && sgov.level === "HIGH", JSON.stringify(sgov));
  const gldm = tax("p1-ibkr-gldm").informationExchange; // US-situs ETF at a US broker (US not CRS)
  check("US ETF at US broker: CRS false (US≠CRS), FATCA true → score 60",
    gldm.CRS === false && gldm.FATCA === true && gldm.score === 60, JSON.stringify(gldm));
  const btc = tax("p5-btc-cold").informationExchange;
  check("BTC self-custody: no reporting nexus → score 0 NONE",
    !btc.CRS && !btc.FATCA && !btc.AMLVisibility && btc.score === 0 && btc.level === "NONE");
  const rmb = tax("p4-rmb-cash").informationExchange;
  check("RMB cash at CN bank: CRS true, FATCA false → score 60", rmb.CRS && !rmb.FATCA && rmb.score === 60, JSON.stringify(rmb));
}

// ── §3 Income Tax ──
{
  check("US ETF dividend withholding = 30%", tax("p1-winglung-hk-sgov").incomeTax.dividendWithholding === 30);
  check("HK/SG dividend withholding = 0%", tax("p3-sc-hk-2800").incomeTax.dividendWithholding === 0 && tax("p2-dbs-d05").incomeTax.dividendWithholding === 0);
  check("CN equity capital-gains = 20%", tax("p4-huatai-csi300").incomeTax.capitalGainsTax === 20);
  check("US non-resident equity capital-gains = 0%", tax("p1-winglung-hk-sgov").incomeTax.capitalGainsTax === 0);
}

// ── §4 Exit / Disposal Tax (max) ──
{
  check("HK equity stamp duty → equityTransferTax MEDIUM", tax("p3-sc-hk-2800").exitTax.equityTransferTax === 50 && tax("p3-sc-hk-2800").exitTax.level === "MEDIUM");
  check("Shenzhen real estate → realEstateExitTax fires", tax("p8-shenzhen-real-estate").exitTax.realEstateExitTax >= 60);
  check("US ETF has no exit/disposal tax", tax("p1-winglung-hk-sgov").exitTax.score === 0);
  // synthetic SG real estate → HIGH (ABSD/SSD)
  const sgRE = computeTaxExposure({ asset_class: "RealEstate", custody_jurisdiction: "Singapore", settlement_system: "Real_Estate_Settlement" });
  check("SG real estate exit (ABSD/SSD) → HIGH", sgRE.exitTax.level === "HIGH", sgRE.exitTax.realEstateExitTax);
}

// ── §5 Estate & Gift Tax (max) ──
{
  const sgov = tax("p1-winglung-hk-sgov").estateGiftTax;
  check("US-situs asset → usEstateTax HIGH + usGiftTax MEDIUM → level HIGH",
    sgov.usEstateTax === 90 && sgov.usGiftTax === 60 && sgov.level === "HIGH", JSON.stringify(sgov));
  check("BTC has no estate/gift situs → NONE", tax("p5-btc-cold").estateGiftTax.score === 0);
  check("CN asset → cnPotentialEstateTax LOW (policy risk)", tax("p4-rmb-cash").estateGiftTax.cnPotentialEstateTax === 30 && tax("p4-rmb-cash").estateGiftTax.level === "LOW");
}

// ── §6 CFC ──
{
  check("direct holding → CFC NONE", tax("p1-winglung-hk-sgov").cfcRisk.score === 0 && tax("p1-winglung-hk-sgov").cfcRisk.level === "NONE");
  const viaEntity = computeTaxExposure(byId["p3-sc-hk-2800"], { viaEntity: true, passiveIncomeRatio: 0.8, holderResidency: "CN" });
  check("entity in low-tax jurisdiction + passive>50% → CFC HIGH + cnCFC true",
    viaEntity.cfcRisk.level === "HIGH" && viaEntity.cfcRisk.cnCFC === true, JSON.stringify(viaEntity.cfcRisk));
}

// ── §7 Anti-Avoidance (max) ──
{
  check("no trigger → anti-avoidance NONE", tax("p1-winglung-hk-sgov").antiAvoidance.score === 0);
  check("GAAR / ESR / BO-test → HIGH", computeTaxExposure(byId["p2-dbs-d05"], { GAAR: true }).antiAvoidance.level === "HIGH");
  check("BEPS2 only → MEDIUM", computeTaxExposure(byId["p2-dbs-d05"], { BEPS2: true }).antiAvoidance.level === "MEDIUM");
}

// ── §8 Special Asset Tax ──
{
  check("US ETF → favorable fund structure (fundStructureTax 20)", tax("p1-winglung-hk-sgov").specialAssetTax.fundStructureTax === 20);
  check("CN export-locked gold → goldTax HIGH (80)", tax("p7-cn-gold-physical").specialAssetTax.goldTax === 80 && tax("p7-cn-gold-physical").specialAssetTax.level === "HIGH");
  check("DMCC free-zone gold < CN locked gold", tax("p7-dmcc-gold-physical").specialAssetTax.goldTax < tax("p7-cn-gold-physical").specialAssetTax.goldTax);
  check("crypto carries a special crypto tax (capgains + CRS inclusion)", tax("p5-btc-cold").specialAssetTax.cryptoTax > 0);
  check("issuer stablecoin is MORE reportable than self-sovereign BTC (cryptoTax)",
    tax("p6-usdc-cold").specialAssetTax.cryptoTax > tax("p5-btc-cold").specialAssetTax.cryptoTax,
    `${tax("p6-usdc-cold").specialAssetTax.cryptoTax} vs ${tax("p5-btc-cold").specialAssetTax.cryptoTax}`);
}

// ── §10 Migration — legacy single CRS → full TaxExposure, no breaking changes ──
{
  const m = migrateLegacyTax(true);
  check("migrate(true): informationExchange.CRS = true, score 40", m.informationExchange.CRS === true && m.informationExchange.score === 40);
  check("migrate(true): every OTHER category defaults to score 0",
    ["incomeTax", "exitTax", "estateGiftTax", "cfcRisk", "antiAvoidance", "specialAssetTax"].every((k) => m[k].score === 0));
  check("migrate(true): all booleans/numerics default false/0 (info FATCA/EOIR/AML false)",
    m.informationExchange.FATCA === false && m.informationExchange.EOIR === false && m.informationExchange.AMLVisibility === false);
  check("migrate(true): taxScore = 0.25·40 = 10, flagged _migrated", m.taxScore === 10 && m._migrated === true, m.taxScore);
  check("migrate(false): everything zero → NONE", migrateLegacyTax(false).taxScore === 0 && migrateLegacyTax(false).informationExchange.CRS === false);
  check("migrate(number>0) and migrate({crs:true}) both infer CRS", migrateLegacyTax(85).informationExchange.CRS === true && migrateLegacyTax({ crs: true }).informationExchange.CRS === true);
  check("migrated object has the SAME full shape (no breaking change)",
    CATEGORY_KEYS.every((k) => k in m) && "taxScore" in m && "taxLevel" in m && "breakdown" in m);
}

// ── Determinism + conceptual shift ──
{
  check("computeTaxExposure is deterministic", JSON.stringify(tax("p1-winglung-hk-sgov")) === JSON.stringify(tax("p1-winglung-hk-sgov")));
  check("the engine answers more than CRS: offshore US ETF outranks self-custody BTC on taxScore",
    tax("p1-winglung-hk-sgov").taxScore > tax("p5-btc-cold").taxScore);
  check("breakdown mirrors the seven category scores",
    CATEGORY_KEYS.every((k) => tax("p4-huatai-csi300").breakdown[k] === tax("p4-huatai-csi300")[k].score));
  const mapped = mapTaxExposure(CURRENT_HOLDINGS);
  check("mapTaxExposure returns one summary per holding", mapped.length === CURRENT_HOLDINGS.length && mapped.every((m) => "taxScore" in m && "breakdown" in m));
}

console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
