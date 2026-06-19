/**
 * FinWar v4 — `assembleWorldState`: the pure TRUTH-layer entrypoint.
 *
 *   (WorldInput) → WorldState
 *
 * Folds a resolved pressure vector into the three observable parts of a world:
 *   1. geopolitical_events[] — which shocks fired (axis ≥ trigger → an event)
 *   2. asset_risk_matrix     — per-bucket AssetRisk for ALL eight buckets
 *   3. constraints[]         — what now binds (dual-scoped: bucket + jurisdiction)
 *
 * HARD RULES honored here:
 *   • Portfolio-INDEPENDENT: nothing about holdings/weights enters.
 *   • No buy/sell/transfer output — those are FinOS-only.
 *   • Deterministic & clock-free: `timestamp` is an input; same input ⇒ same output.
 *
 * Constraint scoping is the FinOS-compatibility crux. FinOS matches a constraint
 * to a holding when `scope === bucket` OR `scope === custody.jurisdiction` OR
 * `scope === exposure_tags.country` (EXACT, case-sensitive). So we emit BOTH:
 *   • BUCKET-scoped constraints (e.g. "US_EQUITY") — normalization-independent,
 *     they bite no matter how an upstream spells a jurisdiction; AND
 *   • JURISDICTION-scoped constraints in the canonical uppercase codes FinOS's
 *     decide() switches on ("US","HK","CN","SG"; havens "CH","SG","AE").
 */

import type {
  GeopoliticalEvent,
  WorldConstraint,
  WorldConstraintType,
  WorldInput,
  WorldState,
} from "../contracts/index.js";
import { assetRiskMatrix, clamp01, round4, type PressureVector } from "./model.js";
import { resolveScenario } from "./scenarios.js";

// ── geopolitical_events ─────────────────────────────────────────────────────

const EVENT_TRIGGER = 0.4; // an axis at/above this surfaces as a fired event

interface EventRule {
  id: string;
  axis: keyof PressureVector;
  type: GeopoliticalEvent["type"];
  region: string;
  trigger: number;
  describe: (sev: number) => string;
}

const EVENT_RULES: EventRule[] = [
  {
    id: "evt-us-sanction",
    axis: "us_sanction",
    type: "sanction",
    region: "US",
    trigger: EVENT_TRIGGER,
    describe: () => "US/OFAC sanctions pressure on USD-cleared custody & settlement.",
  },
  {
    id: "evt-cn-capital-control",
    axis: "cn_capital_control",
    type: "capital_control",
    region: "CN",
    trigger: EVENT_TRIGGER,
    describe: () => "China (SAFE) capital-control tightening; cross-border repatriation curbed.",
  },
  {
    id: "evt-hk-banking",
    axis: "hk_pressure",
    type: "banking_restriction",
    region: "HK",
    trigger: EVENT_TRIGGER,
    describe: () => "Hong Kong brokerage/banking compliance alignment & access restriction.",
  },
  {
    id: "evt-global-banking",
    axis: "banking_disruption",
    type: "banking_restriction",
    region: "GLOBAL",
    trigger: EVENT_TRIGGER,
    describe: () => "Cross-border banking / SWIFT disruption; correspondent-USD liquidity stress.",
  },
  {
    id: "evt-crypto-crackdown",
    axis: "crypto_crackdown",
    type: "banking_restriction",
    region: "GLOBAL",
    trigger: EVENT_TRIGGER,
    describe: () => "Crypto exchange & fiat on/off-ramp restrictions tighten.",
  },
  {
    id: "evt-tax-transparency",
    axis: "tax_transparency",
    type: "tax_change",
    region: "GLOBAL",
    // higher bar: CRS is always-on, so only an EXPANSION should fire an event
    trigger: 0.55,
    describe: () => "CRS / automatic tax-information exchange broadened; reporting reach expands.",
  },
];

/** Detects an explicitly kinetic scenario so the `war` event type gets coverage. */
const WAR_PATTERN = /\bwar\b|taiwan|conflict|kinetic|invasion|blockade/;

function buildEvents(P: PressureVector, rawScenario: string): GeopoliticalEvent[] {
  const events: GeopoliticalEvent[] = [];

  if (WAR_PATTERN.test((rawScenario ?? "").toLowerCase())) {
    // Severity tracks the broad-front shock (sanctions × banking), not a single axis.
    const sev = round4(clamp01(0.6 + 0.4 * Math.max(P.us_sanction, P.banking_disruption)));
    events.push({
      id: "evt-kinetic-conflict",
      type: "war",
      region: "APAC",
      severity: sev,
      description: "Kinetic-conflict scenario: multi-front financial-rail disruption in scope.",
    });
  }

  for (const rule of EVENT_RULES) {
    const sev = P[rule.axis];
    if (sev >= rule.trigger) {
      events.push({
        id: rule.id,
        type: rule.type,
        region: rule.region,
        severity: round4(clamp01(sev)),
        description: rule.describe(sev),
      });
    }
  }
  return events;
}

// ── constraints ─────────────────────────────────────────────────────────────

const CONSTRAINT_TRIGGER = 0.45;
const INTENSITY_FLOOR = 0.05; // drop sub-noise constraints

/** A conditional constraint rule: fires when its axis crosses `trigger`. */
interface ConstraintRule {
  axis: keyof PressureVector;
  trigger: number;
  type: WorldConstraintType;
  scope: string; // RiskBucket OR canonical uppercase jurisdiction code
  factor: number; // intensity = factor · axis
}

const CONSTRAINT_RULES: ConstraintRule[] = [
  // US/OFAC sanctions → freezes on USD-cleared buckets + the US jurisdiction.
  { axis: "us_sanction", trigger: CONSTRAINT_TRIGGER, type: "freeze", scope: "US_EQUITY", factor: 0.85 },
  { axis: "us_sanction", trigger: CONSTRAINT_TRIGGER, type: "freeze", scope: "OFFSHORE_USD", factor: 0.7 },
  { axis: "us_sanction", trigger: CONSTRAINT_TRIGGER, type: "freeze", scope: "USD_CASH", factor: 0.7 },
  { axis: "us_sanction", trigger: CONSTRAINT_TRIGGER, type: "freeze", scope: "US", factor: 0.75 },

  // China capital controls → transfer limits on onshore value + the CN jurisdiction.
  { axis: "cn_capital_control", trigger: CONSTRAINT_TRIGGER, type: "transfer_limit", scope: "CN_ONSHORE", factor: 0.9 },
  { axis: "cn_capital_control", trigger: CONSTRAINT_TRIGGER, type: "transfer_limit", scope: "REAL_ESTATE", factor: 0.7 },
  { axis: "cn_capital_control", trigger: CONSTRAINT_TRIGGER, type: "transfer_limit", scope: "CN", factor: 0.85 },

  // HK alignment → brokerage freeze + HK-jurisdiction transfer limit.
  { axis: "hk_pressure", trigger: CONSTRAINT_TRIGGER, type: "freeze", scope: "HK_BROKERAGE", factor: 0.55 },
  { axis: "hk_pressure", trigger: CONSTRAINT_TRIGGER, type: "transfer_limit", scope: "HK", factor: 0.5 },

  // Global banking disruption → transfer limits on banking-dependent USD buckets;
  // a mild bite on the SG offshore hub (so it is no longer a costless haven).
  { axis: "banking_disruption", trigger: CONSTRAINT_TRIGGER, type: "transfer_limit", scope: "OFFSHORE_USD", factor: 0.7 },
  { axis: "banking_disruption", trigger: CONSTRAINT_TRIGGER, type: "transfer_limit", scope: "USD_CASH", factor: 0.4 },
  { axis: "banking_disruption", trigger: CONSTRAINT_TRIGGER, type: "transfer_limit", scope: "SG", factor: 0.35 },

  // Crypto crackdown → ramp (transfer) limit + reporting on cold crypto.
  { axis: "crypto_crackdown", trigger: 0.5, type: "transfer_limit", scope: "CRYPTO_COLD", factor: 0.6 },
  { axis: "crypto_crackdown", trigger: 0.5, type: "reporting", scope: "CRYPTO_COLD", factor: 0.4 },

  // CRS / tax transparency → reporting on offshore + HK/SG; a `tax` bite only on
  // a genuine tax-change wave (axis ≥ 0.7).
  { axis: "tax_transparency", trigger: 0.5, type: "reporting", scope: "OFFSHORE_USD", factor: 0.7 },
  { axis: "tax_transparency", trigger: 0.5, type: "reporting", scope: "HK_BROKERAGE", factor: 0.6 },
  { axis: "tax_transparency", trigger: 0.5, type: "reporting", scope: "HK", factor: 0.5 },
  { axis: "tax_transparency", trigger: 0.5, type: "reporting", scope: "SG", factor: 0.5 },
  { axis: "tax_transparency", trigger: 0.7, type: "tax", scope: "OFFSHORE_USD", factor: 0.5 },
  { axis: "tax_transparency", trigger: 0.7, type: "tax", scope: "HK", factor: 0.4 },
];

function buildConstraints(P: PressureVector): WorldConstraint[] {
  // De-dupe by (type|scope), keeping the strongest intensity — deterministic.
  const strongest = new Map<string, WorldConstraint>();
  for (const rule of CONSTRAINT_RULES) {
    const axisVal = P[rule.axis];
    if (axisVal < rule.trigger) continue;
    const intensity = round4(clamp01(rule.factor * axisVal));
    if (intensity < INTENSITY_FLOOR) continue;
    const key = `${rule.type}|${rule.scope}`;
    const prev = strongest.get(key);
    if (!prev || intensity > prev.intensity) {
      strongest.set(key, { type: rule.type, scope: rule.scope, intensity });
    }
  }
  return [...strongest.values()].sort(
    (a, b) => a.type.localeCompare(b.type) || a.scope.localeCompare(b.scope),
  );
}

// ── assembleWorldState ──────────────────────────────────────────────────────

/**
 * Pure fold: `WorldInput` → `WorldState`. `timestamp` flows straight through
 * (the engine NEVER reads the clock). `seed` is accepted by the contract and
 * reserved for an explicit Monte-Carlo extension; the v4 analytic model is
 * deterministic without it, so it is intentionally not consumed here.
 */
export function assembleWorldState(input: WorldInput): WorldState {
  const { def, pressure, probability } = resolveScenario(input.scenario, input.macro_inputs);

  return {
    timestamp: input.timestamp,
    // Echo the caller's scenario string verbatim (fall back to a label if blank).
    scenario: input.scenario?.trim() ? input.scenario : def.name,
    probability,
    geopolitical_events: buildEvents(pressure, input.scenario ?? ""),
    asset_risk_matrix: assetRiskMatrix(pressure),
    constraints: buildConstraints(pressure),
  };
}
