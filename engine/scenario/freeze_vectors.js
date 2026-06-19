// Spec §1 — Freeze Vector System.
//
// A freeze vector targets ONE link of the position chain. A scenario is a set of
// vectors. Risk is applied per-vector per-link — NEVER as an asset-level scalar
// and NEVER as min(SRS, CCR).
//
// Fields:
//   type       seizure  — access blocked / assets frozen by a compelled intermediary
//              lock     — capital control: still owned, but cannot convert / move out
//              market   — venue / trading access removed
//   active_from  earliest time phase at which the vector bites (T0 / T1 / T7)
//   severity     survival multiplier at FULL effect (custody resilience R = 0).
//                Attenuated by custody resilience inside the survival function.
//   match(p)     predicate over a position chain `p`.

const isUS = (x) => !!x && x.reg === "US";

export const VECTORS = {
  // ───────── US_SANCTION — reaches custodian, venue, USD rail, issuer ─────────
  custodian_reg: {
    id: "custodian_reg",
    scenario: "US_SANCTION",
    type: "seizure",
    active_from: "T1",
    severity: 0.55,
    blurb: "custodian compelled to freeze (US-registered or USD-clearing exposure)",
    // Secondary sanctions: USD-clearing exposure forces even offshore custodians to comply.
    match: (p) =>
      !!p.custodian && (p.custodian.reg === "US" || p.custodian.usd_clearing === true),
  },
  venue_reg: {
    id: "venue_reg",
    scenario: "US_SANCTION",
    type: "market",
    active_from: "T0",
    severity: 0.85,
    blurb: "trading venue delists / halts the security",
    match: (p) => isUS(p.venue),
  },
  rail_settlement: {
    id: "rail_settlement",
    scenario: "US_SANCTION",
    type: "seizure",
    active_from: "T7",
    severity: 0.70,
    blurb: "USD settlement rail (CHIPS / SWIFT / Fedwire) blocked",
    match: (p) =>
      !!p.rail &&
      (p.rail.settle === "CHIPS" ||
        p.rail.settle === "SWIFT" ||
        p.rail.settle === "Fedwire" ||
        p.rail.currency === "USD"),
  },
  issuer_reg: {
    id: "issuer_reg",
    scenario: "US_SANCTION",
    type: "seizure",
    active_from: "T1",
    severity: 0.90,
    blurb: "US issuer can be ordered to void / block the instrument",
    match: (p) => isUS(p.issuer),
  },

  // ───────── CN_CAPITAL_LOCK — holder residency, currency, outbound rail ─────────
  // Note: these are LOCKS (capital control), not seizures. The asset is still
  // owned; its value simply cannot be converted or moved across the border.
  holder_residency: {
    id: "holder_residency",
    scenario: "CN_CAPITAL_LOCK",
    type: "lock",
    active_from: "T1",
    severity: 0.45,
    blurb: "mainland-resident holder subject to capital-control orders",
    match: (p) => !!p.holder && p.holder.residency === "CN",
  },
  currency_convertibility: {
    id: "currency_convertibility",
    scenario: "CN_CAPITAL_LOCK",
    type: "lock",
    active_from: "T0",
    severity: 0.40,
    blurb: "RMB↔FX conversion suspended / quota-gated (SAFE)",
    match: (p) => !!p.rail && (p.rail.currency === "CNY" || p.rail.currency === "RMB"),
  },
  outbound_rail: {
    id: "outbound_rail",
    scenario: "CN_CAPITAL_LOCK",
    type: "lock",
    active_from: "T0",
    severity: 0.40,
    blurb: "cross-border outbound transfer blocked for onshore value",
    match: (p) => {
      const onshoreSettle =
        !!p.rail && (p.rail.settle === "CNAPS" || p.rail.settle === "CIPS");
      const onshoreCustody = !!p.custodian && p.custodian.reg === "CN";
      return onshoreSettle || onshoreCustody;
    },
  },

  // ───────── GLOBAL_COLLAPSE — systemic rail degradation ─────────
  global_rail_degradation: {
    id: "global_rail_degradation",
    scenario: "GLOBAL_COLLAPSE",
    type: "seizure",
    active_from: "T1",
    severity: 0.55,
    blurb: "cross-border settlement throughput collapses for intermediated assets",
    match: (p) => p.custody_mode !== "self_custody" && p.custody_mode !== "bearer",
  },
};

export const ALL_VECTORS = Object.values(VECTORS);
