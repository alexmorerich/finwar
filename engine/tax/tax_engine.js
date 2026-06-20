// FINWAR — TAX Engine v2.0 (the cross-jurisdiction tax exposure core). Zero-dep.
//
// Pure & deterministic: no clock, no randomness, no I/O. Transforms the TAX axis
// from a single "CRS score" into a 7-category / 17-node engine. Each category
// returns { ...fields, score 0–100, level NONE|LOW|MEDIUM|HIGH, reasons[] }; the
// engine fuses them (spec §9 weights) into { taxScore, taxLevel, breakdown }.
//
//   computeTaxExposure(asset, context?) → TaxExposure
//   migrateLegacyTax(legacyCrs)         → TaxExposure   (spec §10 — no breaking changes)
//
// SCOPE GUARD: reads an asset's tax-relevant facts ONLY. It never mutates and never
// imports the Settlement / Custody / Kill-Chain / Sanction engines.

import {
  levelOf, clamp100, round1, normJur,
  CRS_PARTICIPATING, EOIR_TREATY,
  DIVIDEND_WHT, INTEREST_TAX, CAPGAINS_TAX, RENTAL_TAX, INCOME_WEIGHTS,
  REAL_ESTATE_EXIT, EQUITY_TRANSFER,
  ESTATE, CFC, LOW_TAX_JURISDICTIONS, ANTI_AVOIDANCE,
  SPECIAL, SPECIAL_WEIGHTS, AGG_WEIGHTS,
} from "./tax_nodes.js";

// The jurisdiction whose tax system sources an asset's income / situs.
const SETTLEMENT_SOURCE = {
  US_Settlement: "US",
  Singapore_Settlement: "SG",
  HongKong_Settlement: "HK",
  China_Settlement: "CN",
  Real_Estate_Settlement: null,    // → custody jurisdiction (where the property sits)
  Physical_Gold_Settlement: null,  // → custody jurisdiction (where the metal sits)
  Decentralized_Settlement: "NONE",
  Issuer_Crypto_Settlement: "NONE",
};
function settlementSourceJur(settlement, custodyJur) {
  const s = SETTLEMENT_SOURCE[settlement];
  return s == null ? custodyJur : s;
}

// Holder facts the catalog can't carry per-asset. Conservative, override per call.
export const DEFAULT_CONTEXT = {
  isUSPerson: false,
  holderResidency: "CN",            // the stated book is CN/HK-centric; override as needed
  viaEntity: false,                 // held through an interposed legal entity (CFC only applies then)
  lowTaxJurisdiction: undefined,    // override; else derived from the entity jurisdiction
  passiveIncomeRatio: 0,            // 0..1
  usSitusValueOverThreshold: undefined, // override the >$60k US-situs assumption
  // anti-avoidance triggers (default false — a direct, substance-backed holding)
  GAAR: false, BEPS2: false, ESR: false, beneficialOwnerTest: false,
};

// Tolerant reader — accepts a catalog Holding, a coordinate AssetNode, or a terrain Asset.
export function readAsset(asset = {}) {
  const assetClass = asset.asset_class ?? asset.assetClass ?? "Unknown";
  const accountJur = normJur(asset.account_jurisdiction ?? asset.accountJurisdiction ?? asset.custody_jurisdiction ?? asset.custodyJurisdiction ?? "None");
  const custodyJur = normJur(asset.custody_jurisdiction ?? asset.custodyJurisdiction ?? asset.account_jurisdiction ?? "None");
  const settlement = asset.settlement_system ?? asset.settlementSystem ?? "Unknown";
  const ownership = asset.ownership_model ?? asset.beneficial_ownership_model ?? asset.beneficialOwnershipModel ?? asset.ownershipModel ?? "unknown";
  const currency = asset.currency ?? null;
  const isSecurity = ["Equity", "ETF", "FixedIncome"].includes(assetClass);
  const usSitus = asset.usSitus ?? (settlement === "US_Settlement" && isSecurity); // US-domiciled SECURITY (bank deposits are situs-exempt)
  const atFinancialInstitution = !["self_custody", "bearer", "physical_possession"].includes(ownership);
  return { assetClass, accountJur, custodyJur, settlement, ownership, currency, isSecurity, usSitus, atFinancialInstitution, sourceJur: settlementSourceJur(settlement, custodyJur) };
}

const pick = (table, key) => table[key] ?? table.OTHER ?? 0;

// ─────────────────── §2 · Information Exchange Risk ───────────────────
export function computeInformationExchange(a, ctx) {
  const CRS = a.atFinancialInstitution && (CRS_PARTICIPATING[a.accountJur] ?? CRS_PARTICIPATING.OTHER);
  const FATCA = !!ctx.isUSPerson || a.usSitus;
  const EOIR = a.atFinancialInstitution && (EOIR_TREATY[a.accountJur] ?? EOIR_TREATY.OTHER);
  const AMLVisibility = a.atFinancialInstitution;
  let score = 0;
  const reasons = [];
  if (CRS) { score += 40; reasons.push(`CRS-participating account jurisdiction (${a.accountJur}) → reportable (+40)`); }
  if (FATCA) { score += 40; reasons.push(a.usSitus ? "US-situs asset → FATCA reportable (+40)" : "US person → FATCA reportable (+40)"); }
  if (EOIR) { score += 10; reasons.push("EOIR treaty active → exchange-on-request (+10)"); }
  if (AMLVisibility) { score += 10; reasons.push("AML/KYC visibility at a regulated FI (+10)"); }
  if (!reasons.length) reasons.push("no reporting nexus (self-custody / bearer — no FI, not US-situs)");
  score = clamp100(score);
  return { CRS, FATCA, EOIR, AMLVisibility, score, level: levelOf(score), reasons };
}

// ─────────────────── §3 · Income Tax Risk ───────────────────
export function computeIncomeTax(a) {
  const isEquity = a.assetClass === "Equity" || a.assetClass === "ETF";
  const isInterestBearing = a.assetClass === "Cash" || a.assetClass === "FixedIncome";
  const dividendWithholding = isEquity ? pick(DIVIDEND_WHT, a.sourceJur) : 0;
  const interestTax = isInterestBearing ? pick(INTEREST_TAX, a.usSitus ? "US" : a.accountJur) : 0;
  const capitalGainsTax = a.isSecurity ? pick(CAPGAINS_TAX, a.sourceJur) : 0;
  const rentalIncomeTax = a.assetClass === "RealEstate" ? pick(RENTAL_TAX, a.custodyJur) : 0;
  const score = clamp100(round1(
    dividendWithholding * INCOME_WEIGHTS.dividendWithholding +
    capitalGainsTax * INCOME_WEIGHTS.capitalGainsTax +
    interestTax * INCOME_WEIGHTS.interestTax +
    rentalIncomeTax * INCOME_WEIGHTS.rentalIncomeTax,
  ));
  const reasons = [];
  if (dividendWithholding) reasons.push(`dividend withholding ${dividendWithholding}% (${a.sourceJur})`);
  if (capitalGainsTax) reasons.push(`capital gains ${capitalGainsTax}% (${a.sourceJur})`);
  if (interestTax) reasons.push(`interest tax ${interestTax}%`);
  if (rentalIncomeTax) reasons.push(`rental income ${rentalIncomeTax}% (${a.custodyJur})`);
  if (!reasons.length) reasons.push("no recurring income tax (non-income-bearing or 0% source)");
  return { dividendWithholding, interestTax, capitalGainsTax, rentalIncomeTax, score, level: levelOf(score), reasons };
}

// ─────────────────── §4 · Exit / Disposal Tax Risk (score = max) ───────────────────
export function computeExitTax(a) {
  const realEstateExitTax = a.assetClass === "RealEstate" ? pick(REAL_ESTATE_EXIT, a.custodyJur) : 0;
  const equityTransferTax = (a.assetClass === "Equity" || a.assetClass === "ETF") ? pick(EQUITY_TRANSFER, a.sourceJur) : 0;
  const score = Math.max(realEstateExitTax, equityTransferTax);
  const reasons = [];
  if (realEstateExitTax) reasons.push(`real-estate disposal tax (${a.custodyJur}: ${realEstateExitTax >= 90 ? "ABSD/SSD/FIRPTA HIGH" : "transfer duty"})`);
  if (equityTransferTax) reasons.push(`equity transfer / stamp duty (${a.sourceJur})`);
  if (!reasons.length) reasons.push("no exit / disposal tax");
  return { realEstateExitTax, equityTransferTax, score, level: levelOf(score), reasons };
}

// ─────────────────── §5 · Estate & Gift Tax Risk (score = max) ───────────────────
export function computeEstateGiftTax(a, ctx) {
  const overThreshold = ctx.usSitusValueOverThreshold ?? true; // catalog carries no $ value → assume US-situs > $60k (conservative)
  const usEstateTax = a.usSitus && overThreshold ? ESTATE.usEstate : 0;
  const usGiftTax = a.usSitus ? ESTATE.usGift : 0;
  const ukInheritanceTax = (a.sourceJur === "UK" || a.custodyJur === "UK") ? ESTATE.ukInheritance : 0;
  const jpInheritanceTax = (a.sourceJur === "JP" || a.custodyJur === "JP" || ctx.holderResidency === "JP") ? ESTATE.jpInheritance : 0;
  const cnPotentialEstateTax = (a.custodyJur === "CN" || a.sourceJur === "CN") ? ESTATE.cnPotential : 0;
  const score = Math.max(usEstateTax, usGiftTax, ukInheritanceTax, jpInheritanceTax, cnPotentialEstateTax);
  const reasons = [];
  if (usEstateTax) reasons.push("US-situs asset > $60k → US estate tax (HIGH)");
  if (usGiftTax) reasons.push("US-situs gift → US gift tax (MEDIUM)");
  if (ukInheritanceTax) reasons.push("UK inheritance tax (HIGH)");
  if (jpInheritanceTax) reasons.push("JP inheritance tax (HIGH)");
  if (cnPotentialEstateTax) reasons.push("CN potential estate tax — policy risk (LOW)");
  if (!reasons.length) reasons.push("no estate/gift situs exposure");
  return { usEstateTax, usGiftTax, ukInheritanceTax, jpInheritanceTax, cnPotentialEstateTax, score, level: levelOf(score), reasons };
}

// ─────────────────── §6 · CFC Risk ───────────────────
export function computeCFC(a, ctx) {
  if (!ctx.viaEntity) {
    return { cnCFC: false, usCFC: false, oecdCFC: false, score: 0, level: "NONE", reasons: ["held directly — no controlled foreign entity (CFC N/A)"] };
  }
  let score = 0;
  const reasons = [];
  if (["nominee", "custodian"].includes(a.ownership)) { score += CFC.ownershipFlag; reasons.push("interposed nominee/custodian entity (+20)"); }
  const lowTax = ctx.lowTaxJurisdiction ?? LOW_TAX_JURISDICTIONS.has(a.custodyJur);
  if (lowTax) { score += CFC.lowTaxJurisdiction; reasons.push(`entity in a low-tax jurisdiction (${a.custodyJur}) (+20)`); }
  if ((ctx.passiveIncomeRatio ?? 0) > CFC.passiveThreshold) { score += CFC.passiveIncome; reasons.push("passive income > 50% (+40)"); }
  score = clamp100(score);
  const cnCFC = score > 0 && ctx.holderResidency === "CN";
  const usCFC = score > 0 && (!!ctx.isUSPerson || ctx.holderResidency === "US");
  const oecdCFC = score > 0; // the OECD CFC norm is broad
  if (!reasons.length) reasons.push("entity holding, but no CFC trigger met");
  return { cnCFC, usCFC, oecdCFC, score, level: levelOf(score), reasons };
}

// ─────────────────── §7 · Anti-Avoidance Risk (score = max) ───────────────────
export function computeAntiAvoidance(ctx) {
  const GAAR = !!ctx.GAAR, BEPS2 = !!ctx.BEPS2, ESR = !!ctx.ESR, beneficialOwnerTest = !!ctx.beneficialOwnerTest;
  let score = 0;
  const reasons = [];
  if (GAAR) { score = Math.max(score, ANTI_AVOIDANCE.GAAR); reasons.push("GAAR triggered (HIGH)"); }
  if (ESR) { score = Math.max(score, ANTI_AVOIDANCE.ESR); reasons.push("economic-substance (ESR) fail (HIGH)"); }
  if (beneficialOwnerTest) { score = Math.max(score, ANTI_AVOIDANCE.beneficialOwnerTest); reasons.push("beneficial-owner test fail (HIGH)"); }
  if (BEPS2) { score = Math.max(score, ANTI_AVOIDANCE.BEPS2); reasons.push("BEPS 2.0 global minimum tax (MEDIUM)"); }
  if (!reasons.length) reasons.push("no anti-avoidance trigger");
  return { GAAR, BEPS2, ESR, beneficialOwnerTest, score, level: levelOf(score), reasons };
}

// ─────────────────── §8 · Special Asset Tax Risk (active-weighted blend) ───────────────────
export function computeSpecialAssetTax(a) {
  let goldTax = 0, cryptoTax = 0, realEstateHoldingTax = 0, fundStructureTax = 0;
  const reasons = [];
  if (a.assetClass === "PhysicalGold") {
    goldTax = a.custodyJur === "CN" ? SPECIAL.goldLocked : a.custodyJur === "AE" ? SPECIAL.goldFreeZone : SPECIAL.goldBase;
    reasons.push(a.custodyJur === "CN" ? "physical gold export-locked (CN border control) — HIGH" : "physical gold import/export friction (no capital gains)");
  }
  if (a.assetClass === "Crypto" || a.assetClass === "Stablecoin") {
    cryptoTax = a.settlement === "Issuer_Crypto_Settlement" ? SPECIAL.cryptoIssuer : SPECIAL.cryptoSelfCustody;
    reasons.push("crypto: capital gains + pending CRS (crypto-asset reporting) inclusion");
  }
  if (a.assetClass === "RealEstate") {
    realEstateHoldingTax = pick(SPECIAL.realEstateHolding, a.custodyJur);
    reasons.push(`real-estate holding / property tax (${a.custodyJur})`);
  }
  if (a.assetClass === "ETF" || a.assetClass === "PrivateAsset") {
    fundStructureTax = a.usSitus ? SPECIAL.fundUSeTF : SPECIAL.fundOther;
    reasons.push(a.usSitus ? "US ETF — favorable fund structure" : "non-US fund (UCITS-style) — treaty-dependent");
  }
  const fields = { goldTax, cryptoTax, realEstateHoldingTax, fundStructureTax };
  let num = 0, den = 0;
  for (const k of Object.keys(fields)) if (fields[k] > 0) { num += SPECIAL_WEIGHTS[k] * fields[k]; den += SPECIAL_WEIGHTS[k]; }
  const score = den > 0 ? clamp100(round1(num / den)) : 0;
  if (!reasons.length) reasons.push("no special-asset tax treatment");
  return { goldTax, cryptoTax, realEstateHoldingTax, fundStructureTax, score, level: levelOf(score), reasons };
}

// ─────────────────── §9 · computeTaxExposure — the full 7-category fold ───────────────────
export function computeTaxExposure(asset, context) {
  const a = readAsset(asset);
  const ctx = { ...DEFAULT_CONTEXT, ...(context || {}) };

  const informationExchange = computeInformationExchange(a, ctx);
  const incomeTax = computeIncomeTax(a);
  const exitTax = computeExitTax(a);
  const estateGiftTax = computeEstateGiftTax(a, ctx);
  const cfcRisk = computeCFC(a, ctx);
  const antiAvoidance = computeAntiAvoidance(ctx);
  const specialAssetTax = computeSpecialAssetTax(a);

  const breakdown = {
    informationExchange: informationExchange.score,
    incomeTax: incomeTax.score,
    exitTax: exitTax.score,
    estateGiftTax: estateGiftTax.score,
    cfcRisk: cfcRisk.score,
    antiAvoidance: antiAvoidance.score,
    specialAssetTax: specialAssetTax.score,
  };
  let taxScore = 0;
  for (const k of Object.keys(AGG_WEIGHTS)) taxScore += AGG_WEIGHTS[k] * breakdown[k];
  taxScore = clamp100(round1(taxScore));

  return {
    informationExchange, incomeTax, exitTax, estateGiftTax, cfcRisk, antiAvoidance, specialAssetTax,
    taxScore, taxLevel: levelOf(taxScore), breakdown,
  };
}

// ─────────────────── §10 · Migration (legacy single CRS → full TaxExposure, no breaking changes) ───────────────────
// Accepts a boolean (old crs flag), a number (old single CRS/tax score), or an
// object ({crs?, crsExposure?, taxExposure?, taxTransparency?}). Only CRS is
// inferred; every other field defaults to score 0 / boolean false / numeric 0.
export function migrateLegacyTax(legacy) {
  let crs = false;
  if (typeof legacy === "boolean") crs = legacy;
  else if (typeof legacy === "number") crs = legacy > 0;
  else if (legacy && typeof legacy === "object")
    crs = !!(legacy.crs || legacy.crsExposure > 0 || legacy.taxExposure > 0 || legacy.taxTransparency > 0);

  const zeroCat = (fields, key) => ({ ...fields, score: 0, level: "NONE", reasons: [`migrated: no legacy ${key} data → defaulted to 0`] });
  const informationExchange = {
    CRS: crs, FATCA: false, EOIR: false, AMLVisibility: false,
    score: crs ? 40 : 0, level: crs ? levelOf(40) : "NONE",
    reasons: [crs ? "legacy CRS flag → informationExchange.CRS (+40)" : "no legacy CRS data → 0"],
  };
  const incomeTax = zeroCat({ dividendWithholding: 0, interestTax: 0, capitalGainsTax: 0, rentalIncomeTax: 0 }, "incomeTax");
  const exitTax = zeroCat({ realEstateExitTax: 0, equityTransferTax: 0 }, "exitTax");
  const estateGiftTax = zeroCat({ usEstateTax: 0, usGiftTax: 0, ukInheritanceTax: 0, jpInheritanceTax: 0, cnPotentialEstateTax: 0 }, "estateGiftTax");
  const cfcRisk = zeroCat({ cnCFC: false, usCFC: false, oecdCFC: false }, "cfcRisk");
  const antiAvoidance = zeroCat({ GAAR: false, BEPS2: false, ESR: false, beneficialOwnerTest: false }, "antiAvoidance");
  const specialAssetTax = zeroCat({ goldTax: 0, cryptoTax: 0, realEstateHoldingTax: 0, fundStructureTax: 0 }, "specialAssetTax");

  const breakdown = { informationExchange: informationExchange.score, incomeTax: 0, exitTax: 0, estateGiftTax: 0, cfcRisk: 0, antiAvoidance: 0, specialAssetTax: 0 };
  const taxScore = clamp100(round1(AGG_WEIGHTS.informationExchange * informationExchange.score));
  return { informationExchange, incomeTax, exitTax, estateGiftTax, cfcRisk, antiAvoidance, specialAssetTax, taxScore, taxLevel: levelOf(taxScore), breakdown, _migrated: true };
}

// Batch helper — one compact tax summary per asset (label + score + level + breakdown).
export function mapTaxExposure(assets, context) {
  return assets.map((asset) => {
    const t = computeTaxExposure(asset, context);
    return { id: asset.id, label: asset.label || asset.instrument || asset.id, taxScore: t.taxScore, taxLevel: t.taxLevel, breakdown: t.breakdown };
  });
}

// ─────────────────── CLI — tax breakdown over the current-holdings catalog ───────────────────
function isMain() {
  try { return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href; }
  catch { return false; }
}
if (isMain()) {
  const { CURRENT_HOLDINGS } = await import("../current_holdings/assets.js");
  const D = "\x1b[2m", X = "\x1b[0m", B = "\x1b[1m";
  const colour = { NONE: "\x1b[2m", LOW: "\x1b[32m", MEDIUM: "\x1b[33m", HIGH: "\x1b[31m" };
  console.log(`\n${B}FINWAR — TAX Engine v2.0 · cross-jurisdiction tax exposure over the current holdings${X}\n`);
  console.log(`  ${D}id                       class        score level    info inc exit estate cfc anti spec${X}`);
  for (const h of CURRENT_HOLDINGS) {
    const t = computeTaxExposure(h);
    const b = t.breakdown;
    const lv = `${colour[t.taxLevel]}${t.taxLevel.padEnd(6)}${X}`;
    console.log(`  ${h.id.padEnd(24)} ${String(h.asset_class).padEnd(11)} ${String(t.taxScore).padStart(5)} ${lv}  ` +
      `${String(b.informationExchange).padStart(4)}${String(b.incomeTax).padStart(4)}${String(b.exitTax).padStart(5)}${String(b.estateGiftTax).padStart(7)}${String(b.cfcRisk).padStart(4)}${String(b.antiAvoidance).padStart(5)}${String(b.specialAssetTax).padStart(5)}`);
  }
  console.log("");
}
