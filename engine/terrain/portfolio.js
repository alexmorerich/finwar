// FINWAR v3.3 — calibration assets (spec §7), expressed in the full Asset schema.
//
// The lesson of this set: an asset's listing label lies. O87 / S27 trade on SGX
// and look Singaporean, but their ultimate custodian is State Street and they
// clear through DTC / CHIPS — so OFAC reaches them (ofacDependency HIGH). DBS D05
// trades on the same exchange yet stays LOW, because its kill chain (CDP / MEPS+ /
// PayNow, custodian CDP) never touches a US rail. "Not where it trades — who holds
// the kill switch." (spec §8)
//
// Spec §8 HARD shift: model settlement networks + ultimate custodians, never the
// custody-country label. No weights / allocation % (this is a facts layer).
export const PORTFOLIO = [
  // ── SGX-listed ETF, US-cleared via State Street → OFAC HIGH despite SG listing ──
  {
    id: "O87",
    label: "SPDR Gold Shares (SGX O87)",
    assetClass: "ETF",
    custodyJurisdiction: "Singapore",
    settlementSystem: "Singapore_Settlement",
    assetType: "ETF",
    jurisdiction: "Singapore",
    exchange: "SGX",
    broker: "StandardChartered_SG",
    ultimateCustodian: "StateStreet",
    settlementNetwork: ["CDP", "DTC", "CHIPS"],
    beneficialOwnershipModel: "nominee",
  },
  {
    id: "S27",
    label: "SPDR S&P 500 ETF (SGX S27)",
    assetClass: "ETF",
    custodyJurisdiction: "Singapore",
    settlementSystem: "Singapore_Settlement",
    assetType: "ETF",
    jurisdiction: "Singapore",
    exchange: "SGX",
    broker: "StandardChartered_SG",
    ultimateCustodian: "StateStreet",
    settlementNetwork: ["CDP", "DTC", "CHIPS"],
    beneficialOwnershipModel: "nominee",
  },

  // ── Pure-Singapore kill chain — local custodian (CDP direct register) → OFAC LOW ──
  {
    id: "D05",
    label: "DBS Group Holdings (SGX D05)",
    assetClass: "Equity",
    custodyJurisdiction: "Singapore",
    settlementSystem: "Singapore_Settlement",
    assetType: "Equity",
    jurisdiction: "Singapore",
    exchange: "SGX",
    broker: "DBS_Vickers",
    ultimateCustodian: "CDP",
    settlementNetwork: ["CDP", "MEPS+", "PayNow"],
    beneficialOwnershipModel: "direct_register",
  },

  // ── US-domiciled T-bill ETF, held via a HK broker → still OFAC HIGH (US rails) ──
  {
    id: "SGOV",
    label: "iShares 0-3M Treasury ETF (SGOV)",
    assetClass: "ETF",
    custodyJurisdiction: "US",
    settlementSystem: "US_Settlement",
    assetType: "ETF",
    jurisdiction: "US",
    exchange: "NYSE",
    broker: "WingLung_HK",
    ultimateCustodian: "StateStreet",
    settlementNetwork: ["DTCC", "DTC", "CHIPS"],
    beneficialOwnershipModel: "nominee",
  },

  // ── HK Tracker Fund — HK rails, HSBC custodian → OFAC MEDIUM (USD-correspondent) ──
  {
    id: "2800",
    label: "Tracker Fund of Hong Kong (HKEX 2800)",
    assetClass: "ETF",
    custodyJurisdiction: "HongKong",
    settlementSystem: "HongKong_Settlement",
    assetType: "ETF",
    jurisdiction: "HongKong",
    exchange: "HKEX",
    broker: "StandardChartered_HK",
    ultimateCustodian: "HSBC",
    settlementNetwork: ["CCASS", "FPS"],
    beneficialOwnershipModel: "custodian",
  },

  // ── BTC cold wallet — decentralized rail, self-custody → OFAC NONE ──
  {
    id: "BTC_ColdWallet",
    label: "BTC — cold wallet (self-custody)",
    assetClass: "Crypto",
    custodyJurisdiction: "NoCustody",
    settlementSystem: "Decentralized_Settlement",
    assetType: "Crypto",
    jurisdiction: "NoCustody",
    exchange: null,
    broker: null,
    ultimateCustodian: "SelfCustody",
    settlementNetwork: ["Bitcoin"],
    beneficialOwnershipModel: "self_custody",
  },

  // ── Physical gold bar in a DMCC vault — bearer, physical settlement → OFAC NONE ──
  {
    id: "Gold_DMCC",
    label: "Physical gold bar (DMCC Dubai vault)",
    assetClass: "PhysicalGold",
    custodyJurisdiction: "DMCC_Dubai",
    settlementSystem: "Physical_Gold_Settlement",
    assetType: "PhysicalGold",
    jurisdiction: "DMCC_Dubai",
    exchange: null,
    broker: null,
    ultimateCustodian: "PhysicalPossession",
    settlementNetwork: ["Physical"],
    beneficialOwnershipModel: "bearer",
  },
];
