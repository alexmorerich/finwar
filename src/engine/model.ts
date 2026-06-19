/**
 * FinWar v4 — bucket risk model (the calibrated core of the TRUTH layer).
 *
 * A WorldState describes the world through SIX geopolitical/monetary PRESSURE
 * AXES (0–1 intensity). Each asset BUCKET reacts to those pressures through a
 * fixed, hand-calibrated weight table, producing the bucket's `AssetRisk`. This
 * is portfolio-INDEPENDENT: a bucket is a CLASS of asset, never a user's lot.
 *
 * Calibration lineage (so the numbers aren't arbitrary):
 *   • the legacy terrain engine (engine/terrain/nodes.js) — OFAC/SAFE/CRS axis
 *     scoring per custody jurisdiction / institution / asset type;
 *   • life-finance-os 06_Config/sanctions_model.json — per-asset freeze /
 *     convertibility impacts under Russia-2022-style scenarios;
 *   • life-finance-os 06_Config/geo_resilience.json — settlement-system access
 *     haircuts (USD_CLEARED / CHINA_DOMESTIC / HK_LINKED / NEUTRAL).
 *
 * INVARIANT: every number this file emits is in [0,1]. No clock, no RNG, pure.
 */

import type { AssetRisk, RiskBucket } from "../contracts/index.js";

// ── Pressure axes — the forces a scenario dials up or down ──────────────────
export type PressureAxis =
  | "us_sanction" // US/OFAC sanctions, USD-clearing + DTCC custody seizure
  | "cn_capital_control" // China SAFE capital controls / repatriation block
  | "hk_pressure" // HK brokerage + secondary-sanction alignment (HKD peg → USD)
  | "banking_disruption" // SWIFT / correspondent-banking / global USD liquidity
  | "crypto_crackdown" // exchange + fiat on/off-ramp restriction
  | "tax_transparency"; // CRS reporting / tax-information exchange (always-on)

export type PressureVector = Record<PressureAxis, number>;

export const PRESSURE_AXES: PressureAxis[] = [
  "us_sanction",
  "cn_capital_control",
  "hk_pressure",
  "banking_disruption",
  "crypto_crackdown",
  "tax_transparency",
];

// ── Math helpers (shared shape with finos/decide.ts on purpose) ─────────────
export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const round4 = (x: number): number => Math.round(x * 1e4) / 1e4;

/** Noisy-OR: fuse independent 0–1 signals, monotonic, never leaves [0,1). */
export function noisyOr(parts: number[]): number {
  let survival = 1;
  for (const p of parts) survival *= 1 - clamp01(p);
  return 1 - survival;
}

// ── The eight buckets (a superset spanning both repo universes) ─────────────
export const ALL_BUCKETS: RiskBucket[] = [
  "US_EQUITY",
  "HK_BROKERAGE",
  "CN_ONSHORE",
  "CRYPTO_COLD",
  "GOLD_PHYSICAL",
  "USD_CASH",
  "OFFSHORE_USD",
  "REAL_ESTATE",
];

/**
 * The seven buckets FinOS derives from REAL holdings (FinWar prompt §1). Every
 * one MUST appear in `asset_risk_matrix` — a missing bucket ⇒ that holding
 * scores 0 risk ⇒ no recommendation. (GOLD_PHYSICAL is the optional 8th.)
 */
export const FINOS_REQUIRED_BUCKETS: RiskBucket[] = [
  "US_EQUITY",
  "HK_BROKERAGE",
  "CN_ONSHORE",
  "CRYPTO_COLD",
  "USD_CASH",
  "OFFSHORE_USD",
  "REAL_ESTATE",
];

/** axis → weight; the bucket's dim = noisyOr(baseline + Σ weightᵢ·Pᵢ). */
type AxisWeights = Partial<Record<PressureAxis, number>>;

interface BucketModel {
  /** Structural, always-present floor for a dimension (independent of any axis). */
  baseline?: Partial<Record<keyof AssetRisk, number>>;
  freeze_risk?: AxisWeights;
  liquidity_risk?: AxisWeights;
  regulatory_risk?: AxisWeights;
  capital_control_risk?: AxisWeights;
  /** Self-sovereign SAFETY: base censorship_resistance (higher = safer)… */
  safe_haven?: number;
  /** …eroded by these pressures (more pressure → less safety). */
  haven_erosion?: AxisWeights;
}

/**
 * Per-bucket calibration. Comments state the real-world transmission mechanism;
 * weights are illustrative and tunable — this is a heuristic stress model, not a
 * forecast. Only the dimensions MEANINGFUL for a bucket are populated (contract:
 * "a bucket only carries the dimensions meaningful for it").
 */
export const BUCKET_MODELS: Record<RiskBucket, BucketModel> = {
  // US-listed equity / ETF, DTCC-custodied, USD-cleared (SPYM, IVV @ IBKR/Schwab).
  // The OFAC axis owns this bucket: a sanctioned holder's US securities freeze
  // at the custodian/DTCC. (terrain: dtccRisk 90; sanctions: spym freeze 0.90.)
  US_EQUITY: {
    freeze_risk: { us_sanction: 0.92, banking_disruption: 0.25 },
    liquidity_risk: { banking_disruption: 0.4, us_sanction: 0.2 },
    regulatory_risk: { us_sanction: 0.55, hk_pressure: 0.2, tax_transparency: 0.2 },
    capital_control_risk: { cn_capital_control: 0.12 },
  },

  // HK-custodied brokerage (Futu / HSBC / BOCHK). HKD peg keeps settlement
  // USD-anchored, so secondary sanctions reach it; it is also the conduit most
  // exposed to China policy. (terrain: HK usExposure 50–55 & chinaExposure 55–88.)
  HK_BROKERAGE: {
    baseline: { regulatory_risk: 0.1 },
    freeze_risk: { hk_pressure: 0.5, us_sanction: 0.5, banking_disruption: 0.3 },
    liquidity_risk: { banking_disruption: 0.4, hk_pressure: 0.3 },
    regulatory_risk: { hk_pressure: 0.7, us_sanction: 0.3, tax_transparency: 0.25 },
    capital_control_risk: { cn_capital_control: 0.4, hk_pressure: 0.2 },
  },

  // Mainland A-shares + onshore RMB deposits. CNAPS rails stay up domestically;
  // the bite is SAFE capital control — value is trapped in-jurisdiction, not
  // seized. (sanctions: rmb_cash/china_a_etf freeze under scenario C; terrain CCR 95.)
  CN_ONSHORE: {
    baseline: { capital_control_risk: 0.15 },
    freeze_risk: { cn_capital_control: 0.45, us_sanction: 0.12 },
    liquidity_risk: { cn_capital_control: 0.5 },
    regulatory_risk: { cn_capital_control: 0.35 },
    capital_control_risk: { cn_capital_control: 0.9, banking_disruption: 0.15 },
  },

  // Self-custodied cold crypto — the censorship-resistant haven. Hard to freeze;
  // the real exposure is the fiat OFF-RAMP under a crackdown. (sanctions: btc
  // freeze ≈ 0, convertibility collapses under scenario D.)
  CRYPTO_COLD: {
    freeze_risk: { crypto_crackdown: 0.1 },
    liquidity_risk: { crypto_crackdown: 0.7, banking_disruption: 0.2 },
    regulatory_risk: { crypto_crackdown: 0.5, tax_transparency: 0.2 },
    capital_control_risk: { crypto_crackdown: 0.3 },
    safe_haven: 0.92,
    haven_erosion: { crypto_crackdown: 0.4, banking_disruption: 0.1 },
  },

  // Allocated / physical bullion, self-controlled — a NEUTRAL haven. Mostly
  // unfreezable; exposure is export/transport curbs + illiquidity under stress.
  GOLD_PHYSICAL: {
    baseline: { liquidity_risk: 0.15 },
    freeze_risk: { us_sanction: 0.1 },
    liquidity_risk: { banking_disruption: 0.25, cn_capital_control: 0.2 },
    regulatory_risk: { tax_transparency: 0.15 },
    capital_control_risk: { cn_capital_control: 0.35 },
    safe_haven: 0.7,
    haven_erosion: { banking_disruption: 0.15, cn_capital_control: 0.2 },
  },

  // USD cash / deposits inside US jurisdiction. A compelled US bank freezes it;
  // also exposed to global liquidity stress.
  USD_CASH: {
    freeze_risk: { us_sanction: 0.7, banking_disruption: 0.3 },
    liquidity_risk: { banking_disruption: 0.4 },
    regulatory_risk: { us_sanction: 0.3, tax_transparency: 0.2 },
  },

  // Offshore USD deposits (DBS / StanChart / HK). The MOST banking-dependent
  // bucket: correspondent banking + compliance de-risking freeze it first.
  // (sanctions: offshore_usd freeze 0.70–0.80; compliance_sensitivity 1.0.)
  OFFSHORE_USD: {
    baseline: { regulatory_risk: 0.12 },
    freeze_risk: { us_sanction: 0.6, banking_disruption: 0.6, hk_pressure: 0.3 },
    liquidity_risk: { banking_disruption: 0.6, us_sanction: 0.3 },
    regulatory_risk: { us_sanction: 0.4, hk_pressure: 0.3, tax_transparency: 0.35 },
    capital_control_risk: { cn_capital_control: 0.25 },
  },

  // Onshore registered property — structurally illiquid; title can be locked or
  // seized under capital controls. (geo_resilience: china_re anchor; sanctions:
  // real_estate freeze 0.70 under scenario C.)
  REAL_ESTATE: {
    baseline: { liquidity_risk: 0.45 },
    freeze_risk: { cn_capital_control: 0.5 },
    liquidity_risk: { cn_capital_control: 0.4 },
    regulatory_risk: { cn_capital_control: 0.3, tax_transparency: 0.2 },
    capital_control_risk: { cn_capital_control: 0.7 },
  },
};

/** The four exposure dimensions, in a stable order (determinism). */
const EXPOSURE_DIMS = [
  "freeze_risk",
  "liquidity_risk",
  "regulatory_risk",
  "capital_control_risk",
] as const;

function dimValue(weights: AxisWeights | undefined, baseline: number | undefined, P: PressureVector): number | undefined {
  if (!weights && baseline === undefined) return undefined;
  const parts: number[] = [];
  if (baseline !== undefined) parts.push(baseline);
  if (weights) for (const axis of PRESSURE_AXES) {
    const w = weights[axis];
    if (w !== undefined) parts.push(w * P[axis]);
  }
  return round4(noisyOr(parts));
}

/**
 * Compute one bucket's `AssetRisk` from the pressure vector. Pure; every output
 * field is in [0,1]. Only meaningful dimensions are set (others stay `undefined`,
 * i.e. absent — exactly how FinOS's `intrinsicRisk` expects to read a bucket).
 */
export function bucketRisk(bucket: RiskBucket, P: PressureVector): AssetRisk {
  const m = BUCKET_MODELS[bucket];
  const out: AssetRisk = {};

  for (const dim of EXPOSURE_DIMS) {
    const v = dimValue(m[dim], m.baseline?.[dim], P);
    if (v !== undefined) out[dim] = v;
  }

  if (m.safe_haven !== undefined) {
    const erosion = m.haven_erosion ? noisyOr(
      PRESSURE_AXES.flatMap((a) => {
        const w = m.haven_erosion?.[a];
        return w !== undefined ? [w * P[a]] : [];
      }),
    ) : 0;
    out.censorship_resistance = round4(clamp01(m.safe_haven * (1 - erosion)));
  }

  return out;
}

/** Build the full per-bucket matrix (all eight buckets always present). */
export function assetRiskMatrix(P: PressureVector): Partial<Record<RiskBucket, AssetRisk>> {
  const matrix: Partial<Record<RiskBucket, AssetRisk>> = {};
  for (const b of ALL_BUCKETS) matrix[b] = bucketRisk(b, P);
  return matrix;
}
