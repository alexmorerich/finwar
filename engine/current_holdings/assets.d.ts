// FINWAR — Current-holdings facts catalog · typed contract.
//
// Mirrors the runnable zero-dep ESM (engine/current_holdings/assets.js). Like the
// coordinate engine's types.d.ts it sits OUTSIDE the `src/` typed surface, but it
// is named `assets.d.ts` so NodeNext auto-resolves it when a `test/**` TS file
// imports "../../engine/current_holdings/assets.js" (for the WorldState
// portfolio-independence cross-check).

import type { SettlementSystem, CustodyJurisdiction, OwnershipModel, AssetClass } from "../coordinate/types.js";

/** A WorldState RiskBucket (the eight in src/contracts/world_state.ts). */
export type WorldStateRiskBucket =
  | "US_EQUITY" | "HK_BROKERAGE" | "CN_ONSHORE" | "CRYPTO_COLD"
  | "GOLD_PHYSICAL" | "USD_CASH" | "OFFSHORE_USD" | "REAL_ESTATE";

/** FinWar's (richer) holdings taxonomy — a superset of WorldStateRiskBucket. */
export type CatalogRiskBucket =
  | WorldStateRiskBucket | "SG_EQUITY" | "ISSUER_STABLECOIN" | "ISSUER_GOLD_TOKEN";

export interface PathMeta {
  path_id: number;
  path_label: string;
  /** The user's stated path-level target, or null if none was given. */
  declared_path_pct: number | null;
}

export interface Holding {
  id: string;
  path_id: number;
  path_label: string;
  declared_path_pct: number | null;
  /** RAW stated percentage — never normalized (the 26 sum to 119, by design). */
  stated_pct: number;
  institution: string;
  account_jurisdiction: string;
  instrument: string;
  ticker: string | null;
  needs_ticker_verification: boolean;
  currency: string;
  // coordinate engine (v4.0) four-layer coordinates
  settlement_system: SettlementSystem;
  custody_jurisdiction: CustodyJurisdiction;
  ownership_model: OwnershipModel;
  asset_class: AssetClass;
  // kill-chain engine (v3.3) nodes
  settlement_network: string[];
  ultimate_custodian: string;
  beneficial_ownership_model: string;
  // FinWar holdings taxonomy (maps to a WorldState bucket via RISK_BUCKETS)
  risk_bucket: CatalogRiskBucket;
  notes: string | null;
}

export interface BucketDef {
  worldstate: WorldStateRiskBucket;
  gap: boolean;
  label: string;
  reason?: string;
}

export interface DeclaredVsStatedRow {
  path_id: number;
  path_label: string;
  declared_path_pct: number | null;
  stated_sum: number;
  delta: number | null;
  mismatch: boolean;
  match: boolean;
}

export interface ContractGap {
  catalog_bucket: string;
  worldstate_bucket: WorldStateRiskBucket;
  reason: string;
}

export const PATHS: PathMeta[];
export const CURRENT_HOLDINGS: Holding[];
export const WORLDSTATE_RISK_BUCKETS: WorldStateRiskBucket[];
export const RISK_BUCKETS: Record<CatalogRiskBucket, BucketDef>;
export const CONTRACT_GAPS: ContractGap[];
export const META: { path_count: number; holding_count: number; stated_pct_total: number };

export function statedPctTotal(): number;
export function holdingsByPath(pathId: number): Holding[];
export function declaredVsStatedReport(): DeclaredVsStatedRow[];
export function worldStateBucketOf(holding: Holding): { worldstate_bucket: WorldStateRiskBucket; gap: boolean; reason: string | null } | null;
export function toAssetNode(h: Holding): { id: string; label: string; note: string | null; settlement_system: SettlementSystem; custody_jurisdiction: CustodyJurisdiction; ownership_model: OwnershipModel; asset_class: AssetClass };
export function toTerrainAsset(h: Holding): Record<string, unknown>;
