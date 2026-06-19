/**
 * FinWar — Geopolitical Financial Threat Simulation Engine (Cloudflare Worker).
 *
 * The TRUTH layer that feeds the FinOS decision pipeline. It models the world and
 * emits a portfolio-INDEPENDENT `WorldState`; it NEVER sees a portfolio and NEVER
 * recommends an action.
 *
 * Routes (paths + shapes fixed by the FinOS↔FinWar contract):
 *   POST /simulate  { scenario, macro_inputs?, timestamp?, seed? }  → WorldState
 *   GET  /state                                                     → latest WorldState
 *   GET  /health                                                    → liveness + status
 *   GET  /                                                          → service description
 *
 * Auth: if `FINWAR_TOKEN` is set, POST /simulate requires `Authorization: Bearer
 * <FINWAR_TOKEN>` (FinOS sends exactly this). Reads stay public.
 *
 * Determinism: the ENGINE never reads the clock — `timestamp` is always an input.
 * Only this HTTP boundary may stamp a received-time timestamp when a caller omits
 * one (the same pattern finos/src/index.ts uses for /decide). Tests always pass
 * an explicit timestamp, so the deterministic surface is fully covered.
 */

import type { WorldInput, WorldState } from "./contracts/index.js";
import { getStatus, getLatest, runSimulation } from "./state.js";

export interface Env {
  /** Optional bearer token guarding POST /simulate. Unset ⇒ route is open. */
  FINWAR_TOKEN?: string;
  /** Scenario used by GET /state before the first /simulate (default "baseline"). */
  FINWAR_DEFAULT_SCENARIO?: string;
}

// --- HTTP helpers (shape mirrors finos/src/index.ts) ------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Thrown by validators; mapped to HTTP 400. */
class BadRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequest";
  }
}

// --- Request validation (→ 400 on malformed input) --------------------------

function validateTimestamp(t: unknown): string | undefined {
  if (t === undefined) return undefined;
  if (typeof t !== "string" || Number.isNaN(Date.parse(t))) {
    throw new BadRequest("`timestamp` must be an ISO date string");
  }
  return t;
}

function validateScenario(s: unknown): string | undefined {
  if (s === undefined) return undefined;
  if (typeof s !== "string") throw new BadRequest("`scenario` must be a string");
  return s;
}

function validateSeed(s: unknown): number | undefined {
  if (s === undefined) return undefined;
  if (typeof s !== "number" || !Number.isFinite(s)) {
    throw new BadRequest("`seed` must be a finite number");
  }
  return s;
}

function validateMacro(m: unknown): Record<string, number> | undefined {
  if (m === undefined) return undefined;
  if (!isObject(m)) throw new BadRequest("`macro_inputs` must be an object of numbers");
  for (const [k, v] of Object.entries(m)) {
    if (typeof v !== "number" || Number.isNaN(v)) {
      throw new BadRequest(`\`macro_inputs.${k}\` must be a number`);
    }
  }
  return m as Record<string, number>;
}

interface SimulateBody {
  scenario?: string;
  macro_inputs?: Record<string, number>;
  timestamp?: string;
  seed?: number;
}

function parseSimulateBody(raw: unknown): SimulateBody {
  if (raw === undefined) return {}; // empty body ⇒ default baseline simulation
  if (!isObject(raw)) throw new BadRequest("request body must be a JSON object");
  return {
    scenario: validateScenario(raw.scenario),
    macro_inputs: validateMacro(raw.macro_inputs),
    timestamp: validateTimestamp(raw.timestamp),
    seed: validateSeed(raw.seed),
  };
}

// --- Auth -------------------------------------------------------------------

/** Returns a 401 Response when the bearer token is required but absent/wrong. */
function authError(req: Request, env: Env): Response | null {
  if (!env.FINWAR_TOKEN) return null; // unguarded
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || match[1] !== env.FINWAR_TOKEN) {
    return json({ error: "unauthorized", message: "missing or invalid bearer token" }, 401);
  }
  return null;
}

// --- /simulate --------------------------------------------------------------

async function handleSimulate(req: Request, env: Env): Promise<Response> {
  const denied = authError(req, env);
  if (denied) return denied;

  const text = await req.text();
  let raw: unknown;
  if (text.trim().length) {
    try {
      raw = JSON.parse(text);
    } catch {
      return json({ error: "bad_request", message: "request body must be valid JSON" }, 400);
    }
  }

  let body: SimulateBody;
  try {
    body = parseSimulateBody(raw);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: "bad_request", message: e.message }, 400);
    throw e;
  }

  const input: WorldInput = {
    timestamp: body.timestamp ?? new Date().toISOString(),
    scenario: body.scenario ?? "baseline",
    seed: body.seed ?? 0,
    macro_inputs: body.macro_inputs,
  };

  const world: WorldState = runSimulation(input);
  return json(world);
}

// --- /state -----------------------------------------------------------------

function handleState(env: Env): Response {
  const defaultInput: WorldInput = {
    timestamp: new Date().toISOString(),
    scenario: env.FINWAR_DEFAULT_SCENARIO ?? "baseline",
    seed: 0,
  };
  return json(getLatest(defaultInput));
}

// --- service info -----------------------------------------------------------

function serviceInfo(): Record<string, unknown> {
  return {
    name: "FinWar — Geopolitical Financial Threat Simulation Engine",
    role: "TRUTH layer: models the world → WorldState (events × per-bucket risk × constraints)",
    portfolio_independent: true,
    emits_actions: false,
    status: getStatus(),
    routes: ["GET /health", "GET /", "GET /state", "POST /simulate"],
    contract: "WorldState (finos/src/contracts/world_state.ts)",
  };
}

// --- router -----------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);

    try {
      if (pathname === "/health") {
        if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
        return json({
          status: "ok",
          service: "finwar",
          finwar_status: getStatus(),
          portfolio_independent: true,
          emits_actions: false,
        });
      }

      if (pathname === "/") {
        if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
        return json(serviceInfo());
      }

      if (pathname === "/state") {
        if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
        return handleState(env);
      }

      if (pathname === "/simulate") {
        if (req.method !== "POST") {
          return new Response(JSON.stringify({ error: "method_not_allowed" }), {
            status: 405,
            headers: { "content-type": "application/json; charset=utf-8", allow: "POST" },
          });
        }
        return await handleSimulate(req, env);
      }

      return json({ error: "not_found" }, 404);
    } catch (err) {
      return json({ error: "internal_error", message: errMsg(err) }, 500);
    }
  },
};
