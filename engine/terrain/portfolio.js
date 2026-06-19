// FINWAR 3D — the holder's actual portfolio (AssetPosition[]).
//
// Holder profile: China-mainland tax resident, Chinese national.
//   → everything offshore is CRS-reportable to China (high Z/TAX across the book);
//     capital-control bite is muted because little sits onshore.
//
// weights are illustrative and MUST sum to 1.0 — edit to your real NAV split.
// Known anchor: IBKR GLDM = USD 150k.
export const PORTFOLIO = [
  // ── US broker — paper gold ETF (US-cleared, CRS-reported) ──
  { id: "ibkr_gldm",  assetType: "Gold",   custodyCountry: "US",          institution: "IBKR",                weight: 0.20 }, // GLDM $150k

  // ── Singapore banks — cash / deposits ──
  { id: "dbs_cash",   assetType: "Cash",   custodyCountry: "Singapore",   institution: "DBS",                 weight: 0.08 },
  { id: "ocbc_cash",  assetType: "Cash",   custodyCountry: "Singapore",   institution: "OCBC",                weight: 0.07 },
  { id: "scsg_cash",  assetType: "Cash",   custodyCountry: "Singapore",   institution: "SC_SG",               weight: 0.05 },

  // ── Hong Kong top-tier banks & broker ──
  { id: "hsbc_cash",  assetType: "Cash",   custodyCountry: "HongKong",    institution: "HSBC_HK",             weight: 0.08 },
  { id: "scbhk_cash", assetType: "Cash",   custodyCountry: "HongKong",    institution: "StandardCharteredHK", weight: 0.05 },
  { id: "bochk_cash", assetType: "Cash",   custodyCountry: "HongKong",    institution: "BOCHK",               weight: 0.05 },
  { id: "futu_eq",    assetType: "Equity", custodyCountry: "HongKong",    institution: "Futu",                weight: 0.07 },

  // ── Cold wallet — self-custodied on-chain ──
  { id: "cw_btc",     assetType: "Crypto", custodyCountry: "SelfCustody", institution: "CryptoWallet",        weight: 0.15 }, // BTC
  { id: "cw_xaut",    assetType: "Crypto", custodyCountry: "SelfCustody", institution: "CryptoWallet",        weight: 0.07 }, // XAUT (gold-backed)
  { id: "cw_usdt",    assetType: "Crypto", custodyCountry: "SelfCustody", institution: "CryptoWallet",        weight: 0.07 }, // USDT
  { id: "cw_usdc",    assetType: "Crypto", custodyCountry: "SelfCustody", institution: "CryptoWallet",        weight: 0.06 }, // USDC
];
