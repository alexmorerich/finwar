// FINWAR v4.0 — Asset Coordinate Engine · the four layer reference tables.
//
// FINWAR v4.0 is a deterministic 3-axis asset *exposure coordinate* engine. It is
// NOT a portfolio system, trading system, recommendation engine, or optimizer. It
// answers exactly one question:
//
//   "Where is this asset located inside OFAC–SAFE–CRS space?"
//
// Every asset is four orthogonal coordinates (spec LAYER 1–4), highest priority
// first:
//
//   LAYER 1  Settlement System    / 结算体系     (highest priority)
//   LAYER 2  Custody Jurisdiction  / 托管司法区
//   LAYER 3  Ownership Model       / 所有权模式   (drives confiscation resistance)
//   LAYER 4  Asset Class           / 资产类别     (lowest priority)
//
// Each layer value carries a BILINGUAL label (en / zh — every on-screen string is
// "English / 中文") plus its score on the three sovereign axes, each 0–100:
//
//   ofac : OFAC Exposure / OFAC风险   — US sanction reach (settlement rail / custody)
//   safe : SAFE Exposure / SAFE风险   — China SAFE capital-control / outbound lock
//   crs  : CRS Exposure  / CRS风险    — Common Reporting Standard tax visibility
//
// Calibration lineage: the v3.3 kill-chain nodes (engine/terrain/nodes.js — OFAC
// US-nexus, capitalControl, taxTransparency) folded down from the deep
// settlementNetwork/custodian model into the v4.0 four-field AssetNode. The four
// layers are fused by calculateExposure() (coordinate_engine.js) with the layer
// priority weights below. All values are illustrative and tunable.

// ─────────────────── Axis definitions (bilingual) ───────────────────
export const AXES = {
  OFAC: { key: "OFAC", en: "OFAC Exposure", zh: "OFAC风险", x: "x" },
  SAFE: { key: "SAFE", en: "SAFE Exposure", zh: "SAFE风险", y: "y" },
  CRS:  { key: "CRS",  en: "CRS Exposure",  zh: "CRS风险",  z: "z" },
};

// ─────────────────── Layer priority weights (spec: settlement ≫ asset class) ───────────────────
// Settlement System is the highest-priority layer; Asset Class is the lowest.
// Weights sum to 1.0, so every fused exposure stays in [0,1].
export const LAYER_PRIORITY = {
  settlement_system:    0.40, // LAYER 1 — highest
  custody_jurisdiction: 0.30, // LAYER 2
  ownership_model:      0.20, // LAYER 3
  asset_class:          0.10, // LAYER 4 — lowest
};

// ─────────────────── LAYER 1 · Settlement System / 结算体系 ───────────────────
// The rail an asset ultimately settles on — the highest-priority coordinate.
// (Encode the TRUE settlement system, not the listing label: an SGX-listed ETF
//  that clears DTC/CHIPS is `US_Settlement`, because that is where it settles.)
export const SETTLEMENT_SYSTEMS = {
  US_Settlement:            { en: "US Settlement",            zh: "美国结算体系",   ofac: 95, safe:  5, crs: 70 },
  Singapore_Settlement:     { en: "Singapore Settlement",     zh: "新加坡结算体系", ofac: 30, safe: 20, crs: 75 },
  HongKong_Settlement:      { en: "Hong Kong Settlement",     zh: "香港结算体系",   ofac: 45, safe: 50, crs: 65 },
  China_Settlement:         { en: "China Settlement",         zh: "中国结算体系",   ofac: 25, safe: 95, crs: 40 },
  Decentralized_Settlement: { en: "Decentralized Settlement", zh: "去中心化结算",   ofac:  8, safe:  8, crs:  8 },
  Issuer_Crypto_Settlement: { en: "Issuer Crypto Settlement", zh: "发行方加密结算", ofac: 70, safe: 30, crs: 30 },
  Physical_Gold_Settlement: { en: "Physical Gold Settlement", zh: "实物黄金结算",   ofac:  5, safe: 10, crs: 20 },
  Real_Estate_Settlement:   { en: "Real Estate Settlement",   zh: "房地产结算",     ofac: 15, safe: 60, crs: 50 },
};

// ─────────────────── LAYER 2 · Custody Jurisdiction / 托管司法区 ───────────────────
export const CUSTODY_JURISDICTIONS = {
  US:            { en: "United States", zh: "美国",     ofac: 90, safe:  5, crs: 80 },
  Singapore:     { en: "Singapore",     zh: "新加坡",   ofac: 35, safe: 20, crs: 75 },
  HongKong:      { en: "Hong Kong",     zh: "香港",     ofac: 40, safe: 55, crs: 65 },
  ChinaMainland: { en: "China Mainland", zh: "中国大陆", ofac: 25, safe: 95, crs: 35 },
  DMCC:          { en: "Dubai DMCC",    zh: "迪拜DMCC", ofac: 30, safe: 15, crs: 45 },
  None:          { en: "No Custody",    zh: "无托管",   ofac:  5, safe:  5, crs:  8 },
};

// ─────────────────── LAYER 3 · Ownership Model / 所有权模式 ───────────────────
// Affects confiscation resistance: a self-custodied / bearer holding has no
// compellable intermediary, so it sits low on OFAC and CRS regardless of class.
export const OWNERSHIP_MODELS = {
  custodian:           { en: "Custodian",            zh: "托管模式",     ofac: 80, safe: 60, crs: 85 },
  nominee:             { en: "Nominee",              zh: "名义持有",     ofac: 90, safe: 65, crs: 90 },
  self_custody:        { en: "Self Custody",         zh: "自主保管",     ofac:  5, safe: 10, crs:  5 },
  physical_possession: { en: "Physical Possession",  zh: "实物持有",     ofac: 10, safe: 20, crs: 12 },
  bearer:              { en: "Bearer Asset",         zh: "不记名资产",   ofac: 12, safe: 15, crs:  8 },
  direct_register:     { en: "Direct Registration",  zh: "直接登记",     ofac: 50, safe: 55, crs: 70 },
};

// ─────────────────── LAYER 4 · Asset Class / 资产类别 ───────────────────
// The lowest-priority coordinate — it nudges, it never dominates.
export const ASSET_CLASSES = {
  Equity:       { en: "Equity",         zh: "股票",     ofac: 60, safe: 55, crs: 70 },
  ETF:          { en: "ETF",            zh: "ETF",      ofac: 65, safe: 55, crs: 72 },
  FixedIncome:  { en: "Fixed Income",   zh: "固定收益", ofac: 65, safe: 50, crs: 70 },
  Cash:         { en: "Cash",           zh: "现金",     ofac: 55, safe: 60, crs: 60 },
  PhysicalGold: { en: "Physical Gold",  zh: "实物黄金", ofac: 10, safe: 15, crs: 30 },
  RealEstate:   { en: "Real Estate",    zh: "房地产",   ofac: 20, safe: 70, crs: 50 },
  Crypto:       { en: "Cryptocurrency", zh: "加密货币", ofac: 15, safe: 15, crs: 10 },
  Stablecoin:   { en: "Stablecoin",     zh: "稳定币",   ofac: 70, safe: 35, crs: 25 },
  PrivateAsset: { en: "Private Asset",  zh: "私募资产", ofac: 45, safe: 55, crs: 40 },
};

// ─────────────────── Panel titles (spec UI PANELS 1–6, bilingual) ───────────────────
export const PANELS = {
  coordinates:          { en: "Asset Coordinates",   zh: "资产坐标" },
  settlement_system:    { en: "Settlement System",   zh: "结算体系" },
  custody_jurisdiction: { en: "Custody Jurisdiction", zh: "托管司法区" },
  ownership_model:      { en: "Ownership Model",      zh: "所有权模式" },
  asset_class:          { en: "Asset Class",          zh: "资产类别" },
  terrain:              { en: "3D Terrain Map",        zh: "三维风险地图" },
};

// Neutral midpoint — used only when an AssetNode carries an out-of-enum value, so
// the engine scores it (50,50,50) instead of throwing. Mirrors the v3.3 engine's
// tolerant `Unknown` fallback (no crash, no data loss).
const FALLBACK = { en: "Unknown", zh: "未知", ofac: 50, safe: 50, crs: 50 };

// ─────────────────── Tolerant getters (out-of-enum → neutral midpoint, never throw) ───────────────────
export const getSettlement  = (k) => SETTLEMENT_SYSTEMS[k]    || FALLBACK;
export const getJurisdiction = (k) => CUSTODY_JURISDICTIONS[k] || FALLBACK;
export const getOwnership   = (k) => OWNERSHIP_MODELS[k]      || FALLBACK;
export const getAssetClass  = (k) => ASSET_CLASSES[k]         || FALLBACK;

// Bilingual helper: "English / 中文" for any { en, zh } record (the on-screen format).
export const bi = (rec) => (rec ? `${rec.en} / ${rec.zh}` : "—");
