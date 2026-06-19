// FINWAR v3.3 — Financial kill-chain CLI. Builds WarPaths for the portfolio and
// answers the spec §4 scenario questions.
//   node engine/terrain/terrain.js
import {
  buildExposureGraph,
  assetsKilledBySanction,
  jurisdictionTrapsUnderCapitalControl,
  assetsVisibleUnderCRS,
} from "./risk_engine.js";
import { PORTFOLIO } from "./portfolio.js";

export function buildKillChain(assets = PORTFOLIO) {
  return buildExposureGraph(assets);
}

const OFAC_EMOJI = { HIGH: "🔴", MEDIUM: "🟠", LOW: "🔵", NONE: "🟢" };

const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  const graph = buildKillChain();
  const { war_paths, ofac_distribution, exposure_index, kill_chain_risk_map, dependency_edges } = graph;

  console.log("\nFINWAR v3.3 — Financial Kill-Chain · WarPaths\n");
  console.log("  OFAC      CN-lock  CRS    custodian            networks                    asset");
  console.log("  " + "─".repeat(104));
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
  for (const w of [...war_paths].sort((a, b) => order[a.ofacDependency] - order[b.ofacDependency])) {
    console.log(
      `  ${OFAC_EMOJI[w.ofacDependency]} ${w.ofacDependency.padEnd(6)} ` +
        `${String(w.capitalControlExposure).padStart(5)}  ${String(w.taxTransparencyExposure).padStart(5)}   ` +
        `${(w.ultimateCustodian || "—").padEnd(19)} ${w.settlementNetwork.join(",").padEnd(26)} ${w.label}`,
    );
  }
  console.log("  " + "─".repeat(104));
  console.log(
    `  ofacDependency →  🔴 ${ofac_distribution.HIGH} HIGH · 🟠 ${ofac_distribution.MEDIUM} MEDIUM · ` +
      `🔵 ${ofac_distribution.LOW} LOW · 🟢 ${ofac_distribution.NONE} NONE` +
      `   ·   mean index  OFAC ${exposure_index.ofac} · CN-lock ${exposure_index.capitalControl} · CRS ${exposure_index.taxTransparency}\n`,
  );

  console.log("  KILL-CHAIN RISK MAP (the true objects of simulation — spec §8)");
  console.log(`    settlement networks : ${kill_chain_risk_map.settlement_risk_nodes.join(", ") || "—"}`);
  console.log(`    ultimate custodians : ${kill_chain_risk_map.custodian_risk_nodes.join(", ") || "—"}`);
  console.log(`    asset classes       : ${kill_chain_risk_map.asset_class_risk_nodes.join(", ") || "—"}`);
  console.log(`    dependency edges    : ${dependency_edges.length}\n`);

  console.log("  SCENARIO QUERIES (spec §4)");
  console.log(`    US sanctions DTCC/CHIPS → these WarPaths die : ${assetsKilledBySanction(PORTFOLIO, ["DTCC", "DTC", "CHIPS"]).join(", ") || "—"}`);
  console.log(`    CN tightens capital control → trap jurisdictions: ${jurisdictionTrapsUnderCapitalControl(PORTFOLIO).join(", ") || "—"}`);
  console.log(`    CRS fully enforced → fully-visible assets      : ${assetsVisibleUnderCRS(PORTFOLIO).join(", ") || "—"}\n`);

  console.log(JSON.stringify(graph, null, 2));
  console.log("");
}
