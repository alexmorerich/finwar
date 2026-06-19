/**
 * FinWar v4 — scenario library + resolver.
 *
 * A scenario is a named preset of the six PRESSURE AXES plus a base probability.
 * Callers pass a free-form `scenario` string (preserved verbatim in the emitted
 * WorldState); a DETERMINISTIC keyword resolver maps it onto the closest canonical
 * preset. `macro_inputs` then overrides individual axes (explicit caller intent),
 * so the same call always yields the same pressure vector — no clock, no RNG.
 */

import { clamp01, PRESSURE_AXES, type PressureAxis, type PressureVector } from "./model.js";

export interface ScenarioDef {
  /** Canonical id. */
  key: string;
  /** Default human label (used when the caller's scenario string is blank). */
  name: string;
  /** Base scenario probability, 0–1. */
  probability: number;
  pressure: PressureVector;
}

const P = (
  us_sanction: number,
  cn_capital_control: number,
  hk_pressure: number,
  banking_disruption: number,
  crypto_crackdown: number,
  tax_transparency: number,
): PressureVector => ({
  us_sanction,
  cn_capital_control,
  hk_pressure,
  banking_disruption,
  crypto_crackdown,
  tax_transparency,
});

/**
 * Canonical scenarios. `tax_transparency` carries a non-zero floor everywhere
 * because CRS reporting is always-on; "baseline" is a calm-but-live world, not a
 * zero world. Probabilities are illustrative scenario likelihoods, not forecasts.
 */
export const SCENARIOS: Record<string, ScenarioDef> = {
  //                              us    cn    hk    bank  cryp  tax
  baseline: {
    key: "baseline",
    name: "Baseline (calm-but-live world)",
    probability: 0.6,
    pressure: P(0.2, 0.25, 0.2, 0.1, 0.15, 0.4),
  },
  us_china_escalation: {
    key: "us_china_escalation",
    name: "US–China financial escalation",
    probability: 0.35,
    pressure: P(0.75, 0.6, 0.6, 0.4, 0.3, 0.6),
  },
  us_secondary_sanctions: {
    key: "us_secondary_sanctions",
    name: "US secondary-sanctions expansion",
    probability: 0.3,
    pressure: P(0.85, 0.4, 0.6, 0.35, 0.25, 0.5),
  },
  global_banking_disruption: {
    key: "global_banking_disruption",
    name: "Global banking / SWIFT disruption",
    probability: 0.2,
    pressure: P(0.5, 0.3, 0.45, 0.9, 0.3, 0.4),
  },
  china_capital_controls: {
    key: "china_capital_controls",
    name: "China capital-control tightening",
    probability: 0.4,
    pressure: P(0.2, 0.9, 0.4, 0.2, 0.45, 0.4),
  },
  crypto_dislocation: {
    key: "crypto_dislocation",
    name: "Crypto market dislocation / ramp restriction",
    probability: 0.3,
    pressure: P(0.3, 0.4, 0.25, 0.3, 0.9, 0.5),
  },
  tax_transparency_expansion: {
    key: "tax_transparency_expansion",
    name: "CRS / tax-transparency expansion",
    probability: 0.45,
    pressure: P(0.25, 0.3, 0.3, 0.15, 0.3, 0.9),
  },
};

export const SCENARIO_KEYS = Object.keys(SCENARIOS);

/**
 * Ordered keyword rules: the FIRST whose pattern matches the (lowercased)
 * scenario string wins. Order encodes priority — the most specific intent first
 * ("secondary sanctions" before the generic escalation/sanction catch-all).
 */
const RESOLVER_RULES: { pattern: RegExp; key: string }[] = [
  { pattern: /swift|correspondent|interbank|banking (network|disruption|shutdown|crisis)|global.*(bank|usd|liquidity)/, key: "global_banking_disruption" },
  { pattern: /capital[ _-]?control|repatriat|capital flight|outflow|\bsafe\b|\brmb\b|onshore|yuan|renminbi/, key: "china_capital_controls" },
  { pattern: /crypto|bitcoin|\bbtc\b|stablecoin|usdt|exchange|on[- ]?ramp|off[- ]?ramp/, key: "crypto_dislocation" },
  { pattern: /\btax\b|\bcrs\b|reporting|transparen|fatca|information exchange|aeoi/, key: "tax_transparency_expansion" },
  { pattern: /secondary[ _-]?sanction|\bofac\b|\bsdn\b|entity list|secondary/, key: "us_secondary_sanctions" },
  { pattern: /escalat|us[- ]?china|china|taiwan|decoupl|sanction|\bwar\b|conflict|geopolit/, key: "us_china_escalation" },
];

/** Deterministically map a free-form scenario string onto a canonical preset. */
export function resolveScenarioKey(scenario: string): string {
  const s = (scenario ?? "").toLowerCase().trim();
  if (!s) return "baseline";
  if (SCENARIOS[s]) return s; // exact canonical key
  for (const { pattern, key } of RESOLVER_RULES) if (pattern.test(s)) return key;
  return "baseline";
}

/** macro_inputs alias → pressure axis. Axis names themselves also work directly. */
const MACRO_ALIASES: Record<string, PressureAxis> = {
  sanction: "us_sanction",
  sanctions: "us_sanction",
  ofac: "us_sanction",
  capital_control: "cn_capital_control",
  capital_controls: "cn_capital_control",
  safe: "cn_capital_control",
  rmb: "cn_capital_control",
  hk: "hk_pressure",
  hongkong: "hk_pressure",
  banking: "banking_disruption",
  swift: "banking_disruption",
  liquidity: "banking_disruption",
  crypto: "crypto_crackdown",
  tax: "tax_transparency",
  crs: "tax_transparency",
};

export interface ResolvedScenario {
  def: ScenarioDef;
  pressure: PressureVector;
  probability: number;
}

/**
 * Resolve (scenario, macro_inputs) → final pressure vector + probability.
 * `macro_inputs` keys that name an axis (or a known alias) OVERRIDE that axis,
 * clamped to [0,1]; a `probability` key overrides scenario probability. Unknown
 * keys are ignored. Pure and deterministic.
 */
export function resolveScenario(
  scenario: string,
  macro_inputs: Record<string, number> = {},
): ResolvedScenario {
  const def = SCENARIOS[resolveScenarioKey(scenario)];
  const pressure: PressureVector = { ...def.pressure };
  let probability = def.probability;

  for (const [rawKey, rawVal] of Object.entries(macro_inputs)) {
    if (typeof rawVal !== "number" || Number.isNaN(rawVal)) continue;
    const key = rawKey.toLowerCase();
    if (key === "probability" || key === "prob") {
      probability = clamp01(rawVal);
      continue;
    }
    const axis = (PRESSURE_AXES as string[]).includes(key)
      ? (key as PressureAxis)
      : MACRO_ALIASES[key];
    if (axis) pressure[axis] = clamp01(rawVal);
  }

  return { def, pressure, probability: clamp01(probability) };
}
