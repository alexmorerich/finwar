// FINWAR — Current-holdings facts catalog (the user's 8 sanction-risk paths).
//
// WHAT THIS IS  ── a factual CALIBRATION / INPUT catalog. It is the user's stated
// current positions, grouped into the eight escape/sanction-risk PATHS they
// actually use, transcribed verbatim. It is NOT WorldState output, NOT an
// allocation/optimizer, NOT investment advice.
//
// WHAT THIS IS NOT ── it never enters WorldState, asset_risk_matrix, or the
// assetCoordinate() output. Those stay portfolio-INDEPENDENT (see
// src/contracts/world_state.ts). This catalog is a sibling facts layer that we
// *derive coverage from* (every holding must map cleanly onto the v4.0 coordinate
// engine's four layers AND the v3.3 kill-chain engine's nodes), so the engines'
// enums are proven to span the real book.
//
// RAW PERCENTAGES ── `stated_pct` values are copied EXACTLY from the user's data
// and intentionally DO NOT sum to 100 (they sum to 119). We never normalize: the
// gap between a path's `declared_path_pct` and the sum of its holdings' stated_pct
// is itself a signal (a declared/stated mismatch report), and inventing or
// rescaling holdings would destroy that signal. (See declaredVsStatedReport().)
//
// Each holding is annotated with BOTH vocabularies so the catalog cross-checks
// against both engines without "Unknown":
//   • coordinate (engine/coordinate/layers.js): settlement_system /
//     custody_jurisdiction / ownership_model / asset_class
//   • kill-chain (engine/terrain/nodes.js): settlement_network[] /
//     ultimate_custodian / beneficial_ownership_model
//   • risk_bucket: FinWar's holdings taxonomy (a SUPERSET of the WorldState
//     RiskBucket enum — see RISK_BUCKETS / CONTRACT_GAPS below).

// ─────────────────── Path metadata (the 8 sanction-risk paths) ───────────────────
// declared_path_pct is the user's stated target for the whole path (null where the
// user gave no path-level figure). It is compared — never reconciled — against the
// sum of the path's holdings' stated_pct.
export const PATHS = [
  { path_id: 1, path_label: "US path DTCC/SWIFT/CHIPS",        declared_path_pct: 20 },
  { path_id: 2, path_label: "Singapore path CDP/SGX/PayNow",   declared_path_pct: null },
  { path_id: 3, path_label: "HKEX + FPS path",                 declared_path_pct: null },
  { path_id: 4, path_label: "China CNSDC + CIPS Path",         declared_path_pct: 10 },
  { path_id: 5, path_label: "cold wallet Decentralized Path",  declared_path_pct: 15 },
  { path_id: 6, path_label: "cold wallet Issuer Risk Path",    declared_path_pct: 15 },
  { path_id: 7, path_label: "Gold physical bar Path",          declared_path_pct: 35 },
  { path_id: 8, path_label: "Real estate path",                declared_path_pct: 20 },
];

const PATH_LABEL = Object.fromEntries(PATHS.map((p) => [p.path_id, p.path_label]));
const PATH_DECLARED = Object.fromEntries(PATHS.map((p) => [p.path_id, p.declared_path_pct]));

// ─────────────────── risk_bucket taxonomy (superset of WorldState RiskBucket) ───────────────────
// The WorldState contract (src/contracts/world_state.ts) ships EIGHT buckets and is
// intentionally NOT modified here: adding an issuer-token or SG-equity bucket there
// would fork the shared FinOS contract and break the sibling decide(). So the
// catalog keeps its own (richer) bucket taxonomy and maps each one to the nearest
// WorldState bucket, flagging the cases where the fit is lossy as CONTRACT GAPS.
export const WORLDSTATE_RISK_BUCKETS = [
  "US_EQUITY", "HK_BROKERAGE", "CN_ONSHORE", "CRYPTO_COLD",
  "GOLD_PHYSICAL", "USD_CASH", "OFFSHORE_USD", "REAL_ESTATE",
];

export const RISK_BUCKETS = {
  // ── clean 1:1 with a WorldState bucket ──
  US_EQUITY:     { worldstate: "US_EQUITY",     gap: false, label: "US-settled brokerage security (DTCC/DTC/CHIPS)" },
  OFFSHORE_USD:  { worldstate: "OFFSHORE_USD",  gap: false, label: "Offshore USD deposit / money-market (correspondent-cleared)" },
  HK_BROKERAGE:  { worldstate: "HK_BROKERAGE",  gap: false, label: "HK-jurisdiction regulated holding (CCASS/FPS)" },
  CN_ONSHORE:    { worldstate: "CN_ONSHORE",    gap: false, label: "Mainland China onshore holding (CNSDC/CIPS)" },
  CRYPTO_COLD:   { worldstate: "CRYPTO_COLD",   gap: false, label: "Self-custody censorship-resistant crypto (BTC/XMR)" },
  GOLD_PHYSICAL: { worldstate: "GOLD_PHYSICAL", gap: false, label: "Bearer physical gold" },
  REAL_ESTATE:   { worldstate: "REAL_ESTATE",   gap: false, label: "Registered real estate" },

  // ── documented CONTRACT GAPS — no clean WorldState bucket exists ──
  SG_EQUITY: {
    worldstate: "HK_BROKERAGE", gap: true,
    label: "Singapore-settled equity (CDP direct-register)",
    reason: "WorldState has no Singapore-brokerage bucket. Mapped to the nearest offshore-Asian-equity bucket (HK_BROKERAGE) for FinOS bucket-matching; the true profile is carried by the Singapore_Settlement coordinate + the CDP/MEPS+/PayNow kill chain.",
  },
  ISSUER_STABLECOIN: {
    worldstate: "OFFSHORE_USD", gap: true,
    label: "Issuer-freezable USD-pegged token (USDC/USDT)",
    reason: "An issuer (Circle/Tether) can freeze the on-chain address — this is NOT a censorship-resistant coin, so it must NOT map to CRYPTO_COLD. WorldState has no issuer-token bucket; mapped by freezability to OFFSHORE_USD (a freezable USD claim). Issuer-freeze reach is carried by the Issuer_Crypto_Settlement coordinate.",
  },
  ISSUER_GOLD_TOKEN: {
    worldstate: "OFFSHORE_USD", gap: true,
    label: "Issuer-freezable gold-pegged token (XAUT)",
    reason: "Gold-pegged issuer token (paper gold) — issuer-freezable, NOT bearer metal, so it must NOT map to GOLD_PHYSICAL or CRYPTO_COLD. WorldState has no issuer-token bucket; mapped by freezability to OFFSHORE_USD. Issuer-freeze reach is carried by the Issuer_Crypto_Settlement coordinate.",
  },
};

// The documented gaps, surfaced as a first-class list (README + validation refer to it).
export const CONTRACT_GAPS = Object.entries(RISK_BUCKETS)
  .filter(([, v]) => v.gap)
  .map(([bucket, v]) => ({ catalog_bucket: bucket, worldstate_bucket: v.worldstate, reason: v.reason }));

// ─────────────────── helper to keep the 26 entries terse but explicit ───────────────────
function H(o) {
  return {
    id: o.id,
    path_id: o.path_id,
    path_label: PATH_LABEL[o.path_id],
    declared_path_pct: PATH_DECLARED[o.path_id], // echoed from the path (null if none)
    stated_pct: o.stated_pct,                    // RAW — never normalized
    institution: o.institution,
    account_jurisdiction: o.account_jurisdiction,
    instrument: o.instrument,
    ticker: o.ticker ?? null,
    needs_ticker_verification: o.needs_ticker_verification ?? false,
    currency: o.currency,
    // coordinate engine (v4.0) four-layer coordinates
    settlement_system: o.settlement_system,
    custody_jurisdiction: o.custody_jurisdiction,
    ownership_model: o.ownership_model,
    asset_class: o.asset_class,
    // kill-chain engine (v3.3) nodes
    settlement_network: o.settlement_network,
    ultimate_custodian: o.ultimate_custodian,
    beneficial_ownership_model: o.beneficial_ownership_model,
    // FinWar holdings taxonomy (maps to a WorldState bucket via RISK_BUCKETS)
    risk_bucket: o.risk_bucket,
    notes: o.notes ?? null,
  };
}

// ─────────────────── The 26 stated holdings, grouped by path ───────────────────
export const CURRENT_HOLDINGS = [
  // ══ Path 1 · US path DTCC/SWIFT/CHIPS · declared 20 / stated 18 ══
  H({ id: "p1-ibkr-gldm", path_id: 1, stated_pct: 1,
      institution: "Interactive Brokers (IBKR)", account_jurisdiction: "US",
      instrument: "SPDR Gold MiniShares (GLDM)", ticker: "GLDM", currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "US", ownership_model: "nominee", asset_class: "ETF",
      settlement_network: ["DTCC", "DTC", "CHIPS"], ultimate_custodian: "StateStreet", beneficial_ownership_model: "nominee",
      risk_bucket: "US_EQUITY", notes: "Gold-bar parking fund (USD-settled gold ETF — paper, not bearer metal)." }),
  H({ id: "p1-schwab-qqqm", path_id: 1, stated_pct: 1,
      institution: "Charles Schwab", account_jurisdiction: "US",
      instrument: "Invesco NASDAQ-100 ETF (QQQM)", ticker: "QQQM", currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "US", ownership_model: "nominee", asset_class: "ETF",
      settlement_network: ["DTCC", "DTC", "CHIPS"], ultimate_custodian: "BNYMellon", beneficial_ownership_model: "nominee",
      risk_bucket: "US_EQUITY", notes: "US large-cap tech ETF at a US broker." }),
  H({ id: "p1-dbs-sg-usd-fd", path_id: 1, stated_pct: 1,
      institution: "DBS Bank (Singapore)", account_jurisdiction: "Singapore",
      instrument: "USD fixed deposit", ticker: null, currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "Singapore", ownership_model: "custodian", asset_class: "Cash",
      settlement_network: ["CHIPS", "SWIFT"], ultimate_custodian: "DBS", beneficial_ownership_model: "custodian",
      risk_bucket: "OFFSHORE_USD", notes: "USD term deposit; USD-correspondent (CHIPS/SWIFT) clearing despite SG custody." }),
  H({ id: "p1-sc-sg-o87", path_id: 1, stated_pct: 1,
      institution: "Standard Chartered (Singapore)", account_jurisdiction: "Singapore",
      instrument: "SPDR Gold Shares (SGX O87)", ticker: "O87", currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "Singapore", ownership_model: "nominee", asset_class: "ETF",
      settlement_network: ["CDP", "DTC", "CHIPS"], ultimate_custodian: "StateStreet", beneficial_ownership_model: "nominee",
      risk_bucket: "US_EQUITY", notes: "SGX-listed (O87) but US-cleared via DTC/CHIPS at State Street — the label lies, the rail does not." }),
  H({ id: "p1-sc-sg-s27", path_id: 1, stated_pct: 1,
      institution: "Standard Chartered (Singapore)", account_jurisdiction: "Singapore",
      instrument: "SPDR S&P 500 ETF (SGX S27)", ticker: "S27", currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "Singapore", ownership_model: "nominee", asset_class: "ETF",
      settlement_network: ["CDP", "DTC", "CHIPS"], ultimate_custodian: "StateStreet", beneficial_ownership_model: "nominee",
      risk_bucket: "US_EQUITY", notes: "SGX-listed (S27) S&P 500 tracker, US-cleared via DTC/CHIPS." }),
  H({ id: "p1-winglung-hk-sgov", path_id: 1, stated_pct: 5,
      institution: "Wing Lung Bank (HK)", account_jurisdiction: "HongKong",
      instrument: "iShares 0-3M Treasury ETF (SGOV)", ticker: "SGOV", currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "US", ownership_model: "nominee", asset_class: "ETF",
      settlement_network: ["DTCC", "DTC", "CHIPS"], ultimate_custodian: "StateStreet", beneficial_ownership_model: "nominee",
      risk_bucket: "US_EQUITY", notes: "US T-bill ETF held via a HK bank; US rails reach it (custody US)." }),
  H({ id: "p1-bochk-vgsh", path_id: 1, stated_pct: 5,
      institution: "Bank of China (Hong Kong) / BOCHK", account_jurisdiction: "HongKong",
      instrument: "Vanguard Short-Term Treasury ETF (VGSH)", ticker: "VGSH", currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "US", ownership_model: "nominee", asset_class: "ETF",
      settlement_network: ["DTCC", "DTC", "CHIPS"], ultimate_custodian: "BNYMellon", beneficial_ownership_model: "nominee",
      risk_bucket: "US_EQUITY", notes: "US Treasury ETF held via BOCHK; US-cleared (custody US)." }),
  H({ id: "p1-dbs-hk-usd-fd", path_id: 1, stated_pct: 1,
      institution: "DBS Bank (Hong Kong)", account_jurisdiction: "HongKong",
      instrument: "USD fixed deposit", ticker: null, currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "HongKong", ownership_model: "custodian", asset_class: "Cash",
      settlement_network: ["CHIPS", "SWIFT"], ultimate_custodian: "DBS", beneficial_ownership_model: "custodian",
      risk_bucket: "OFFSHORE_USD", notes: "USD term deposit at DBS HK; USD-correspondent clearing." }),
  H({ id: "p1-winglung-hk-usd-mmf", path_id: 1, stated_pct: 1,
      institution: "Wing Lung Bank (HK)", account_jurisdiction: "HongKong",
      instrument: "USD money-market fund", ticker: null, currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "HongKong", ownership_model: "custodian", asset_class: "Cash",
      settlement_network: ["CHIPS", "SWIFT"], ultimate_custodian: "HSBC", beneficial_ownership_model: "custodian",
      risk_bucket: "OFFSHORE_USD", notes: "USD MMF at Wing Lung HK (HSBC as USD-correspondent custodian proxy)." }),
  H({ id: "p1-bochk-usd-mmf", path_id: 1, stated_pct: 1,
      institution: "Bank of China (Hong Kong) / BOCHK", account_jurisdiction: "HongKong",
      instrument: "USD money-market fund", ticker: null, currency: "USD",
      settlement_system: "US_Settlement", custody_jurisdiction: "HongKong", ownership_model: "custodian", asset_class: "Cash",
      settlement_network: ["CHIPS", "SWIFT"], ultimate_custodian: "HSBC", beneficial_ownership_model: "custodian",
      risk_bucket: "OFFSHORE_USD", notes: "USD MMF at BOCHK (HSBC as USD-correspondent custodian proxy)." }),

  // ══ Path 2 · Singapore path CDP/SGX/PayNow · no declared target / stated 6 ══
  H({ id: "p2-dbs-d05", path_id: 2, stated_pct: 5,
      institution: "DBS Bank (Singapore)", account_jurisdiction: "Singapore",
      instrument: "DBS Group Holdings (SGX D05)", ticker: "D05", currency: "SGD",
      settlement_system: "Singapore_Settlement", custody_jurisdiction: "Singapore", ownership_model: "direct_register", asset_class: "Equity",
      settlement_network: ["CDP", "MEPS+", "PayNow"], ultimate_custodian: "CDP", beneficial_ownership_model: "direct_register",
      risk_bucket: "SG_EQUITY", notes: "Pure-Singapore kill chain (CDP/MEPS+/PayNow) — never touches a US rail." }),
  H({ id: "p2-dbs-gls", path_id: 2, stated_pct: 1,
      institution: "DBS Bank (Singapore)", account_jurisdiction: "Singapore",
      instrument: "DBS Bank stock (GLS)", ticker: "GLS", needs_ticker_verification: true, currency: "SGD",
      settlement_system: "Singapore_Settlement", custody_jurisdiction: "Singapore", ownership_model: "direct_register", asset_class: "Equity",
      settlement_network: ["CDP", "MEPS+", "PayNow"], ultimate_custodian: "CDP", beneficial_ownership_model: "direct_register",
      risk_bucket: "SG_EQUITY", notes: "Ticker 'GLS' preserved verbatim from stated data — needs_ticker_verification=true (no other field is Unknown)." }),

  // ══ Path 3 · HKEX + FPS path · no declared target / stated 12 ══
  H({ id: "p3-sc-hk-3081", path_id: 3, stated_pct: 5,
      institution: "Standard Chartered (Hong Kong)", account_jurisdiction: "HongKong",
      instrument: "Value Gold ETF (HKEX 3081)", ticker: "3081", currency: "HKD",
      settlement_system: "HongKong_Settlement", custody_jurisdiction: "HongKong", ownership_model: "custodian", asset_class: "ETF",
      settlement_network: ["CCASS", "FPS"], ultimate_custodian: "HSBC", beneficial_ownership_model: "custodian",
      risk_bucket: "HK_BROKERAGE", notes: "HK-listed gold-backed ETF; settles via CCASS (paper ETF, not bearer gold)." }),
  H({ id: "p3-sc-hk-2800", path_id: 3, stated_pct: 5,
      institution: "Standard Chartered (Hong Kong)", account_jurisdiction: "HongKong",
      instrument: "Tracker Fund of Hong Kong (HKEX 2800)", ticker: "2800", currency: "HKD",
      settlement_system: "HongKong_Settlement", custody_jurisdiction: "HongKong", ownership_model: "custodian", asset_class: "ETF",
      settlement_network: ["CCASS", "FPS"], ultimate_custodian: "HSBC", beneficial_ownership_model: "custodian",
      risk_bucket: "HK_BROKERAGE", notes: "HK equity index ETF; HK rails, HSBC custodian (USD-correspondent → OFAC MEDIUM)." }),
  H({ id: "p3-winglung-hk-hkd-mmf", path_id: 3, stated_pct: 1,
      institution: "Wing Lung Bank (HK)", account_jurisdiction: "HongKong",
      instrument: "HKD money-market fund", ticker: null, currency: "HKD",
      settlement_system: "HongKong_Settlement", custody_jurisdiction: "HongKong", ownership_model: "custodian", asset_class: "Cash",
      settlement_network: ["FPS"], ultimate_custodian: "HSBC", beneficial_ownership_model: "custodian",
      risk_bucket: "HK_BROKERAGE", notes: "HKD MMF at Wing Lung HK (HKD peg → USD-correspondent exposure)." }),
  H({ id: "p3-bochk-hkd-mmf", path_id: 3, stated_pct: 1,
      institution: "Bank of China (Hong Kong) / BOCHK", account_jurisdiction: "HongKong",
      instrument: "HKD money-market fund", ticker: null, currency: "HKD",
      settlement_system: "HongKong_Settlement", custody_jurisdiction: "HongKong", ownership_model: "custodian", asset_class: "Cash",
      settlement_network: ["FPS"], ultimate_custodian: "HSBC", beneficial_ownership_model: "custodian",
      risk_bucket: "HK_BROKERAGE", notes: "HKD MMF at BOCHK." }),

  // ══ Path 4 · China CNSDC + CIPS Path · declared 10 / stated 10 ══
  H({ id: "p4-huatai-csi300", path_id: 4, stated_pct: 5,
      institution: "Huatai-PineBridge", account_jurisdiction: "ChinaMainland",
      instrument: "Huatai-PineBridge CSI 300 ETF (510300)", ticker: "510300", currency: "CNY",
      settlement_system: "China_Settlement", custody_jurisdiction: "ChinaMainland", ownership_model: "direct_register", asset_class: "ETF",
      settlement_network: ["CNSDC"], ultimate_custodian: "CNSDC", beneficial_ownership_model: "direct_register",
      risk_bucket: "CN_ONSHORE", notes: "Onshore A-share ETF; CNSDC-settled, SAFE capital-control trap." }),
  H({ id: "p4-rmb-cash", path_id: 4, stated_pct: 5,
      institution: "Mainland China bank", account_jurisdiction: "ChinaMainland",
      instrument: "RMB demand deposit", ticker: null, currency: "CNY",
      settlement_system: "China_Settlement", custody_jurisdiction: "ChinaMainland", ownership_model: "custodian", asset_class: "Cash",
      settlement_network: ["CIPS"], ultimate_custodian: "CNSDC", beneficial_ownership_model: "custodian",
      risk_bucket: "CN_ONSHORE", notes: "Onshore RMB cash; deepest SAFE trap. CNSDC used as the China-system custodian proxy (terrain enum lacks a mainland retail-bank node)." }),

  // ══ Path 5 · cold wallet Decentralized Path · declared 15 / stated 11 ══
  H({ id: "p5-btc-cold", path_id: 5, stated_pct: 10,
      institution: "Self-custody cold wallet", account_jurisdiction: "None",
      instrument: "Bitcoin (BTC)", ticker: "BTC", currency: "BTC",
      settlement_system: "Decentralized_Settlement", custody_jurisdiction: "None", ownership_model: "self_custody", asset_class: "Crypto",
      settlement_network: ["Bitcoin"], ultimate_custodian: "SelfCustody", beneficial_ownership_model: "self_custody",
      risk_bucket: "CRYPTO_COLD", notes: "Self-custody hardware wallet; censorship-resistant, no compellable intermediary (OFAC NONE)." }),
  H({ id: "p5-xmr-cold", path_id: 5, stated_pct: 1,
      institution: "Self-custody cold wallet", account_jurisdiction: "None",
      instrument: "Monero (XMR)", ticker: "XMR", currency: "XMR",
      settlement_system: "Decentralized_Settlement", custody_jurisdiction: "None", ownership_model: "self_custody", asset_class: "Crypto",
      settlement_network: ["Bitcoin"], ultimate_custodian: "SelfCustody", beneficial_ownership_model: "self_custody",
      risk_bucket: "CRYPTO_COLD", notes: "Privacy coin; terrain rail enum lacks a Monero node → mapped to the Bitcoin decentralized-rail category (usNexus none — OFAC-equivalent)." }),

  // ══ Path 6 · cold wallet Issuer Risk Path · declared 15 / stated 7 ══
  // NOT BTC/XMR: an issuer can freeze these on-chain — modeled via Issuer_Crypto_Settlement.
  H({ id: "p6-usdc-cold", path_id: 6, stated_pct: 5,
      institution: "Self-custody cold wallet (issuer-controlled token)", account_jurisdiction: "None",
      instrument: "USD Coin (USDC)", ticker: "USDC", currency: "USDC",
      settlement_system: "Issuer_Crypto_Settlement", custody_jurisdiction: "None", ownership_model: "self_custody", asset_class: "Stablecoin",
      settlement_network: ["Ethereum"], ultimate_custodian: "SelfCustody", beneficial_ownership_model: "self_custody",
      risk_bucket: "ISSUER_STABLECOIN", notes: "Issuer (Circle, US-regulated) can freeze the address — NOT censorship-resistant. Keys self-held; issuer is an off-enum kill switch (coordinate Issuer_Crypto_Settlement carries the OFAC reach the terrain rail engine under-captures)." }),
  H({ id: "p6-xaut-cold", path_id: 6, stated_pct: 1,
      institution: "Self-custody cold wallet (issuer-controlled token)", account_jurisdiction: "None",
      instrument: "Tether Gold (XAUT)", ticker: "XAUT", currency: "XAUT",
      settlement_system: "Issuer_Crypto_Settlement", custody_jurisdiction: "None", ownership_model: "self_custody", asset_class: "Stablecoin",
      settlement_network: ["Ethereum"], ultimate_custodian: "SelfCustody", beneficial_ownership_model: "self_custody",
      risk_bucket: "ISSUER_GOLD_TOKEN", notes: "Gold-pegged issuer token (Tether) — issuer-freezable paper gold, NOT bearer metal. Classed as Stablecoin (issuer-pegged token) to carry the issuer-freeze OFAC weight." }),
  H({ id: "p6-usdt-cold", path_id: 6, stated_pct: 1,
      institution: "Self-custody cold wallet (issuer-controlled token)", account_jurisdiction: "None",
      instrument: "Tether USD (USDT)", ticker: "USDT", currency: "USDT",
      settlement_system: "Issuer_Crypto_Settlement", custody_jurisdiction: "None", ownership_model: "self_custody", asset_class: "Stablecoin",
      settlement_network: ["TRON"], ultimate_custodian: "SelfCustody", beneficial_ownership_model: "self_custody",
      risk_bucket: "ISSUER_STABLECOIN", notes: "Issuer (Tether) can freeze the address — NOT censorship-resistant. TRON rail." }),

  // ══ Path 7 · Gold physical bar Path · declared 35 / stated 35 ══
  H({ id: "p7-cn-gold-physical", path_id: 7, stated_pct: 10,
      institution: "Self-stored / mainland vault", account_jurisdiction: "ChinaMainland",
      instrument: "Physical gold bar (China mainland)", ticker: null, currency: "XAU",
      settlement_system: "Physical_Gold_Settlement", custody_jurisdiction: "ChinaMainland", ownership_model: "physical_possession", asset_class: "PhysicalGold",
      settlement_network: ["Physical"], ultimate_custodian: "PhysicalPossession", beneficial_ownership_model: "bearer",
      risk_bucket: "GOLD_PHYSICAL", notes: "Cannot move out under border closure / export control — jurisdiction-locked bearer metal (SAFE-trapped despite bearer ownership)." }),
  H({ id: "p7-dmcc-gold-physical", path_id: 7, stated_pct: 25,
      institution: "DMCC Dubai vault", account_jurisdiction: "DMCC",
      instrument: "Physical gold bar (DMCC Dubai vault)", ticker: null, currency: "XAU",
      settlement_system: "Physical_Gold_Settlement", custody_jurisdiction: "DMCC", ownership_model: "bearer", asset_class: "PhysicalGold",
      settlement_network: ["Physical"], ultimate_custodian: "PhysicalPossession", beneficial_ownership_model: "bearer",
      risk_bucket: "GOLD_PHYSICAL", notes: "Bearer metal in a Dubai DMCC vault — near the safe origin on every axis." }),

  // ══ Path 8 · Real estate path · declared 20 / stated 20 ══
  H({ id: "p8-shenzhen-real-estate", path_id: 8, stated_pct: 20,
      institution: "Shenzhen registered title", account_jurisdiction: "ChinaMainland",
      instrument: "Shenzhen residential real estate", ticker: null, currency: "CNY",
      settlement_system: "Real_Estate_Settlement", custody_jurisdiction: "ChinaMainland", ownership_model: "direct_register", asset_class: "RealEstate",
      settlement_network: ["Physical"], ultimate_custodian: "PhysicalPossession", beneficial_ownership_model: "direct_register",
      risk_bucket: "REAL_ESTATE", notes: "Cannot sell within 10 years — regulatory lock; immovable, state-registered, SAFE-trapped." }),
];

// ─────────────────── Derived facts (counts, sums — never mutate the catalog) ───────────────────
export const META = {
  path_count: PATHS.length,                                                   // 8
  holding_count: CURRENT_HOLDINGS.length,                                     // 26
  stated_pct_total: CURRENT_HOLDINGS.reduce((s, h) => s + h.stated_pct, 0),   // 119 (intentionally ≠ 100)
};

export function statedPctTotal() {
  return CURRENT_HOLDINGS.reduce((s, h) => s + h.stated_pct, 0);
}

export function holdingsByPath(pathId) {
  return CURRENT_HOLDINGS.filter((h) => h.path_id === pathId);
}

// declared vs stated — the deliberate, never-reconciled mismatch report. A path is
// `match:true` only when it declared a target AND its holdings' stated_pct sum to it.
export function declaredVsStatedReport() {
  return PATHS.map((p) => {
    const stated_sum = holdingsByPath(p.path_id).reduce((s, h) => s + h.stated_pct, 0);
    const has_declared = typeof p.declared_path_pct === "number";
    return {
      path_id: p.path_id,
      path_label: p.path_label,
      declared_path_pct: p.declared_path_pct,
      stated_sum,
      delta: has_declared ? stated_sum - p.declared_path_pct : null,
      mismatch: has_declared ? stated_sum !== p.declared_path_pct : false,
      match: has_declared ? stated_sum === p.declared_path_pct : false,
    };
  });
}

// Map a catalog holding to the nearest WorldState RiskBucket (+ gap flag). FinWar
// never *emits* this into WorldState — it is for cross-checking coverage only.
export function worldStateBucketOf(holding) {
  const b = RISK_BUCKETS[holding.risk_bucket];
  return b ? { worldstate_bucket: b.worldstate, gap: b.gap, reason: b.reason ?? null } : null;
}

// Project a holding onto the v4.0 coordinate engine's AssetNode (four layers only).
export function toAssetNode(h) {
  return {
    id: h.id,
    label: h.instrument,
    note: h.notes,
    settlement_system: h.settlement_system,
    custody_jurisdiction: h.custody_jurisdiction,
    ownership_model: h.ownership_model,
    asset_class: h.asset_class,
  };
}

// Project a holding onto the v3.3 kill-chain engine's Asset.
export function toTerrainAsset(h) {
  return {
    id: h.id,
    label: h.instrument,
    assetClass: h.asset_class,
    custodyJurisdiction: h.custody_jurisdiction === "ChinaMainland" ? "China"
      : h.custody_jurisdiction === "DMCC" ? "DMCC_Dubai"
      : h.custody_jurisdiction === "None" ? "NoCustody"
      : h.custody_jurisdiction,
    settlementSystem: h.settlement_system,
    settlementNetwork: h.settlement_network,
    ultimateCustodian: h.ultimate_custodian,
    beneficialOwnershipModel: h.beneficial_ownership_model,
  };
}
