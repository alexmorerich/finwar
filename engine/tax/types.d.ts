// FINWAR — TAX Engine v2.0 · type surface (the typed contract for the engine).
//
// Mirrors the runnable zero-dep ESM (engine/tax/*.js). Like the coordinate engine's
// types.d.ts it sits OUTSIDE the `src/` typed surface (tsconfig scopes typecheck to
// src/ + test/), so it documents the shapes without entering the Worker build.
//
// THE SHIFT: TAX is no longer a single "CRS score". It is a 7-category / 17-node
// visibility + liability + inheritance + exit + structure risk engine.

export type TaxLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH";

interface CategoryBase {
  /** 0–100 */
  score: number;
  level: TaxLevel;
  reasons: string[];
}

export interface InformationExchangeRisk extends CategoryBase {
  CRS: boolean;
  FATCA: boolean;
  EOIR: boolean;
  AMLVisibility: boolean;
}
export interface IncomeTaxRisk extends CategoryBase {
  dividendWithholding: number;
  interestTax: number;
  capitalGainsTax: number;
  rentalIncomeTax: number;
}
export interface ExitTaxRisk extends CategoryBase {
  realEstateExitTax: number;
  equityTransferTax: number;
}
export interface EstateGiftTaxRisk extends CategoryBase {
  usEstateTax: number;
  usGiftTax: number;
  ukInheritanceTax: number;
  jpInheritanceTax: number;
  cnPotentialEstateTax: number;
}
export interface CFCRisk extends CategoryBase {
  cnCFC: boolean;
  usCFC: boolean;
  oecdCFC: boolean;
}
export interface AntiAvoidanceRisk extends CategoryBase {
  GAAR: boolean;
  BEPS2: boolean;
  ESR: boolean;
  beneficialOwnerTest: boolean;
}
export interface SpecialAssetTaxRisk extends CategoryBase {
  goldTax: number;
  cryptoTax: number;
  realEstateHoldingTax: number;
  fundStructureTax: number;
}

export interface TaxBreakdown {
  informationExchange: number;
  incomeTax: number;
  exitTax: number;
  estateGiftTax: number;
  cfcRisk: number;
  antiAvoidance: number;
  specialAssetTax: number;
}

export interface TaxExposure {
  informationExchange: InformationExchangeRisk;
  incomeTax: IncomeTaxRisk;
  exitTax: ExitTaxRisk;
  estateGiftTax: EstateGiftTaxRisk;
  cfcRisk: CFCRisk;
  antiAvoidance: AntiAvoidanceRisk;
  specialAssetTax: SpecialAssetTaxRisk;
  /** 0–100, weighted fuse of the seven category scores (spec §9). */
  taxScore: number;
  taxLevel: TaxLevel;
  breakdown: TaxBreakdown;
  _migrated?: boolean;
}

export interface TaxContext {
  isUSPerson?: boolean;
  holderResidency?: string;
  viaEntity?: boolean;
  lowTaxJurisdiction?: boolean;
  passiveIncomeRatio?: number;
  usSitusValueOverThreshold?: boolean;
  GAAR?: boolean;
  BEPS2?: boolean;
  ESR?: boolean;
  beneficialOwnerTest?: boolean;
}

export function computeTaxExposure(asset: unknown, context?: TaxContext): TaxExposure;
export function migrateLegacyTax(legacy: boolean | number | Record<string, unknown>): TaxExposure;
export function mapTaxExposure(assets: unknown[], context?: TaxContext): Array<{ id: string; label: string; taxScore: number; taxLevel: TaxLevel; breakdown: TaxBreakdown }>;
