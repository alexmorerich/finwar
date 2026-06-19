// FINWAR v3.3 — Financial kill-chain reference nodes.
//
// The conceptual shift (spec §8): do NOT ask "where is the asset traded?" — ask
// "who ultimately holds the kill switch?". The true objects of simulation are
// settlement networks (DTCC/DTC/CHIPS/SWIFT · CDP/CCASS/CNSDC/CIPS) and ultimate
// custodians (State Street, BNY Mellon, HSBC, SelfCustody, PhysicalPossession).
//
// Kill-chain attack order (spec §5):
//   SettlementNetwork → UltimateCustodian → BeneficialOwnership → Broker →
//   Exchange → Jurisdiction → (only then) CustodyCountry label
//
// Three sovereign axes: OFAC (US sanction reach) · capital-control (CN lock) ·
// tax-transparency (CRS). All scores 0–100, tunable. `Unknown` placeholders let
// spec §6 migrated assets score without throwing (no data loss, no crash).

// US-nexus tiers — how reachable an intermediary is by US sanctions.
//   direct(3)        — a US settlement rail or a US custodian (OFAC can freeze directly)
//   correspondent(2) — USD-clearing / SWIFT exposure (reachable via secondary pressure)
//   foreign(1)       — a non-US rail/custodian inside the regulated system (indirect only)
//   none(0)          — no compellable US-reachable intermediary (self / physical / on-chain)
export const US_NEXUS_RANK = { direct: 3, correspondent: 2, foreign: 1, unknown: 1, none: 0 };

// ─────────────────── A · Settlement systems (结算体系, spec §1) ───────────────────
// The category an asset settles under. `capitalControl` feeds the CN-lock axis;
// `defaultNetworks` is the typical rail set (the actual rails live on the asset).
export const SETTLEMENT_SYSTEMS = {
  US_Settlement:            { name: "US_Settlement",            capitalControl:  5, defaultNetworks: ["DTCC", "DTC", "CHIPS", "Fedwire", "SWIFT"] },
  Singapore_Settlement:     { name: "Singapore_Settlement",     capitalControl: 20, defaultNetworks: ["CDP", "MEPS+", "PayNow"] },
  HongKong_Settlement:      { name: "HongKong_Settlement",      capitalControl: 50, defaultNetworks: ["CCASS", "FPS"] },
  China_Settlement:         { name: "China_Settlement",         capitalControl: 95, defaultNetworks: ["CNSDC", "CIPS"] },
  Decentralized_Settlement: { name: "Decentralized_Settlement", capitalControl:  8, defaultNetworks: ["Bitcoin", "Ethereum", "TRON"] },
  Issuer_Crypto_Settlement: { name: "Issuer_Crypto_Settlement", capitalControl: 30, defaultNetworks: ["Ethereum", "TRON"] }, // centralized stablecoin issuer
  Physical_Gold_Settlement: { name: "Physical_Gold_Settlement", capitalControl: 10, defaultNetworks: ["Physical"] },
  Real_Estate_Settlement:   { name: "Real_Estate_Settlement",   capitalControl: 60, defaultNetworks: ["Physical"] },
  Unknown:                  { name: "Unknown",                  capitalControl:  0, defaultNetworks: ["Unknown"] },
};

// ─────────────────── SettlementNetwork enum (the actual rails, spec §2) ───────────────────
// usNexus drives ofacDependency (spec §3) — NOT the custody-country label.
export const SETTLEMENT_NETWORKS = {
  DTCC:    { name: "DTCC",    usNexus: "direct" },
  DTC:     { name: "DTC",     usNexus: "direct" },
  CHIPS:   { name: "CHIPS",   usNexus: "direct" },
  Fedwire: { name: "Fedwire", usNexus: "direct" },
  SWIFT:   { name: "SWIFT",   usNexus: "correspondent" }, // global messaging — pressurable, not US-domiciled
  CDP:     { name: "CDP",     usNexus: "foreign" },
  "MEPS+": { name: "MEPS+",   usNexus: "foreign" },
  PayNow:  { name: "PayNow",  usNexus: "foreign" },
  CCASS:   { name: "CCASS",   usNexus: "foreign" },
  FPS:     { name: "FPS",     usNexus: "foreign" },
  CNSDC:   { name: "CNSDC",   usNexus: "foreign" },
  CIPS:    { name: "CIPS",    usNexus: "foreign" }, // China's USD-avoidance rail — foreign to OFAC by design
  Bitcoin: { name: "Bitcoin", usNexus: "none" },
  Ethereum:{ name: "Ethereum",usNexus: "none" },
  TRON:    { name: "TRON",    usNexus: "none" },
  Physical:{ name: "Physical",usNexus: "none" },
  None:    { name: "None",    usNexus: "none" },
  Unknown: { name: "Unknown", usNexus: "unknown" },
};

// ─────────────────── B · Custody jurisdictions (托管地, spec §1) ───────────────────
// Feeds capital-control + tax-transparency axes. Deliberately does NOT feed
// ofacDependency (spec §3 "replaces naive CustodyCountry == US logic").
export const CUSTODY_JURISDICTIONS = {
  US:         { name: "US",         capitalControl:  5, taxTransparency: 80 },
  Singapore:  { name: "Singapore",  capitalControl: 20, taxTransparency: 75 },
  HongKong:   { name: "HongKong",   capitalControl: 55, taxTransparency: 65 },
  China:      { name: "China",      capitalControl: 95, taxTransparency: 35 },
  NoCustody:  { name: "NoCustody",  capitalControl:  5, taxTransparency:  8 }, // self-custody crypto (BTC/XMR)
  DMCC_Dubai: { name: "DMCC_Dubai", capitalControl: 15, taxTransparency: 45 }, // UAE gold / commodities zone
  Unknown:    { name: "Unknown",    capitalControl:  0, taxTransparency:  0 },
};

// ─────────────────── UltimateCustodian (the kill switch, spec §8) ───────────────────
// usNexus → ofacDependency; chinaExposure → capital-control; regulatedFI → CRS.
export const ULTIMATE_CUSTODIANS = {
  StateStreet:        { name: "StateStreet",        usNexus: "direct",        chinaExposure:  8, regulatedFI: true,  selfCustody: false },
  BNYMellon:          { name: "BNYMellon",          usNexus: "direct",        chinaExposure:  8, regulatedFI: true,  selfCustody: false },
  JPMorgan:           { name: "JPMorgan",           usNexus: "direct",        chinaExposure: 10, regulatedFI: true,  selfCustody: false },
  Citibank:           { name: "Citibank",           usNexus: "direct",        chinaExposure: 12, regulatedFI: true,  selfCustody: false },
  HSBC:               { name: "HSBC",               usNexus: "correspondent", chinaExposure: 55, regulatedFI: true,  selfCustody: false },
  StandardChartered:  { name: "StandardChartered",  usNexus: "correspondent", chinaExposure: 50, regulatedFI: true,  selfCustody: false },
  DBS:                { name: "DBS",                usNexus: "foreign",       chinaExposure: 25, regulatedFI: true,  selfCustody: false },
  OCBC:               { name: "OCBC",               usNexus: "foreign",       chinaExposure: 25, regulatedFI: true,  selfCustody: false },
  CDP:                { name: "CDP",                usNexus: "foreign",       chinaExposure: 10, regulatedFI: true,  selfCustody: false }, // SG Central Depository (direct register)
  CCASS:              { name: "CCASS",              usNexus: "foreign",       chinaExposure: 60, regulatedFI: true,  selfCustody: false }, // HK
  CNSDC:              { name: "CNSDC",              usNexus: "foreign",       chinaExposure: 95, regulatedFI: true,  selfCustody: false }, // China
  SelfCustody:        { name: "SelfCustody",        usNexus: "none",          chinaExposure:  6, regulatedFI: false, selfCustody: true  },
  PhysicalPossession: { name: "PhysicalPossession", usNexus: "none",          chinaExposure:  5, regulatedFI: false, selfCustody: true  },
  Unknown:            { name: "Unknown",            usNexus: "unknown",       chinaExposure:  0, regulatedFI: false, selfCustody: false },
};

// ─────────────────── C · Asset classes (资产类别, spec §1) ───────────────────
// controllability = how easily a sovereign freezes the value form; reportability
// feeds the CRS axis. Settlement/custody dominate; asset class is tertiary (§5).
export const ASSET_CLASSES = {
  Equity:       { name: "Equity",       controllability: 70, reportability: 70 },
  ETF:          { name: "ETF",          controllability: 75, reportability: 72 },
  Cash:         { name: "Cash",         controllability: 90, reportability: 60 },
  PhysicalGold: { name: "PhysicalGold", controllability: 15, reportability: 30 },
  RealEstate:   { name: "RealEstate",   controllability: 95, reportability: 50 },
  Crypto:       { name: "Crypto",       controllability: 20, reportability: 10 },
  Unknown:      { name: "Unknown",      controllability: 50, reportability: 50 }, // conservative midpoint
};

// ─────────────────── BeneficialOwnershipModel (visibility & compellability, spec §2) ───────────────────
// visibility → tax-transparency; controllability → freeze reachability.
export const BENEFICIAL_OWNERSHIP = {
  direct_register: { name: "direct_register", visibility: 70, controllability: 50 }, // named on register (e.g. SG CDP)
  custodian:       { name: "custodian",       visibility: 85, controllability: 80 },
  nominee:         { name: "nominee",         visibility: 90, controllability: 90 }, // street name (DTC model)
  self_custody:    { name: "self_custody",    visibility:  5, controllability:  5 },
  bearer:          { name: "bearer",          visibility:  8, controllability: 10 },
  unknown:         { name: "unknown",         visibility: 50, controllability: 50 },
};

// ─────────────────── Tolerant getters (Unknown → zero/midpoint node, never throw) ───────────────────
export const getSettlementSystem  = (n) => SETTLEMENT_SYSTEMS[n]    || SETTLEMENT_SYSTEMS.Unknown;
export const getNetwork           = (n) => SETTLEMENT_NETWORKS[n]   || SETTLEMENT_NETWORKS.Unknown;
export const getJurisdiction      = (n) => CUSTODY_JURISDICTIONS[n] || CUSTODY_JURISDICTIONS.Unknown;
export const getCustodian         = (n) => ULTIMATE_CUSTODIANS[n]   || ULTIMATE_CUSTODIANS.Unknown;
export const getAssetClass        = (n) => ASSET_CLASSES[n]         || ASSET_CLASSES.Unknown;
export const getOwnership         = (n) => BENEFICIAL_OWNERSHIP[n]  || BENEFICIAL_OWNERSHIP.unknown;
