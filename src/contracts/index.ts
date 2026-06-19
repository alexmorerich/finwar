/**
 * FinWar / FinArk / FinOS — shared contract layer (single source of truth).
 *
 * This is the boundary every layer (and every coder agent) codes against. The
 * three product prompts map 1:1 onto the three contracts re-exported here:
 *   • FinWar prompt → `WorldState`       (world_state.ts)
 *   • FinArk prompt → `PortfolioState`   (portfolio_state.ts)
 *   • FinOS  prompt → `DecisionPacket`   (decision_packet.ts)
 *
 * Dependency direction — the ONLY legal wiring:
 *
 *     FinWar ──WorldState──►              ◄──PortfolioState── FinArk
 *                              FinOS.decide
 *                                   │
 *                                   ▼
 *                              DecisionPacket
 *
 * Boundary rules (enforced by these signatures + review):
 *   1. FinWar reads market/geo/regulatory inputs → WorldState. NEVER sees a
 *      portfolio; NEVER recommends an action.
 *   2. FinArk reads holdings → PortfolioState. NEVER scores risk; NEVER
 *      simulates the world.
 *   3. FinOS is the ONLY layer that consumes BOTH, and the ONLY layer whose
 *      output type carries `recommendations`. Owns no source-of-truth data.
 *
 * Reactive flow (who recomputes when):
 *     FinWar.update ─┐
 *                    ├─► FinOS.decide → new DecisionPacket
 *     FinArk.update ─┘
 */

export * from "./world_state.js";
export * from "./portfolio_state.js";
export * from "./decision_packet.js";

import type { WorldInput, WorldState } from "./world_state.js";
import type { Holding, PortfolioState } from "./portfolio_state.js";
import type { DecisionPacket, DecisionPolicy } from "./decision_packet.js";

/**
 * FinWar entrypoint. Pure given (input + engine config bound by the adapter).
 * Constraint: `WorldInput` carries no portfolio — enforced by its type.
 */
export type AssembleWorldState = (input: WorldInput) => WorldState;

/** FinArk entrypoint. Pure fold of stated holdings → factual mirror. */
export type AssemblePortfolioState = (
  timestamp: string,
  holdings: Holding[],
) => PortfolioState;

/**
 * FinOS entrypoint — the join. The ONLY signature that returns a DecisionPacket
 * (and therefore the only one that may produce `recommendations`).
 */
export type Decide = (
  world: WorldState,
  portfolio: PortfolioState,
  policy: DecisionPolicy,
) => DecisionPacket;
