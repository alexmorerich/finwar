/**
 * FINARK CONTRACT — `PortfolioState` (the mirror layer).
 *
 * FinArk is a PURE, FACTUAL mirror of what the user holds and where it is
 * custodied. It answers "what do I have / where is it / what are its structural
 * attributes?" — it NEVER scores risk, suggests allocation, or simulates the
 * world. (Risk → FinWar. Decisions → FinOS.)
 *
 * `assemblePortfolioState` below is the reference implementation: a pure,
 * deterministic fold from stated holdings to totals + grouped exposure. No I/O,
 * no clock, no randomness.
 */

/** FinArk reactive state machine (prompt §4). */
export type FinArkStatus = "SYNCING" | "UPDATED" | "OUTDATED";

export type HoldingType =
  | "ETF"
  | "stock"
  | "bond"
  | "cash"
  | "crypto"
  | "real_estate";

export type CustodyType = "bank" | "brokerage" | "self_custody";

export type LiquidityTier = "high" | "medium" | "low";

export interface Custody {
  institution: string;
  type: CustodyType;
  /** Jurisdiction the custodian answers to, e.g. "US", "HK", "CH", "SG". */
  jurisdiction: string;
}

export interface ExposureTags {
  /** Economic-exposure country (may differ from custody jurisdiction). */
  country: string;
  tax_regime: string;
  liquidity_tier: LiquidityTier;
}

export interface Holding {
  asset_id: string;
  type: HoldingType;
  name: string;
  /** Quantity in native units (shares, coins, currency units…). */
  amount: number;
  currency: string;
  /**
   * Stated USD mark of the lot — a FACT supplied with the holding (not a
   * computed risk/return figure) so aggregation needs no FX/pricing engine
   * inside FinArk.
   */
  value_usd: number;
  custody: Custody;
  exposure_tags: ExposureTags;
}

export interface PortfolioAggregation {
  by_asset_type: Record<string, number>;
  by_jurisdiction: Record<string, number>;
  by_custody_type: Record<string, number>;
}

export interface PortfolioState {
  /** Caller-supplied ISO timestamp (determinism: never generated internally). */
  timestamp: string;
  total_value_usd: number;
  assets: Holding[];
  aggregation: PortfolioAggregation;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

function addInto(bucket: Record<string, number>, key: string, v: number): void {
  bucket[key] = round2((bucket[key] ?? 0) + v);
}

/**
 * Reference FinArk fold: stated holdings → factual `PortfolioState`. Pure and
 * deterministic; preserves input order in `assets`.
 */
export function assemblePortfolioState(
  timestamp: string,
  holdings: Holding[],
): PortfolioState {
  const aggregation: PortfolioAggregation = {
    by_asset_type: {},
    by_jurisdiction: {},
    by_custody_type: {},
  };
  let total = 0;

  for (const h of holdings) {
    total += h.value_usd;
    addInto(aggregation.by_asset_type, h.type, h.value_usd);
    addInto(aggregation.by_jurisdiction, h.custody.jurisdiction, h.value_usd);
    addInto(aggregation.by_custody_type, h.custody.type, h.value_usd);
  }

  return {
    timestamp,
    total_value_usd: round2(total),
    assets: [...holdings],
    aggregation,
  };
}
