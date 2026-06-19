// Spec §3 — Custody model. custody_mode is a FIRST-CLASS survival dimension.
//
// Higher resilience = freeze vectors bite less, because there is no compliant
// intermediary that can be compelled to freeze the position. This is the core
// "BTC self-custody ≠ financial asset risk" rule: the freeze acts on the
// intermediary, not on the instrument.
export const CUSTODY_RESILIENCE = {
  self_custody: 0.95, // you hold the keys / bearer instrument under your control
  bearer: 0.85, // physical, transferable without a registry (gold, cash)
  custodied: 0.40, // a broker / exchange holds it for you
  bank_deposit: 0.20, // an unsecured claim on a regulated bank
  registered_broker: 0.10, // street-name holdings inside a registered broker
  registered: 0.05, // state-registered title (real estate) — lowest resilience
};

export function custodyResilience(mode) {
  if (!(mode in CUSTODY_RESILIENCE)) {
    throw new Error(`Unknown custody_mode: ${mode}`);
  }
  return CUSTODY_RESILIENCE[mode];
}
