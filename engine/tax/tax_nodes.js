// FINWAR — TAX Engine v2.0 · reference nodes, tables & rule data (zero-dep).
//
// THE CONCEPTUAL SHIFT (spec §11). TAX is no longer "CRS yes/no" (a single
// numeric). It is a multi-layered VISIBILITY + LIABILITY + INHERITANCE + EXIT +
// STRUCTURE risk engine that answers seven questions about an asset:
//   1. Will it be reported?            → informationExchange
//   2. Will its income be taxed?       → incomeTax
//   3. Will it be taxed when sold?     → exitTax
//   4. Will it be taxed when inherited?→ estateGiftTax
//   5. Will it trigger CFC?            → cfcRisk
//   6. Is the structure avoidance?     → antiAvoidance
//   7. Special tax treatment?          → specialAssetTax
//
// SCOPE GUARD: this module ONLY models the TAX axis. It does NOT touch Settlement,
// Custody, the Kill-Chain (engine/terrain), or Sanction logic. The legacy single
// CRS score (engine/terrain/risk_engine.js · taxTransparencyExposure) is left
// intact and is now just ONE node (informationExchange.CRS) of this engine.
//
// 7 CATEGORIES · 17 RISK NODES. All scores 0–100; all values illustrative & tunable.

// ─────────────────── Risk level (shared 0–100 → NONE|LOW|MEDIUM|HIGH band) ───────────────────
export const LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH"];
export const LEVEL_SCORE = { NONE: 0, LOW: 30, MEDIUM: 60, HIGH: 90 }; // representative score for a rule that yields a level

export function levelOf(score) {
  if (score <= 0) return "NONE";
  if (score < 34) return "LOW";
  if (score < 67) return "MEDIUM";
  return "HIGH";
}

export const clamp100 = (x) => Math.max(0, Math.min(100, x));
export const round1 = (x) => Math.round(x * 10) / 10;

// ─────────────────── Jurisdiction normalization (catalog + terrain vocab → canonical) ───────────────────
const JUR = {
  US: "US", "United States": "US",
  Singapore: "SG", SG: "SG",
  HongKong: "HK", "Hong Kong": "HK", HK: "HK",
  ChinaMainland: "CN", China: "CN", CN: "CN",
  DMCC: "AE", DMCC_Dubai: "AE", UAE: "AE", AE: "AE", Dubai: "AE",
  UK: "UK", "United Kingdom": "UK",
  JP: "JP", Japan: "JP",
  None: "NONE", NoCustody: "NONE", "": "NONE",
};
export const normJur = (x) => JUR[x] || "OTHER";

// ─────────────────── Information-exchange reference (spec §2) ───────────────────
// CRS participating jurisdictions (the US is famously NOT one — it runs FATCA).
export const CRS_PARTICIPATING = { US: false, SG: true, HK: true, CN: true, AE: true, UK: true, JP: true, NONE: false, OTHER: true };
// Exchange-of-information-on-request treaty network (broad among majors).
export const EOIR_TREATY = { US: true, SG: true, HK: true, CN: true, AE: true, UK: true, JP: true, NONE: false, OTHER: true };

// ─────────────────── Income-tax reference (spec §3 · rates as 0–100 percent) ───────────────────
export const DIVIDEND_WHT = { US: 30, SG: 0, HK: 0, CN: 10, AE: 0, UK: 0, JP: 15, NONE: 0, OTHER: 15 }; // US ETF dividend → 30%
export const INTEREST_TAX = { US: 0, SG: 0, HK: 0, CN: 10, AE: 0, UK: 0, JP: 15, NONE: 0, OTHER: 10 }; // US portfolio/treasury interest → exempt
export const CAPGAINS_TAX = { US: 0, SG: 0, HK: 0, CN: 20, AE: 0, UK: 20, JP: 20, NONE: 0, OTHER: 15 }; // US non-resident 0; SG 0; CN 20
export const RENTAL_TAX = { US: 30, SG: 22, HK: 15, CN: 20, AE: 0, UK: 20, JP: 20, NONE: 0, OTHER: 20 }; // real-estate only
export const INCOME_WEIGHTS = { dividendWithholding: 0.35, capitalGainsTax: 0.35, interestTax: 0.15, rentalIncomeTax: 0.15 };

// ─────────────────── Exit / disposal-tax reference (spec §4) ───────────────────
// SG real estate ABSD/SSD → HIGH · US FIRPTA → HIGH · HK stamp duty → MEDIUM.
export const REAL_ESTATE_EXIT = { US: 90, SG: 90, HK: 60, CN: 60, AE: 20, UK: 60, JP: 60, NONE: 0, OTHER: 40 };
// Equity transfer / stamp duty (HK ~0.1% stamp = a real friction → MEDIUM).
export const EQUITY_TRANSFER = { US: 0, SG: 0, HK: 50, CN: 50, AE: 0, UK: 50, JP: 0, NONE: 0, OTHER: 10 };

// ─────────────────── Estate & gift reference (spec §5) ───────────────────
// US situs assets > $60k → estate HIGH, gift MEDIUM. UK/JP inheritance → HIGH.
// CN has no estate tax yet → LOW (policy risk only).
export const ESTATE = {
  usEstateThresholdUSD: 60000,
  usEstate: LEVEL_SCORE.HIGH,    // US-situs over threshold
  usGift: LEVEL_SCORE.MEDIUM,    // US-situs gift
  ukInheritance: LEVEL_SCORE.HIGH,
  jpInheritance: LEVEL_SCORE.HIGH,
  cnPotential: LEVEL_SCORE.LOW,  // policy risk
};

// ─────────────────── CFC reference (spec §6) ───────────────────
export const CFC = {
  ownershipFlag: 20,     // nominee/custodian interposed in an entity → +20
  lowTaxJurisdiction: 20,// entity in a low-tax jurisdiction → +20
  passiveIncome: 40,     // passive income > 50% → +40
  passiveThreshold: 0.5,
};
export const LOW_TAX_JURISDICTIONS = new Set(["AE", "HK", "SG"]); // illustrative low/territorial-tax set

// ─────────────────── Anti-avoidance reference (spec §7) ───────────────────
export const ANTI_AVOIDANCE = {
  GAAR: LEVEL_SCORE.HIGH,
  ESR: LEVEL_SCORE.HIGH,             // economic-substance fail
  beneficialOwnerTest: LEVEL_SCORE.HIGH,
  BEPS2: LEVEL_SCORE.MEDIUM,         // global minimum tax (Pillar Two)
};

// ─────────────────── Special-asset reference (spec §8) ───────────────────
// Physical gold: no capital gains, but import/export tax risk (worse if locked).
// Crypto: capital gains + future CRS inclusion. Real estate: property/holding tax
// by jurisdiction. Fund structure: US ETF favorable; non-US/UCITS treaty-dependent.
export const SPECIAL = {
  goldBase: LEVEL_SCORE.MEDIUM,      // 60 — import/export friction
  goldLocked: 80,                    // jurisdiction-locked gold (e.g. CN "cannot move out")
  goldFreeZone: 40,                  // export-friendly zone (DMCC)
  cryptoSelfCustody: 45,             // capgains + pending CRS inclusion
  cryptoIssuer: 55,                  // issuer tokens are more reportable
  realEstateHolding: { US: 60, SG: 50, HK: 30, CN: 40, AE: 10, UK: 50, JP: 40, NONE: 0, OTHER: 30 },
  fundUSeTF: 20,                     // US ETF → favorable
  fundOther: 50,                     // UCITS / non-US fund → treaty-dependent
};
export const SPECIAL_WEIGHTS = { goldTax: 0.25, cryptoTax: 0.25, realEstateHoldingTax: 0.25, fundStructureTax: 0.25 };

// ─────────────────── Final aggregation weights (spec §9 — sum to 1.0) ───────────────────
export const AGG_WEIGHTS = {
  informationExchange: 0.25,
  incomeTax: 0.15,
  exitTax: 0.10,
  estateGiftTax: 0.20,
  cfcRisk: 0.10,
  antiAvoidance: 0.10,
  specialAssetTax: 0.10,
};

// ─────────────────── The 7 categories (each → score / level / reasons) ───────────────────
export const TAX_CATEGORIES = [
  { key: "informationExchange", label: "Information Exchange Risk / 信息交换风险", weight: AGG_WEIGHTS.informationExchange, nodes: ["CRS", "FATCA", "EOIR", "AMLVisibility"] },
  { key: "incomeTax",          label: "Income Tax Risk / 所得税风险",            weight: AGG_WEIGHTS.incomeTax,          nodes: ["income"] },
  { key: "exitTax",            label: "Exit / Disposal Tax Risk / 退出税",        weight: AGG_WEIGHTS.exitTax,            nodes: ["exit"] },
  { key: "estateGiftTax",      label: "Estate & Gift Tax Risk / 遗产税·赠与税",   weight: AGG_WEIGHTS.estateGiftTax,      nodes: ["usEstateTax", "usGiftTax", "ukInheritanceTax", "jpInheritanceTax", "cnPotentialEstateTax"] },
  { key: "cfcRisk",            label: "CFC Risk / 受控外国公司",                  weight: AGG_WEIGHTS.cfcRisk,            nodes: ["cnCFC", "usCFC", "oecdCFC"] },
  { key: "antiAvoidance",      label: "Anti-Avoidance Risk / 反避税",             weight: AGG_WEIGHTS.antiAvoidance,      nodes: ["antiAvoidance"] },
  { key: "specialAssetTax",    label: "Special Asset Tax Risk / 特殊资产税",      weight: AGG_WEIGHTS.specialAssetTax,    nodes: ["specialPhysical", "specialFinancial"] },
];

// ─────────────────── The 17 risk nodes (flattened registry) ───────────────────
// Discrete legal-regime nodes stay expanded (each is a distinct regime); the
// multi-rate categories (income, exit, anti-avoidance) collapse to one node, and
// special-asset splits into physical vs financial. 4+1+1+5+3+1+2 = 17.
export const TAX_RISK_NODES = [
  { id: "ie.crs",   category: "informationExchange", label: "CRS reporting",         fields: ["CRS"] },
  { id: "ie.fatca", category: "informationExchange", label: "FATCA (US person/situs)", fields: ["FATCA"] },
  { id: "ie.eoir",  category: "informationExchange", label: "EOIR treaty",           fields: ["EOIR"] },
  { id: "ie.aml",   category: "informationExchange", label: "AML visibility",        fields: ["AMLVisibility"] },
  { id: "it.income", category: "incomeTax",          label: "Income tax",            fields: ["dividendWithholding", "interestTax", "capitalGainsTax", "rentalIncomeTax"] },
  { id: "et.exit",   category: "exitTax",            label: "Exit / disposal tax",   fields: ["realEstateExitTax", "equityTransferTax"] },
  { id: "eg.us_estate", category: "estateGiftTax",   label: "US estate tax",         fields: ["usEstateTax"] },
  { id: "eg.us_gift",   category: "estateGiftTax",   label: "US gift tax",           fields: ["usGiftTax"] },
  { id: "eg.uk_iht",    category: "estateGiftTax",   label: "UK inheritance tax",    fields: ["ukInheritanceTax"] },
  { id: "eg.jp_iht",    category: "estateGiftTax",   label: "JP inheritance tax",    fields: ["jpInheritanceTax"] },
  { id: "eg.cn_estate", category: "estateGiftTax",   label: "CN potential estate tax", fields: ["cnPotentialEstateTax"] },
  { id: "cfc.cn",   category: "cfcRisk",             label: "CN CFC",                fields: ["cnCFC"] },
  { id: "cfc.us",   category: "cfcRisk",             label: "US CFC (Subpart F/GILTI)", fields: ["usCFC"] },
  { id: "cfc.oecd", category: "cfcRisk",             label: "OECD CFC",              fields: ["oecdCFC"] },
  { id: "aa.anti",  category: "antiAvoidance",       label: "Anti-avoidance (GAAR/BEPS2/ESR/BO)", fields: ["GAAR", "BEPS2", "ESR", "beneficialOwnerTest"] },
  { id: "sa.physical",  category: "specialAssetTax", label: "Special — physical (gold / real-estate holding)", fields: ["goldTax", "realEstateHoldingTax"] },
  { id: "sa.financial", category: "specialAssetTax", label: "Special — financial (crypto / fund structure)",   fields: ["cryptoTax", "fundStructureTax"] },
];
