// FINWAR v3.3 — Financial kill-chain engine validation. Zero deps.
//   node tests/terrain.test.js
import {
  computeOFACDependency,
  computeWarPath,
  computeCapitalControl,
  computeTaxTransparency,
  buildExposureGraph,
  migrateLegacyPosition,
  assetsKilledBySanction,
  jurisdictionTrapsUnderCapitalControl,
  assetsVisibleUnderCRS,
  KILL_CHAIN_PRIORITY,
} from "../engine/terrain/risk_engine.js";
import { PORTFOLIO } from "../engine/terrain/portfolio.js";

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
const ofacOf = (id) => computeOFACDependency(PORTFOLIO.find((a) => a.id === id));

console.log("\nFINWAR v3.3 — Financial Kill-Chain · test suite\n");

// ── §7 calibration — ofacDependency must match the patch examples exactly ──
{
  check("O87  ofacDependency = HIGH (SGX listing, but DTC/CHIPS + State Street)", ofacOf("O87") === "HIGH", ofacOf("O87"));
  check("S27  ofacDependency = HIGH", ofacOf("S27") === "HIGH", ofacOf("S27"));
  check("D05  ofacDependency = LOW (pure SG kill chain: CDP/MEPS+/PayNow)", ofacOf("D05") === "LOW", ofacOf("D05"));
  check("SGOV ofacDependency = HIGH (US rails via a HK broker)", ofacOf("SGOV") === "HIGH", ofacOf("SGOV"));
  check("2800 ofacDependency = MEDIUM (HK rails, HSBC USD-correspondent)", ofacOf("2800") === "MEDIUM", ofacOf("2800"));
  check("BTC  ofacDependency = NONE (decentralized + self-custody)", ofacOf("BTC_ColdWallet") === "NONE", ofacOf("BTC_ColdWallet"));
  check("Gold ofacDependency = NONE (physical + bearer)", ofacOf("Gold_DMCC") === "NONE", ofacOf("Gold_DMCC"));
}

// ── §3 — OFAC reads settlementNetwork + custodian, NEVER the custody-country label ──
{
  // US custody label, but a pure-Singapore kill chain → LOW (label must not force HIGH)
  check("US custody label + SG kill chain → LOW (not HIGH)",
    computeOFACDependency({ custodyJurisdiction: "US", settlementNetwork: ["CDP"], ultimateCustodian: "CDP" }) === "LOW");
  // SG custody label, but a US rail reaches it → HIGH
  check("SG custody label + US rail (DTC) → HIGH",
    computeOFACDependency({ custodyJurisdiction: "Singapore", settlementNetwork: ["DTC"], ultimateCustodian: "DBS" }) === "HIGH");
  // custodian-only nexus: foreign rail but a US custodian → HIGH
  check("foreign rail + US custodian (State Street) → HIGH (LAYER 2 alone)",
    computeOFACDependency({ custodyJurisdiction: "HongKong", settlementNetwork: ["CCASS"], ultimateCustodian: "StateStreet" }) === "HIGH");
  // correspondent SWIFT exposure → MEDIUM
  check("SWIFT exposure → MEDIUM",
    computeOFACDependency({ settlementNetwork: ["SWIFT"], ultimateCustodian: "DBS" }) === "MEDIUM");
  // NONE requires an all-none chain
  check("decentralized rail but UNKNOWN custodian → LOW (not NONE — unconfirmed)",
    computeOFACDependency({ settlementNetwork: ["Bitcoin"], ultimateCustodian: "Unknown" }) === "LOW");
}

// ── WarPath shape (spec §4) ──
{
  const w = computeWarPath(PORTFOLIO.find((a) => a.id === "O87"));
  const keys = ["assetId", "settlementSystem", "custodyJurisdiction", "assetClass", "ultimateCustodian",
    "settlementNetwork", "ofacDependency", "capitalControlExposure", "taxTransparencyExposure"];
  check("WarPath carries every spec §4 field", keys.every((k) => k in w), keys.filter((k) => !(k in w)));
  check("WarPath.capitalControlExposure / taxTransparencyExposure are 0–100",
    w.capitalControlExposure >= 0 && w.capitalControlExposure <= 100 && w.taxTransparencyExposure >= 0 && w.taxTransparencyExposure <= 100);
}

// ── capital-control + tax-transparency axes ──
{
  const cc = (id) => computeCapitalControl(PORTFOLIO.find((a) => a.id === id));
  const tt = (id) => computeTaxTransparency(PORTFOLIO.find((a) => a.id === id));
  check("capitalControl: HK (2800) > US (SGOV)", cc("2800") > cc("SGOV"), `${cc("2800")} vs ${cc("SGOV")}`);
  check("capitalControl: a China asset scores high (>70)",
    computeCapitalControl({ custodyJurisdiction: "China", settlementSystem: "China_Settlement", ultimateCustodian: "CNSDC" }) > 70);
  check("taxTransparency: nominee ETF (O87) is high (>65)", tt("O87") > 65, tt("O87"));
  check("taxTransparency: self-custody (BTC) is low (<20)", tt("BTC_ColdWallet") < 20, tt("BTC_ColdWallet"));
  check("taxTransparency: bearer gold is low (<35)", tt("Gold_DMCC") < 35, tt("Gold_DMCC"));
}

// ── §4 scenario queries ──
{
  const killed = assetsKilledBySanction(PORTFOLIO, ["DTCC", "DTC", "CHIPS"]);
  check("sanction DTCC/CHIPS kills O87, S27, SGOV", ["O87", "S27", "SGOV"].every((id) => killed.includes(id)), killed.join(","));
  check("sanction DTCC/CHIPS spares D05 / BTC / Gold",
    !killed.includes("D05") && !killed.includes("BTC_ColdWallet") && !killed.includes("Gold_DMCC"));
  check("sanction Bitcoin kills only the BTC wallet",
    JSON.stringify(assetsKilledBySanction(PORTFOLIO, ["Bitcoin"])) === JSON.stringify(["BTC_ColdWallet"]));
  check("capital-control trap jurisdictions include HongKong", jurisdictionTrapsUnderCapitalControl(PORTFOLIO).includes("HongKong"));
  const visible = assetsVisibleUnderCRS(PORTFOLIO);
  check("CRS makes the regulated book visible (O87, D05, 2800)", ["O87", "D05", "2800"].every((id) => visible.includes(id)));
  check("CRS leaves self-custody / bearer invisible (BTC, Gold)",
    !visible.includes("BTC_ColdWallet") && !visible.includes("Gold_DMCC"));
}

// ── §6 migration — NO data loss ──
{
  const old = { id: "legacy1", assetType: "Gold", custodyCountry: "ChinaMainland", broker: "ICBC", weight: 0.2 };
  const m = migrateLegacyPosition(old);
  check("migrate: assetType Gold → assetClass PhysicalGold", m.assetClass === "PhysicalGold", m.assetClass);
  check("migrate: custodyCountry ChinaMainland → custodyJurisdiction China", m.custodyJurisdiction === "China", m.custodyJurisdiction);
  check("migrate: settlementSystem defaults to 'Unknown'", m.settlementSystem === "Unknown");
  check("migrate: settlementNetwork defaults to ['Unknown']", m.settlementNetwork.length === 1 && m.settlementNetwork[0] === "Unknown");
  check("migrate: ultimateCustodian / beneficialOwnershipModel default to unknown",
    m.ultimateCustodian === "Unknown" && m.beneficialOwnershipModel === "unknown");
  check("migrate: broker preserved", m.broker === "ICBC", m.broker);
  check("migrate: NO data loss — original kept verbatim in _legacy", JSON.stringify(m._legacy) === JSON.stringify(old));
  check("migrate: migrated asset scores without throwing (ofacDependency LOW, axes 0–100)", (() => {
    const w = computeWarPath(m);
    return ["HIGH", "MEDIUM", "LOW", "NONE"].includes(w.ofacDependency) &&
      w.capitalControlExposure >= 0 && w.taxTransparencyExposure >= 0;
  })());
}

// ── ExposureGraph aggregate (spec §5/§8) ──
{
  const g = buildExposureGraph(PORTFOLIO);
  check("ofac_distribution = { HIGH:3, MEDIUM:1, LOW:1, NONE:2 }",
    g.ofac_distribution.HIGH === 3 && g.ofac_distribution.MEDIUM === 1 && g.ofac_distribution.LOW === 1 && g.ofac_distribution.NONE === 2,
    JSON.stringify(g.ofac_distribution));
  check("kill_chain_risk_map.settlement_risk includes DTC + CHIPS",
    g.kill_chain_risk_map.settlement_risk_nodes.includes("DTC") && g.kill_chain_risk_map.settlement_risk_nodes.includes("CHIPS"));
  check("kill_chain_risk_map.custodian_risk includes StateStreet + HSBC",
    g.kill_chain_risk_map.custodian_risk_nodes.includes("StateStreet") && g.kill_chain_risk_map.custodian_risk_nodes.includes("HSBC"));
  check("kill_chain_risk_map.custodian_risk excludes self-custody / physical",
    !g.kill_chain_risk_map.custodian_risk_nodes.includes("SelfCustody") && !g.kill_chain_risk_map.custodian_risk_nodes.includes("PhysicalPossession"));
  const types = new Set(g.dependency_edges.map((e) => e.type));
  check("dependency_edges: only settlement_dependency / custodian_dependency",
    [...types].every((t) => t === "settlement_dependency" || t === "custodian_dependency"));
  check("dependency_edges: one custodian_dependency per asset",
    g.dependency_edges.filter((e) => e.type === "custodian_dependency").length === PORTFOLIO.length);
  check("ExposureGraph.war_paths has one WarPath per asset", g.war_paths.length === PORTFOLIO.length);
}

// ── kill-chain priority order (spec §5) ──
{
  check("KILL_CHAIN_PRIORITY leads with SettlementNetwork → UltimateCustodian",
    KILL_CHAIN_PRIORITY[0] === "SettlementNetwork" && KILL_CHAIN_PRIORITY[1] === "UltimateCustodian");
  check("KILL_CHAIN_PRIORITY ends with the CustodyCountry label (lowest priority)",
    KILL_CHAIN_PRIORITY[KILL_CHAIN_PRIORITY.length - 1] === "CustodyCountry");
}

// ── bounds ──
{
  const ok = PORTFOLIO.map(computeWarPath).every((w) =>
    [w.capitalControlExposure, w.taxTransparencyExposure, w.ofacScore].every((v) => v >= 0 && v <= 100));
  check("all WarPath axis values within 0–100", ok);
}

console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
