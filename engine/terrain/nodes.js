// FINWAR 3D — Sovereign Risk Terrain · reference nodes.
//
// Three risk axes:
//   X · FSS  = US financial-sanction risk (OFAC)
//   Y · CCR  = China capital-control risk (SAFE)
//   Z · TAX  = CRS / global tax-transparency risk
//
// All scores are 0–100 (higher = more dangerous) and are tunable.

// ─────────────────────────── Countries (custody jurisdictions) ───────────────────────────
// Spec keeps four jurisdictions. `SelfCustody` is an explicit 5th zone added for
// cold-wallet / on-chain holdings: self-custodied keys belong to no custody
// jurisdiction, so forcing them into one of the four would overstate their risk.
export const COUNTRIES = {
  US:            { name: "US",            sanctionRisk: 90, capitalControlRisk: 10, taxTransparencyRisk: 80 },
  Singapore:     { name: "Singapore",     sanctionRisk: 40, capitalControlRisk: 20, taxTransparencyRisk: 70 },
  HongKong:      { name: "HongKong",      sanctionRisk: 50, capitalControlRisk: 40, taxTransparencyRisk: 60 },
  ChinaMainland: { name: "ChinaMainland", sanctionRisk: 20, capitalControlRisk: 95, taxTransparencyRisk: 30 },
  // — extension — cold wallet / on-chain (flagged: beyond the spec's 4 jurisdictions)
  SelfCustody:   { name: "SelfCustody",   sanctionRisk: 25, capitalControlRisk:  5, taxTransparencyRisk: 10 },
};

// ─────────────────────────── Institutions ───────────────────────────
// usExposure   — dependency on the US system (correspondent / clearing / domicile)
// chinaExposure— dependency on the China system
// crsExposure  — CRS / tax-reporting transparency
// counterpartyRisk — institutional / settlement counterparty risk
// `country` ties each institution to its custody jurisdiction (consistency-checked).
export const INSTITUTIONS = {
  IBKR:                { name: "IBKR",                country: "US",            usExposure: 95, chinaExposure: 10, crsExposure: 75, counterpartyRisk: 20 },
  US_Bank:             { name: "US_Bank",             country: "US",            usExposure: 95, chinaExposure:  5, crsExposure: 80, counterpartyRisk: 25 },
  DBS:                 { name: "DBS",                 country: "Singapore",     usExposure: 35, chinaExposure: 25, crsExposure: 90, counterpartyRisk: 12 },
  OCBC:                { name: "OCBC",                country: "Singapore",     usExposure: 35, chinaExposure: 25, crsExposure: 90, counterpartyRisk: 14 },
  SC_SG:               { name: "SC_SG",               country: "Singapore",     usExposure: 45, chinaExposure: 35, crsExposure: 90, counterpartyRisk: 18 },
  HSBC_HK:             { name: "HSBC_HK",             country: "HongKong",      usExposure: 55, chinaExposure: 55, crsExposure: 88, counterpartyRisk: 18 },
  StandardCharteredHK: { name: "StandardCharteredHK", country: "HongKong",      usExposure: 50, chinaExposure: 50, crsExposure: 88, counterpartyRisk: 20 },
  Futu:                { name: "Futu",                country: "HongKong",      usExposure: 55, chinaExposure: 70, crsExposure: 82, counterpartyRisk: 35 },
  BOCHK:               { name: "BOCHK",               country: "HongKong",      usExposure: 40, chinaExposure: 88, crsExposure: 80, counterpartyRisk: 22 },
  CN_Bank:             { name: "CN_Bank",             country: "ChinaMainland", usExposure: 12, chinaExposure: 98, crsExposure: 45, counterpartyRisk: 20 },
  CN_Broker:           { name: "CN_Broker",           country: "ChinaMainland", usExposure: 12, chinaExposure: 96, crsExposure: 45, counterpartyRisk: 26 },
  CryptoWallet:        { name: "CryptoWallet",        country: "SelfCustody",   usExposure: 22, chinaExposure:  6, crsExposure:  6, counterpartyRisk: 30 },
};

// ─────────────────────────── Asset types ───────────────────────────
// Only `dtccRisk` (US-clearing dependency) feeds the X axis directly; the Y/Z
// axes use assetType conditionals (Cash→capital-control weight, Equity→tax weight).
// issuerRisk / liquidity / volatility are carried for completeness & hover detail.
export const ASSET_TYPES = {
  RealEstate: { assetType: "RealEstate", issuerRisk: 30, dtccRisk:  0, liquidity:  8, volatility: 25 },
  Equity:     { assetType: "Equity",     issuerRisk: 45, dtccRisk: 90, liquidity: 85, volatility: 50 },
  Gold:       { assetType: "Gold",       issuerRisk: 25, dtccRisk: 35, liquidity: 70, volatility: 35 }, // paper/ETF gold; physical ≈ 5
  Crypto:     { assetType: "Crypto",     issuerRisk: 55, dtccRisk: 12, liquidity: 80, volatility: 80 },
  Cash:       { assetType: "Cash",       issuerRisk: 18, dtccRisk: 45, liquidity: 96, volatility:  5 },
};

export function getCountry(name) {
  const c = COUNTRIES[name];
  if (!c) throw new Error(`Unknown custodyCountry: ${name}`);
  return c;
}
export function getInstitution(name) {
  const i = INSTITUTIONS[name];
  if (!i) throw new Error(`Unknown institution: ${name}`);
  return i;
}
export function getAsset(assetType) {
  const a = ASSET_TYPES[assetType];
  if (!a) throw new Error(`Unknown assetType: ${assetType}`);
  return a;
}
