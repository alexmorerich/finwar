/**
 * FINWAR CONTRACT — `WorldState` (the truth layer).
 *
 * FinWar models geopolitical / monetary / regulatory shocks and emits a
 * portfolio-INDEPENDENT picture of the world: which events fired, how risky
 * each asset *bucket* is, and what constraints now bind. It answers
 * "what changed in the world?" — never "what should I hold?".
 *
 * INVARIANTS (enforced by this contract + review):
 *   • No portfolio weights, holdings, or balances appear anywhere in WorldState.
 *   • `asset_risk_matrix` is keyed by asset BUCKET (a class of asset), not by a
 *     user's specific lots — so one WorldState applies to ANY portfolio.
 *   • FinWar NEVER emits buy/sell/transfer actions. Those are FinOS-only.
 *
 * Determinism: `timestamp` is ALWAYS caller-supplied — never `new Date()`.
 */

/** FinWar reactive state machine (prompt §4). */
export type FinWarStatus = "IDLE" | "SIMULATING" | "UPDATED" | "STABLE";

export type GeoEventType =
  | "sanction"
  | "war"
  | "capital_control"
  | "tax_change"
  | "banking_restriction";

export interface GeopoliticalEvent {
  id: string;
  type: GeoEventType;
  /** Free-form region/jurisdiction label, e.g. "US", "HK", "CN", "EU". */
  region: string;
  /** Shock severity, 0–1. */
  severity: number;
  description: string;
}

/**
 * Asset risk buckets — a superset spanning BOTH repo universes: the 4-class
 * macro universe (us_equity/hk_dividend/gold/sgov) and the richer sanctions/geo
 * universe (custody-aware: physical gold, cold-wallet crypto, onshore RMB, real
 * estate…). Extend here in ONE place when a new bucket is needed.
 */
export type RiskBucket =
  | "US_EQUITY"
  | "HK_BROKERAGE"
  | "CN_ONSHORE"
  | "CRYPTO_COLD"
  | "GOLD_PHYSICAL"
  | "USD_CASH"
  | "OFFSHORE_USD"
  | "REAL_ESTATE";

/**
 * Per-bucket risk scores, each 0–1 (higher = more exposed, except where named
 * otherwise). All optional: a bucket only carries the dimensions meaningful for
 * it (cash → `freeze_risk`; cold crypto → `censorship_resistance`).
 */
export interface AssetRisk {
  /** P(assets in this bucket become frozen/seized). */
  freeze_risk?: number;
  /** Difficulty converting to usable cash under stress. */
  liquidity_risk?: number;
  /** Regulatory / brokerage-restriction exposure. */
  regulatory_risk?: number;
  /** Exposure to capital controls (cross-border transfer blocks). */
  capital_control_risk?: number;
  /** Resistance to censorship/seizure — higher = SAFER (named per contract). */
  censorship_resistance?: number;
}

export type WorldConstraintType =
  | "freeze"
  | "transfer_limit"
  | "reporting"
  | "tax";

export interface WorldConstraint {
  type: WorldConstraintType;
  /** What the constraint binds: a RiskBucket, a jurisdiction, a system… */
  scope: string;
  /** Constraint bite, 0–1. */
  intensity: number;
}

export interface WorldState {
  /** Caller-supplied ISO timestamp (determinism: never generated internally). */
  timestamp: string;
  /** Named scenario this state describes, e.g. "US-China financial escalation". */
  scenario: string;
  /** Scenario probability, 0–1. */
  probability: number;
  geopolitical_events: GeopoliticalEvent[];
  asset_risk_matrix: Partial<Record<RiskBucket, AssetRisk>>;
  constraints: WorldConstraint[];
}

/**
 * The external input a caller (UI/API) hands FinWar. Deliberately carries NO
 * portfolio data. The engine adapter maps this onto (MarketSnapshot, EngineConfig).
 */
export interface WorldInput {
  timestamp: string;
  scenario: string;
  /** Deterministic seed forwarded to the Monte-Carlo / scenario engine. */
  seed: number;
  /** Optional macro overrides; shape owned by the engine adapter. */
  macro_inputs?: Record<string, number>;
}
