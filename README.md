# 🧠 FINWAR — Geopolitical Financial Threat Engine

> A **multi-jurisdiction financial threat simulation engine**. It models what happens to capital under **US sanctions, Chinese capital controls, banking-rail disruption, crypto crackdowns, and tax-transparency expansion** — at the level of the **custody chain / asset bucket**, not the asset label.

FINWAR is **not** a portfolio optimizer and **not** an advisory system. It models the **world**; it never sees a portfolio and never recommends an action.

**▶ Live demo** (GitHub Pages — no install): **[Financial Kill-Chain v3.3](https://alexmorerich.github.io/finwar/terrain.html)** · [v3.2 survival dashboard](https://alexmorerich.github.io/finwar/) · [self-contained demo](https://alexmorerich.github.io/finwar/demo.html)

It ships in two layers:

- **FinWar v4 — `WorldState` service** (`src/`): the contract-typed Cloudflare Worker that is the **TRUTH layer feeding the [FinOS](../finos) decision pipeline**. `POST /simulate → WorldState` (events × per-bucket asset risk × binding constraints). **Start here** — see the next section.
- **FinWar v3.2/v3.3 — survival physics engine** (`engine/`): the original zero-dependency research engine (position-chain survival + v3.3 financial kill-chain) that supplies v4's risk calibration. Documented from "Core thesis" onward.

---

## FinWar v4 — the `WorldState` service (FinOS truth layer)

FinWar v4 answers one question — **"what changed in the world?"** — and emits a **portfolio-INDEPENDENT** [`WorldState`](src/contracts/world_state.ts). FinOS joins that with a FinArk `PortfolioState` to produce advisory recommendations. FinWar itself emits **no buy/sell/transfer** and holds **no portfolio data**.

```
FinWar ──WorldState──►              ◄──PortfolioState── FinArk
                         FinOS.decide
                              ▼
                        DecisionPacket   (recommendations live ONLY here)
```

### Output contract (non-negotiable — typed against the shared `contracts/`)

`src/contracts/` is **copied byte-identical from finos** (single source of truth — do not fork the shapes). `assembleWorldState(input)` returns:

```jsonc
{
  "timestamp": "2026-06-19T00:00:00.000Z", // caller-supplied; engine NEVER calls the clock
  "scenario": "US-China financial escalation",
  "probability": 0.35,
  "geopolitical_events": [ { "id", "type", "region", "severity": 0.75, "description" } ],
  "asset_risk_matrix": { "US_EQUITY": { "freeze_risk": 0.72, "regulatory_risk": 0.55, … }, … },
  "constraints": [ { "type": "freeze", "scope": "US_EQUITY", "intensity": 0.64 }, … ]
}
```

- **`geopolitical_events[].type`** ∈ `sanction · war · capital_control · tax_change · banking_restriction`.
- **`asset_risk_matrix`** is keyed by **asset BUCKET** (a class, never a lot). All **8** buckets are always populated — the **7 FinOS derives from real holdings** (`US_EQUITY, HK_BROKERAGE, CN_ONSHORE, CRYPTO_COLD, USD_CASH, OFFSHORE_USD, REAL_ESTATE`) plus the optional `GOLD_PHYSICAL`. *A missing bucket ⇒ that holding scores 0 risk ⇒ no recommendation*, so none are ever omitted.
- **`AssetRisk`** dims (each optional, 0–1): `freeze_risk · liquidity_risk · regulatory_risk · capital_control_risk · censorship_resistance` (the last is a **safety** dim — higher = safer; carried only by the self-sovereign havens).
- **`constraints[].type`** ∈ `freeze · transfer_limit · reporting · tax`; **`intensity`** 0–1.

### Constraint scoping (the FinOS-compatibility crux)

FinOS matches a constraint to a holding when `scope` equals the holding's **bucket**, **`custody.jurisdiction`**, or **`exposure_tags.country`** (EXACT, case-sensitive). FinWar therefore emits **both**:

1. **bucket-scoped** constraints (e.g. `freeze@US_EQUITY`, `transfer_limit@CN_ONSHORE`) — normalization-independent; they bite no matter how an upstream spells a jurisdiction; **and**
2. **jurisdiction-scoped** constraints in the **canonical uppercase codes** FinOS's `decide()` switches on — `US · HK · CN · SG` (+ havens `CH · AE · self`).

> **Normalization note.** FinArk's raw `data.json` currently uses long-form labels (`"USA"`, `"China"`, `"Hong Kong"`, `"Self-custody"`). FinOS's `decide()` switches on the **canonical** codes (`jurisdictionBucket` tests `j === "CN"`; havens are `CH/SG/AE`), and `finos/test/decide.test.ts` uses `US/HK/CN/self`. FinWar emits the canonical codes — a compliant FinArk worker is expected to normalize to them. Because FinWar **also** scopes by bucket, recommendations fire correctly **regardless** of that normalization.

### Engine model (deterministic, clock-free)

Six **pressure axes** (`us_sanction · cn_capital_control · hk_pressure · banking_disruption · crypto_crackdown · tax_transparency`) are set by a named **scenario** and then overridden by `macro_inputs`; each bucket reacts via a hand-calibrated weight table (`src/engine/model.ts`), fused with noisy-OR so every output stays in [0,1]. Calibration lineage: the v3.2 terrain nodes (OFAC/SAFE/CRS axis scores) + life-finance-os `sanctions_model.json` / `geo_resilience.json`.

A free-form `scenario` string is preserved verbatim and **deterministically resolved** to the nearest canonical preset (`baseline · us_china_escalation · us_secondary_sanctions · global_banking_disruption · china_capital_controls · crypto_dislocation · tax_transparency_expansion`). Same `(scenario, macro_inputs, timestamp)` ⇒ identical `WorldState`.

### API

```
POST /simulate  { scenario, macro_inputs?, timestamp?, seed? }  → WorldState
GET  /state                                                     → latest WorldState
GET  /health                                                    → liveness + reactive status
GET  /                                                          → service description
```

State machine: `IDLE →(POST /simulate)→ SIMULATING →(complete)→ UPDATED →(observed)→ STABLE`. Auth: if `FINWAR_TOKEN` is set, `POST /simulate` requires `Authorization: Bearer <token>` (FinOS sends exactly this); reads stay public.

```bash
npm install
npm run typecheck     # tsc --noEmit (output typed as WorldState)
npm test              # WorldState unit tests + live FinOS decide() integration
npm run dev           # wrangler dev  → http://localhost:8787
npm run deploy        # wrangler deploy
```

The `npm test` suite includes a cross-repo acceptance test: a `/simulate` `WorldState` + a FinArk-shaped `PortfolioState`, fed into the **real** `finos/decide()`, must yield non-empty recommendations (auto-skips if the sibling `../finos` repo is absent).

---

## Core thesis

Under dual-direction financial warfare, an asset's fate is **not** a property of the asset. It is a property of the **chain of intermediaries** that stands between you and the value:

```
holder → custodian → settlement rail → issuer → venue
```

A US-listed ETF held at a US broker by a Hong-Kong resident touches **four** jurisdictions at once. Whether it freezes depends on *which link* a sanction reaches — not on the ticker.

This is why the engine **rejects** the old model:

| ❌ Rejected (v3.1 and earlier) | ✔ FINWAR v3.2 |
| --- | --- |
| `FSS = min(SRS, CCR)` | `survival = ∏ freeze-vector impacts` |
| one `jurisdiction` per asset | a **position chain** with a jurisdiction per link |
| single snapshot | **time-phased** T0 / T1 / T7 |
| `liquidity_days` scalar | `escape_window = time_to_freeze − time_to_liquidate` |
| asset-level risk | **custody-chain** risk (`custody_mode` is first-class) |

---

## Architecture

```
finwar/
├── wrangler.jsonc                  ★ FinWar v4 Worker config (name: finwar, main: src/index.ts)
├── tsconfig.json                   ★ NodeNext strict (scoped to src/ + test/)
│
├── src/                            ★ FinWar v4 — WorldState service (FinOS truth layer)
│   ├── index.ts                    Worker: POST /simulate · GET /state · GET /health · GET /
│   ├── state.ts                    reactive status machine + latest-WorldState cache
│   ├── contracts/                  SHARED contract layer (byte-identical to finos — do not fork)
│   │   ├── world_state.ts          the WorldState / WorldInput / AssetRisk / RiskBucket shapes
│   │   ├── portfolio_state.ts      FinArk's PortfolioState (imported for the integration test)
│   │   ├── decision_packet.ts      FinOS's DecisionPacket (for type-level cross-checks)
│   │   └── index.ts                contract barrel
│   └── engine/
│       ├── model.ts                6 pressure axes → 8-bucket AssetRisk matrix (calibrated)
│       ├── scenarios.ts            scenario library + deterministic string resolver + macro overrides
│       └── assemble.ts             assembleWorldState(WorldInput) → WorldState (pure)
│
├── index.html                      v3.2 UI — scenario toggles, phase selector, survival dashboard
├── demo.html                       self-contained v3.2 dashboard (double-click, offline)
├── terrain.html                    Financial Kill-Chain — settlement→custody→asset net + 3D exposure cloud
├── data.json                       FACTS LAYER (positions only; no computed outputs)
├── package.json
│
├── engine/
│   ├── engine.js                   v3.2 orchestrator → spec §12 output bundle + CLI
│   ├── core/
│   │   ├── custody.js              custody_mode → resilience (§3)
│   │   ├── survival.js             multiplicative survival model (§2)
│   │   └── classifier.js           MOVEABLE / TRAPPED / FROZEN (§8)
│   ├── scenario/
│   │   ├── freeze_vectors.js       per-link freeze vectors (§1)
│   │   ├── scenarios.js            US_SANCTION · CN_CAPITAL_LOCK · GLOBAL_COLLAPSE
│   │   └── compose.js              dual / multi-blockade composition (§5)
│   ├── simulation/
│   │   ├── time_phases.js          T0 / T1 / T7 (§4)
│   │   └── exit_engine.js          escape_window (§6/§7)
│   └── terrain/                    v3.3 financial kill-chain engine (settlement → custody → asset)
│       ├── nodes.js                settlement-network / custodian / jurisdiction / asset-class / ownership refs
│       ├── risk_engine.js          ofacDependency engine (§3) → WarPath (§4) + scenario queries + migration (§6)
│       ├── portfolio.js            §7 calibration assets (full Asset schema; no weights — §8)
│       └── terrain.js              CLI → WarPaths + kill-chain risk map + §4 scenario queries
│
├── test/                           ★ v4 TS suite (node --import tsx --test)
│   ├── worldstate.test.ts          WorldState contract + engine invariants (15 checks)
│   └── finos_integration.test.ts   live finos decide() acceptance (skips if ../finos absent)
│
└── tests/                          v3.2 legacy suite (zero-dep, `npm run test:legacy`)
    ├── golden.test.js              3 mandatory v3.2 golden cases (§9)
    └── terrain.test.js             v3.3 kill-chain engine validation (43 checks)
```

---

## The model

### 1 · Position chain
Every asset is a chain of links, each carrying its own jurisdiction:

```js
position = {
  holder:    { citizenship: "CN", residency: "HK" },
  custodian: { entity: "IBKR", reg: "US", usd_clearing: true },
  rail:      { currency: "USD", settle: "CHIPS" },
  issuer:    { name: "BlackRock", reg: "US" },
  venue:     { exchange: "NYSE", reg: "US" },
  custody_mode: "custodied"   // self_custody | bearer | custodied | bank_deposit | registered_broker | registered
}
```

### 2 · Freeze vectors
A scenario is a **set of freeze vectors**. Each vector targets **one link** and has a `type`, an activation phase, and a raw severity:

| type | meaning |
| --- | --- |
| `seizure` | access blocked / assets frozen by a compelled intermediary |
| `lock` | capital control — still owned, but cannot convert / move out |
| `market` | trading venue delists / halts the security |

```
US_SANCTION     → custodian_reg · venue_reg · rail_settlement · issuer_reg
CN_CAPITAL_LOCK → holder_residency · currency_convertibility · outbound_rail
GLOBAL_COLLAPSE → global_rail_degradation
```

The **capital-control vs confiscation** distinction is explicit: China's vectors are `lock` (the value is trapped in-jurisdiction, not seized), the US vectors are mostly `seizure`. Secondary sanctions are modeled too — `custodian_reg` also fires on `usd_clearing: true`, so an *offshore* custodian with USD exposure still freezes.

### 3 · Multiplicative survival (replaces `min`)
```
survival_score = ∏ eff(vector)   over every matched, active vector
eff = 1 − (1 − severity) × (1 − R)        // R = custody resilience
```
`R = 0` → full severity; `R = 1` → custody fully neutralises the vector. This is the **BTC self-custody ≠ financial asset risk** rule: with no compellable intermediary, freeze vectors simply don't match the chain.

| `custody_mode` | resilience R |
| --- | --- |
| `self_custody` | 0.95 |
| `bearer` | 0.85 |
| `custodied` | 0.40 |
| `bank_deposit` | 0.20 |
| `registered_broker` | 0.10 |
| `registered` (real estate) | 0.05 |

### 4 · Time dimension
Vectors activate at **T0 (announcement, d0) · T1 (execution, d1) · T7 (settlement collapse, d7)**. The same asset can read MOVEABLE at T0 and FROZEN at T7. The headline classification is the fully-executed **T7** worst case.

### 5 · Scenario composition
```js
composeScenarios(["US_SANCTION", "CN_CAPITAL_LOCK"])
// → union of freeze vectors, de-duped by id, mode: "dual_or_multi_blockade"
```
Dual = the **union** of both attack surfaces, evaluated multiplicatively. This is the required dual-system stress test.

### 6 · Exit engine
```
escape_window = time_to_freeze − time_to_liquidate
   > 0  → escape possible (you can liquidate before the freeze lands)
   < 0  → already trapped
```

### 7 · Classification (§8)
```
survival > 0.7   → MOVEABLE 🟢
0.3 – 0.7        → TRAPPED  🟡
< 0.3            → FROZEN   🔴
```

---

## Output schema (§12)

`simulateAsset(asset, scenarioNames)` returns:

```jsonc
{
  "asset_id": "ibkr_us_etf_hk",
  "survival_score": 0.512,
  "classification": "TRAPPED",
  "escape_window": -1,
  "frozen_vectors": ["custodian_reg", "venue_reg", "rail_settlement", "issuer_reg"],
  "explanation_trace": [
    "custodian_reg matched US_SANCTION (seizure, activates T1) → survival ×0.73",
    "venue_reg halted by US_SANCTION (market, activates T0) → survival ×0.91",
    "rail_settlement matched US_SANCTION (seizure, activates T7) → survival ×0.82",
    "issuer_reg matched US_SANCTION (seizure, activates T1) → survival ×0.94"
  ],
  "exit":   { "time_to_liquidate": 1, "time_to_freeze": 0, "escape_window": -1 },
  "phases": { "T0": { "...": "" }, "T1": { "...": "" }, "T7": { "...": "" } }
}
```

Every result is fully **explainable** — `explanation_trace` (§11) states *why* each link froze.

---

## Data contract (§10)

`data.json` is a pure **facts layer**. It MUST contain only `base_srs`, `base_ccr`, `custody_mode`, position-chain fields, and time-based liquidity params. It MUST NOT contain `FSS`, `survival_score`, `classification`, or any scenario output — those are computed by the engine and never persisted. This is enforced by a golden test.

---

## Golden tests (§9)

| Test | Position | Expected |
| --- | --- | --- |
| 1 · BTC self-custody | `custody_mode: self_custody`, blockchain rail | **MOVEABLE** under dual sanctions |
| 2 · Shenzhen real estate | onshore CN, registered title | **FROZEN** under CN lock & dual |
| 3 · IBKR US ETF (HK user) | CN/HK holder, US custodian | **TRAPPED** under US & dual |

```
$ npm run test:legacy
  ✓ TEST 1 · BTC self-custody → MOVEABLE under dual sanctions
  ✓ TEST 2 · Shenzhen real estate → FROZEN under CN_CAPITAL_LOCK
  ✓ TEST 3 · IBKR US ETF → TRAPPED under US_SANCTION
  ... 12 passed, 0 failed
```

### Reference run — dual blockade (`US_SANCTION + CN_CAPITAL_LOCK`, T7)

```
🔴 FROZEN   surv=0.088  escape=-90d   Shenzhen residential real estate
🔴 FROZEN   surv=0.151  escape=-0.5d  RMB demand deposit at ICBC (mainland)
🟡 TRAPPED  surv=0.512  escape=-1d    iShares IVV (US ETF) at IBKR — HK resident
🟡 TRAPPED  surv=0.512  escape=-1d    US Treasury bond at IBKR — HK resident
🟢 MOVEABLE surv=0.73   escape=0.9d   USDT on Binance (custodied exchange balance)
🟢 MOVEABLE surv=1.0    escape=∞      BTC — self-custody (hardware wallet)
🟢 MOVEABLE surv=1.0    escape=∞      Physical gold — bearer (HK private vault)
```

The engine reproduces the correct dual-sovereignty behavior: **US-only** traps the US custody chain but leaves onshore RMB/property untouched; **CN-only** freezes onshore assets but cannot reach the offshore brokerage; **dual** is the union of both, and only bearer / self-custodied assets survive.

---

## Financial Kill-Chain (v3.3)

A companion engine (`engine/terrain/`, viewer `terrain.html`) models financial war along a **settlement → custody → asset** kill chain. The conceptual shift (spec §8): don't ask *"where does the asset trade?"* — ask *"who ultimately holds the kill switch?"*. The true objects of simulation are **settlement networks** (DTCC/DTC/CHIPS/SWIFT · CDP/CCASS/CNSDC/CIPS) and **ultimate custodians** (State Street, BNY Mellon, HSBC, SelfCustody, PhysicalPossession) — never the listing label.

Every holding is an [`Asset`](engine/terrain/portfolio.js) with three core axes + the deep kill-chain layers:

| Axis | Field | Enum |
| --- | --- | --- |
| **A · Settlement system** | `settlementSystem` | `US_Settlement · Singapore_Settlement · HongKong_Settlement · China_Settlement · Decentralized_Settlement · Issuer_Crypto_Settlement · Physical_Gold_Settlement · Real_Estate_Settlement` |
| **B · Custody jurisdiction** | `custodyJurisdiction` | `US · Singapore · HongKong · China · NoCustody · DMCC_Dubai` |
| **C · Asset class** | `assetClass` | `Equity · ETF · Cash · PhysicalGold · RealEstate · Crypto` |

Deep layers: `settlementNetwork[]` (the actual rails — `DTCC · DTC · CHIPS · Fedwire · SWIFT · CDP · MEPS+ · PayNow · CCASS · FPS · CNSDC · CIPS · Bitcoin · Ethereum · TRON · Physical`), `ultimateCustodian`, `beneficialOwnershipModel` (`direct_register · custodian · nominee · self_custody · bearer`), plus `broker` / `exchange`.

### OFAC dependency engine (spec §3) — replaces naive `CustodyCountry == US`
`ofacDependency` ∈ `HIGH · MEDIUM · LOW · NONE`, computed from **`settlementNetwork` + `ultimateCustodian` only** (never the jurisdiction label):
- **HIGH** — a US rail (`DTCC · DTC · CHIPS · Fedwire`) **or** a US custodian (`State Street · BNY Mellon · JPMorgan · Citibank`).
- **MEDIUM** — USD-correspondent exposure (`SWIFT`, or a custodian like HSBC / Standard Chartered).
- **NONE** — no compellable US-reachable intermediary (decentralized / physical rail **and** self / physical custody).
- **LOW** — foreign rails/custodian inside the regulated system (everything else).

> This is the whole point: **O87** and **S27** list on SGX and look Singaporean, but clear via `DTC`/`CHIPS` at **State Street** → `ofacDependency: HIGH`. **D05** trades on the *same exchange* yet stays `LOW` (CDP/MEPS+/PayNow, custodian CDP). **BTC** (self-custody) and **physical gold** (bearer) are `NONE`. *Not where it trades — who holds the kill switch.*

### Kill-chain priority (spec §5)
`SettlementNetwork → UltimateCustodian → BeneficialOwnershipModel → Broker → Exchange → Jurisdiction → (only then) CustodyCountry label`. Wars attack the rail and the custodian first; the listing label is the *least* significant signal.

### Output — `WarPath` (spec §4) + the aggregate graph
Each asset yields a [`WarPath`](engine/terrain/risk_engine.js): `{ ofacDependency, capitalControlExposure (0–100, CN lock), taxTransparencyExposure (0–100, CRS), settlementNetwork, ultimateCustodian, … }`. The engine answers the §4 scenario questions directly:
- `assetsKilledBySanction(["DTCC","CHIPS"])` → **O87, S27, SGOV** (their settlement is cut).
- `jurisdictionTrapsUnderCapitalControl()` → **HongKong**.
- `assetsVisibleUnderCRS()` → the regulated book (everything except self-custody / bearer).

`buildExposureGraph()` aggregates them into `ofac_distribution`, a `kill_chain_risk_map` (the dangerous rails / custodians / asset classes), and `dependency_edges` (`asset → custodian → settlement`).

### Migration (spec §6 — NO data loss)
`migrateLegacyPosition()` upgrades the old `{ assetType, custodyCountry, broker }` model: `assetClass` + `custodyJurisdiction` are mapped, `settlementSystem` / `ultimateCustodian` / `settlementNetwork` / `beneficialOwnershipModel` default to `Unknown`, `broker` is preserved, and the entire original record is kept verbatim under `_legacy`.

### Two views
- **⛓ Kill-Chain Graph** — a layered ①→②→③ network (settlement network → custodian → asset); red lines trace a freeze path from a sanctioned rail up through the custodian to your asset, while self-custody / physical chains stay green.
- **☁ 3D Exposure Cloud** — each `WarPath` plotted at `(OFAC dependency, CN capital-lock, CRS)`.

### Calibration set (spec §7)
SGX/HK/US assets where the listing label and the real kill chain diverge. `ofac_distribution` is **`{ HIGH: 3, MEDIUM: 1, LOW: 1, NONE: 2 }`** — three SGX/US ETFs are US-cleared (HIGH), the HK Tracker Fund is USD-correspondent (MEDIUM), the pure-SG equity is LOW, and only self-custody BTC + bearer gold escape entirely.

```
$ node engine/terrain/terrain.js          # WarPaths + kill-chain risk map + §4 scenario queries
$ node tests/terrain.test.js              # 43 passed, 0 failed
```

---

## Run it

```bash
# ── FinWar v4 — WorldState service (the FinOS truth layer) ──
npm install
npm run typecheck   # tsc --noEmit (output typed as WorldState)
npm test            # v4 WorldState suite + live finos decide() acceptance
npm run dev         # wrangler dev → POST /simulate · GET /state · GET /health

# ── FinWar v3.2 — legacy survival engine (zero-dependency) ──
npm run test:legacy # node tests/golden.test.js && node tests/terrain.test.js
npm run sim                                   # CLI simulation (default: dual)
node engine/engine.js US_SANCTION CN_CAPITAL_LOCK GLOBAL_COLLAPSE

# Financial Kill-Chain + zero-setup demo (open in a browser)
# live:  https://alexmorerich.github.io/finwar/terrain.html   (GitHub Pages)
open terrain.html   # Kill-Chain Graph · 3D Exposure Cloud (Plotly via CDN)
open demo.html      # self-contained v3.2 dashboard (double-click, offline)
npm run serve       # modular index.html → http://localhost:8080
```

The **v4 service** (`src/`) needs `npm install` (TypeScript + wrangler) and **Node ≥ 20**.
The **v3.2 engine** (`engine/`) and the HTML dashboards stay **zero-dependency** and
fully local-first: `demo.html` inlines the engine + data (no server), while
`index.html` imports `engine/*.js` and `fetch`es `data.json` (needs an HTTP origin).

---

## Design philosophy

> FINWAR is a multi-jurisdiction financial survival physics engine that models capital under dual-sovereignty collapse. It does not tell you what to buy. It tells you what survives when two sovereigns freeze the rails at once — and exactly which link in the chain fails.

**Disclaimer.** Heuristic stress model — *not* investment, legal, or tax advice. Vector severities and custody-resilience values are illustrative and live in `engine/scenario/freeze_vectors.js` and `engine/core/custody.js`; tune them to your own threat model. Scores are scenario stress outputs, not forecasts.
