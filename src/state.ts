/**
 * FinWar reactive state machine + in-memory latest-WorldState cache.
 *
 *   IDLE ──(POST /simulate)──► SIMULATING ──(complete)──► UPDATED ──(observed)──► STABLE
 *
 * The engine itself is pure and stateless; this module is the thin reactive
 * shell the prompt's state machine (§ "STATE MACHINE") describes. Cloudflare
 * isolates are ephemeral, so this cache is best-effort per-isolate — correctness
 * never depends on it (every /simulate recomputes from inputs). The decay edge
 * UPDATED→STABLE is modeled as "the freshly-updated state has now been observed"
 * rather than via a wall-clock timer, keeping the whole module clock-free.
 */

import type { FinWarStatus, WorldInput, WorldState } from "./contracts/index.js";
import { assembleWorldState } from "./engine/assemble.js";

interface Store {
  status: FinWarStatus;
  latest: WorldState | null;
}

const store: Store = { status: "IDLE", latest: null };

export function getStatus(): FinWarStatus {
  return store.status;
}

/** Trigger a simulation: → SIMULATING → UPDATED, caching the result. */
export function runSimulation(input: WorldInput): WorldState {
  store.status = "SIMULATING";
  const world = assembleWorldState(input);
  store.latest = world;
  store.status = "UPDATED";
  return world;
}

/**
 * Latest WorldState. Before the first /simulate, lazily compute the default
 * baseline from `defaultInput` (caller-supplied timestamp — never the clock).
 * Observing a freshly UPDATED state decays it to STABLE.
 */
export function getLatest(defaultInput: WorldInput): WorldState {
  if (!store.latest) {
    store.latest = assembleWorldState(defaultInput);
    store.status = "STABLE";
    return store.latest;
  }
  if (store.status === "UPDATED") store.status = "STABLE";
  return store.latest;
}

/** Test-only: reset the reactive shell to a cold IDLE. */
export function resetState(): void {
  store.status = "IDLE";
  store.latest = null;
}
