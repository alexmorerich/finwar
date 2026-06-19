// FINWAR v3.3 — Financial kill-chain engine (spec §3–§6).
//
// For each Asset it computes a WarPath (spec §4): the settlement → custody →
// asset route plus three sovereign exposures —
//   ofacDependency          : HIGH | MEDIUM | LOW | NONE  (US sanction reach, §3)
//   capitalControlExposure  : 0–100                       (CN capital-lock risk)
//   taxTransparencyExposure : 0–100                       (CRS / global tax visibility)
//
// Kill-chain priority (spec §5) — wars attack the settlement network and the
// custodian FIRST, exchanges and jurisdiction labels last:
export const KILL_CHAIN_PRIORITY = [
  "SettlementNetwork",
  "UltimateCustodian",
  "BeneficialOwnershipModel",
  "Broker",
  "Exchange",
  "Jurisdiction",
  "CustodyCountry",
];

import {
  US_NEXUS_RANK,
  getSettlementSystem,
  getNetwork,
  getJurisdiction,
  getCustodian,
  getAssetClass,
  getOwnership,
} from "./nodes.js";

const r1 = (x) => Math.round(x * 10) / 10;
const clamp = (x) => Math.max(0, Math.min(100, x));

const networksOf = (asset) =>
  asset.settlementNetwork && asset.settlementNetwork.length ? asset.settlementNetwork : ["Unknown"];

// ─────────────────── §3 · OFAC dependency engine (USDependency) ───────────────────
// Computed ONLY from settlementNetwork + ultimateCustodian (never the custody
// jurisdiction label). A US rail OR a US custodian = strong nexus → HIGH.
export function computeOFACDependency(asset) {
  const tiers = [
    ...networksOf(asset).map((n) => US_NEXUS_RANK[getNetwork(n).usNexus] ?? 1),
    US_NEXUS_RANK[getCustodian(asset.ultimateCustodian).usNexus] ?? 1,
  ];
  const max = Math.max(...tiers);
  if (max >= 3) return "HIGH"; // direct US rail or US custodian
  if (max === 2) return "MEDIUM"; // USD-correspondent / SWIFT exposure
  if (max === 0) return "NONE"; // no compellable US-reachable intermediary
  return "LOW"; // foreign rails/custodian inside the regulated system (or unknown)
}

// Numeric OFAC score (for ordering + the 3D cloud axis) — consistent with the band.
const OFAC_SCORE = { HIGH: 92, MEDIUM: 62, LOW: 30, NONE: 5 };

// ─────────────────── capital-control + tax-transparency axes ───────────────────
export function computeCapitalControl(asset) {
  const jur = getJurisdiction(asset.custodyJurisdiction);
  const sys = getSettlementSystem(asset.settlementSystem);
  const cust = getCustodian(asset.ultimateCustodian);
  return r1(clamp(0.45 * jur.capitalControl + 0.35 * sys.capitalControl + 0.2 * cust.chinaExposure));
}
export function computeTaxTransparency(asset) {
  const jur = getJurisdiction(asset.custodyJurisdiction);
  const cust = getCustodian(asset.ultimateCustodian);
  const own = getOwnership(asset.beneficialOwnershipModel);
  return r1(clamp(0.45 * jur.taxTransparency + 0.3 * (cust.regulatedFI ? 80 : 0) + 0.25 * own.visibility));
}

// ─────────────────── §4 · WarPath (the settlement/custody/asset route) ───────────────────
export function computeWarPath(asset) {
  const ofacDependency = computeOFACDependency(asset);
  return {
    assetId: asset.id,
    label: asset.label || asset.id,
    settlementSystem: asset.settlementSystem,
    custodyJurisdiction: asset.custodyJurisdiction,
    assetClass: asset.assetClass,
    ultimateCustodian: asset.ultimateCustodian || "Unknown",
    settlementNetwork: networksOf(asset),
    beneficialOwnershipModel: asset.beneficialOwnershipModel || "unknown",
    broker: asset.broker ?? null,
    exchange: asset.exchange ?? null,
    ofacDependency,
    ofacScore: OFAC_SCORE[ofacDependency],
    capitalControlExposure: computeCapitalControl(asset),
    taxTransparencyExposure: computeTaxTransparency(asset),
  };
}

// Kill-chain "why", emitted in spec §5 priority order (network → custodian → …).
export function riskFactors(asset) {
  const out = [];
  const hotNets = networksOf(asset).filter((n) => {
    const t = getNetwork(n).usNexus;
    return t === "direct" || t === "correspondent";
  });
  if (hotNets.length) out.push(`SettlementNetwork ${hotNets.join(", ")} → US-reachable rail`);
  const cust = getCustodian(asset.ultimateCustodian);
  if (US_NEXUS_RANK[cust.usNexus] >= 2) out.push(`UltimateCustodian ${cust.name} → US-nexus freeze target`);
  if (cust.chinaExposure >= 60) out.push(`UltimateCustodian ${cust.name} → China-system exposure`);
  const own = getOwnership(asset.beneficialOwnershipModel);
  if (own.visibility >= 70) out.push(`BeneficialOwnership ${own.name} → high reporting visibility`);
  if (own.controllability <= 10) out.push(`BeneficialOwnership ${own.name} → no compellable holder`);
  return out;
}

// ─────────────────── §4 scenario queries (the engine's reason for existing) ───────────────────
// "If US sanctions DTCC/CHIPS, which WarPaths die?" — an asset dies when a
// sanctioned rail is in its settlementNetwork (its settlement is cut).
export function assetsKilledBySanction(assets, sanctionedNetworks) {
  const hit = new Set(sanctionedNetworks);
  return assets.filter((a) => networksOf(a).some((n) => hit.has(n))).map((a) => a.id);
}
// "If CN tightens capital control, which CustodyJurisdictions become traps?"
export function jurisdictionTrapsUnderCapitalControl(assets, threshold = 50) {
  const traps = new Set();
  for (const a of assets) if (computeCapitalControl(a) >= threshold) traps.add(a.custodyJurisdiction);
  return [...traps];
}
// "If CRS is fully enforced, which assets become fully visible?"
export function assetsVisibleUnderCRS(assets, threshold = 60) {
  return assets.filter((a) => computeTaxTransparency(a) >= threshold).map((a) => a.id);
}

// ─────────────────── Portfolio aggregate — the kill-chain ExposureGraph (spec §5/§8) ───────────────────
export function buildExposureGraph(assets) {
  const war_paths = assets.map(computeWarPath);

  const ofac_distribution = { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
  for (const w of war_paths) ofac_distribution[w.ofacDependency]++;
  const mean = (k) => r1(war_paths.reduce((s, w) => s + w[k], 0) / (war_paths.length || 1));
  const exposure_index = {
    ofac: mean("ofacScore"),
    capitalControl: mean("capitalControlExposure"),
    taxTransparency: mean("taxTransparencyExposure"),
  };

  const settlementSet = new Set();
  const custodianSet = new Set();
  const assetClassSet = new Set();
  const edges = [];
  const seen = new Set();
  const addEdge = (from, to, type) => {
    const k = `${from}|${to}|${type}`;
    if (!seen.has(k)) {
      seen.add(k);
      edges.push({ from, to, type });
    }
  };

  for (const a of assets) {
    const nets = networksOf(a);
    // the true objects of simulation (spec §8): US-reachable rails…
    for (const n of nets) {
      const t = getNetwork(n).usNexus;
      if (t === "direct" || t === "correspondent") settlementSet.add(n);
    }
    // …and the custodians that are kill switches (US-nexus or China-system)…
    const cust = getCustodian(a.ultimateCustodian);
    if ((US_NEXUS_RANK[cust.usNexus] >= 2 || cust.chinaExposure >= 60) && !cust.selfCustody && a.ultimateCustodian !== "Unknown")
      custodianSet.add(a.ultimateCustodian);
    // …and the most-controllable value forms.
    if (getAssetClass(a.assetClass).controllability >= 70) assetClassSet.add(a.assetClass);

    // dependency chain: asset → custodian → each settlement network
    addEdge(a.id, a.ultimateCustodian || "Unknown", "custodian_dependency");
    for (const n of nets) addEdge(a.ultimateCustodian || "Unknown", n, "settlement_dependency");
  }

  return {
    nodes: assets, // raw Asset[] (spec §2 schema)
    war_paths, // computed WarPath[] (spec §4)
    ofac_distribution, // counts of HIGH/MEDIUM/LOW/NONE
    exposure_index, // mean axis scores (extension, for the viewer)
    kill_chain_risk_map: {
      settlement_risk_nodes: [...settlementSet],
      custodian_risk_nodes: [...custodianSet],
      asset_class_risk_nodes: [...assetClassSet],
    },
    dependency_edges: edges,
  };
}

// ─────────────────── §6 · Migration (auto-upgrade old assets, NO data loss) ───────────────────
const ASSET_CLASS_MAP = {
  Equity: "Equity",
  ETF: "ETF",
  Cash: "Cash",
  Gold: "PhysicalGold",
  PhysicalGold: "PhysicalGold",
  RealEstate: "RealEstate",
  Crypto: "Crypto",
};
const JURISDICTION_MAP = {
  US: "US",
  Singapore: "Singapore",
  HongKong: "HongKong",
  ChinaMainland: "China",
  China: "China",
  SelfCustody: "NoCustody",
  NoCustody: "NoCustody",
  DMCC: "DMCC_Dubai",
  DMCC_Dubai: "DMCC_Dubai",
};

export function migrateLegacyPosition(old) {
  return {
    id: old.id,
    assetClass: ASSET_CLASS_MAP[old.assetType] || "Unknown",
    custodyJurisdiction: JURISDICTION_MAP[old.custodyCountry] || "Unknown",
    settlementSystem: "Unknown",
    assetType: old.assetType ?? "Unknown",
    jurisdiction: old.jurisdiction ?? old.custodyCountry ?? "Unknown",
    exchange: old.exchange ?? "Unknown",
    broker: old.broker ?? old.institution ?? null, // preserved if it exists
    ultimateCustodian: "Unknown",
    settlementNetwork: ["Unknown"],
    beneficialOwnershipModel: "unknown",
    _legacy: { ...old }, // NO DATA LOSS — original facts kept verbatim
  };
}
