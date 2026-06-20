// FINWAR v4.0 — Asset Coordinate Engine · type surface (spec "Core Schema").
//
// These declarations mirror, byte-for-intent, the v4.0 patch Core Schema. The
// runnable engine is zero-dependency ESM (engine/coordinate/*.js); this .d.ts is
// the typed contract for that engine. It is intentionally OUTSIDE the `src/`
// typed surface (tsconfig.json scopes `npm run typecheck` to src/ + test/), so it
// documents the shapes without entering the Worker build.

// ─────────────────── LAYER 1 · Settlement System / 结算体系 (highest priority) ───────────────────
export type SettlementSystem =
  | "US_Settlement"
  | "Singapore_Settlement"
  | "HongKong_Settlement"
  | "China_Settlement"
  | "Decentralized_Settlement"
  | "Issuer_Crypto_Settlement"
  | "Physical_Gold_Settlement"
  | "Real_Estate_Settlement";

// ─────────────────── LAYER 2 · Custody Jurisdiction / 托管司法区 ───────────────────
export type CustodyJurisdiction =
  | "US"
  | "Singapore"
  | "HongKong"
  | "ChinaMainland"
  | "DMCC"
  | "None";

// ─────────────────── LAYER 3 · Ownership Model / 所有权模式 (confiscation resistance) ───────────────────
export type OwnershipModel =
  | "custodian"
  | "nominee"
  | "self_custody"
  | "physical_possession"
  | "bearer"
  | "direct_register";

// ─────────────────── LAYER 4 · Asset Class / 资产类别 (lowest priority) ───────────────────
export type AssetClass =
  | "Equity"
  | "ETF"
  | "FixedIncome"
  | "Cash"
  | "PhysicalGold"
  | "RealEstate"
  | "Crypto"
  | "Stablecoin"
  | "PrivateAsset";

// ─────────────────── Core Schema — the four-coordinate asset ───────────────────
export interface AssetNode {
  id: string;
  settlement_system: SettlementSystem;
  custody_jurisdiction: CustodyJurisdiction;
  ownership_model: OwnershipModel;
  asset_class: AssetClass;
  /** display-only — never an input to the exposure engine */
  label?: string;
  /** display-only */
  note?: string;
}

// ─────────────────── Exposure Engine output (each normalized 0.0 … 1.0) ───────────────────
export interface Exposure {
  OFAC: number;
  SAFE: number;
  CRS: number;
}

// ─────────────────── Coordinate Output — one point in 3D space ───────────────────
export interface AssetVector {
  x: number; // OFAC
  y: number; // SAFE
  z: number; // CRS
}

// Full per-asset bundle returned by assetCoordinate() (engine extension).
export interface AssetCoordinate extends AssetNode {
  exposure: Exposure;
  vector: AssetVector;
  /** magnitude of `vector` ÷ √3 — a property of the asset, NOT a portfolio weight */
  exposure_weight: number;
}

export function calculateExposure(asset: AssetNode): Exposure;
export function toVector(asset: AssetNode): AssetVector;
export function exposureWeight(asset: AssetNode): number;
export function assetCoordinate(asset: AssetNode): AssetCoordinate;
export function mapAssets(assets: AssetNode[]): AssetCoordinate[];
