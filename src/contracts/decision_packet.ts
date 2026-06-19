/**
 * FINOS CONTRACT — `DecisionPacket` (the decision layer).
 *
 * FinOS is the ONLY layer that produces actions. It consumes a FinWar
 * `WorldState` (what's true) and a FinArk `PortfolioState` (what I hold),
 * overlays the world's risk + constraints onto the actual holdings, and emits
 * recommendations plus a projected post-action `PortfolioState`.
 *
 * INVARIANTS:
 *   • FinOS owns NO source-of-truth data: it must not invent holdings (FinArk's
 *     job) or reinterpret the world (FinWar's job). It only joins + decides.
 *   • Every recommendation is ADVISORY. This system NEVER executes trades.
 */

import type { WorldState } from "./world_state.js";
import type { PortfolioState } from "./portfolio_state.js";

/** FinOS reactive state machine (prompt §4). */
export type FinOSStatus = "IDLE" | "ANALYZING" | "GENERATING" | "READY";

export type ActionType = "buy" | "sell" | "transfer" | "hedge";

export type ActionTimeline = "immediate" | "1m" | "3m" | "6m";

export interface RiskExposure {
  asset_id: string;
  /** Portfolio-weighted risk, 0–1, after overlaying WorldState onto holdings. */
  risk_score: number;
  /** Drivers, e.g. ["freeze_risk:US_EQUITY", "constraint:transfer_limit"]. */
  drivers: string[];
}

export interface Recommendation {
  action_type: ActionType;
  asset_id: string;
  /** Destination jurisdiction for a transfer/migration ("" when N/A). */
  target_jurisdiction: string;
  /** Ordering priority (1 = act first). */
  priority: number;
  timeline: ActionTimeline;
  /** Optional audit string tying the action back to its WorldState driver. */
  rationale?: string;
}

export interface DecisionPacket {
  timestamp: string;
  inputs: {
    world_state: WorldState;
    portfolio_state: PortfolioState;
  };
  analysis: {
    risk_exposure: RiskExposure[];
  };
  recommendations: Recommendation[];
  /** The portfolio FinArk would mirror AFTER the recommendations are applied. */
  projected_state: PortfolioState;
}

/**
 * FinOS policy knobs — where the "WorldState.constraints → effective allocation
 * bounds" mapping params live. The ONLY place tolerances/limits are configured.
 */
export interface DecisionPolicy {
  /** 0 = capital-preservation, 1 = return-seeking. */
  risk_tolerance?: number;
  /** Cap on number of recommendations emitted. */
  max_actions?: number;
  /** When true, `WorldState.constraints` become hard allocation bounds. */
  honor_constraints?: boolean;
}
