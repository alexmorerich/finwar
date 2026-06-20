// FINWAR v4.0 — sample AssetNodes (the four-field coordinate schema).
//
// Each entry is a pure AssetNode: id + the FOUR layer coordinates (no weights, no
// allocation %, no buy/sell — those are forbidden by the v4.0 hard rules). `label`
// / `note` are display-only. The set spans the OFAC–SAFE–TAX corners and exercises
// every Asset Class enum.
//
// The pedagogical point survives the four-field collapse: encode the TRUE
// settlement system, not the listing label. O87 lists on SGX but clears DTC/CHIPS,
// so its settlement_system is `US_Settlement` → it lands high on the OFAC axis,
// while D05 (same exchange, genuine `Singapore_Settlement`) stays far lower.
export const SAMPLE_ASSETS = [
  {
    id: "SGOV",
    label: "iShares 0-3M Treasury ETF (SGOV)",
    note: "US-domiciled T-bill ETF held via a HK broker — settles on US rails.",
    settlement_system: "US_Settlement",
    custody_jurisdiction: "US",
    ownership_model: "nominee",
    asset_class: "ETF",
  },
  {
    id: "O87",
    label: "SPDR Gold Shares (SGX O87)",
    note: "SGX listing, but US-cleared (DTC/CHIPS) — the label lies, the rail does not.",
    settlement_system: "US_Settlement",
    custody_jurisdiction: "Singapore",
    ownership_model: "nominee",
    asset_class: "ETF",
  },
  {
    id: "D05",
    label: "DBS Group Holdings (SGX D05)",
    note: "Pure-Singapore kill chain (CDP/MEPS+/PayNow) — same exchange as O87, far lower OFAC.",
    settlement_system: "Singapore_Settlement",
    custody_jurisdiction: "Singapore",
    ownership_model: "direct_register",
    asset_class: "Equity",
  },
  {
    id: "UST10Y",
    label: "US Treasury 10Y note (direct)",
    note: "Sovereign debt on Fedwire, custodied US — the deep OFAC corner.",
    settlement_system: "US_Settlement",
    custody_jurisdiction: "US",
    ownership_model: "custodian",
    asset_class: "FixedIncome",
  },
  {
    id: "2800",
    label: "Tracker Fund of Hong Kong (HKEX 2800)",
    note: "HK rails, HSBC custodian (USD-correspondent) — straddles OFAC and SAFE.",
    settlement_system: "HongKong_Settlement",
    custody_jurisdiction: "HongKong",
    ownership_model: "custodian",
    asset_class: "ETF",
  },
  {
    id: "USDC_SG",
    label: "USDC at a Singapore exchange",
    note: "Centralized stablecoin — the issuer can freeze an OFAC-listed address.",
    settlement_system: "Issuer_Crypto_Settlement",
    custody_jurisdiction: "Singapore",
    ownership_model: "custodian",
    asset_class: "Stablecoin",
  },
  {
    id: "PE_FUND_SG",
    label: "Singapore private-equity fund interest",
    note: "Illiquid nominee-held private asset in the regulated offshore book.",
    settlement_system: "Singapore_Settlement",
    custody_jurisdiction: "Singapore",
    ownership_model: "nominee",
    asset_class: "PrivateAsset",
  },
  {
    id: "RMB_ICBC",
    label: "RMB demand deposit at ICBC (mainland)",
    note: "Onshore cash — the deepest SAFE capital-control trap.",
    settlement_system: "China_Settlement",
    custody_jurisdiction: "ChinaMainland",
    ownership_model: "custodian",
    asset_class: "Cash",
  },
  {
    id: "SZ_PROPERTY",
    label: "Shenzhen residential real estate",
    note: "Title registered onshore — immovable, SAFE-trapped, moderately visible.",
    settlement_system: "Real_Estate_Settlement",
    custody_jurisdiction: "ChinaMainland",
    ownership_model: "direct_register",
    asset_class: "RealEstate",
  },
  {
    id: "GOLD_DMCC",
    label: "Physical gold bar (DMCC Dubai vault)",
    note: "Bearer metal, physical settlement — near the safe origin on every axis.",
    settlement_system: "Physical_Gold_Settlement",
    custody_jurisdiction: "DMCC",
    ownership_model: "bearer",
    asset_class: "PhysicalGold",
  },
  {
    id: "BTC_COLD",
    label: "BTC — cold wallet (self-custody)",
    note: "Decentralized rail, no compellable holder — the origin corner of the space.",
    settlement_system: "Decentralized_Settlement",
    custody_jurisdiction: "None",
    ownership_model: "self_custody",
    asset_class: "Crypto",
  },
];
