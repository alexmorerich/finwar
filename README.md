# 🧠 FINWAR v3.2 — Geopolitical War Engine

> A **multi-jurisdiction financial survival physics engine**. It models what happens to capital under **simultaneous US sanctions and Chinese capital controls** — dual-sovereignty collapse — at the level of the **custody chain**, not the asset label.

FINWAR is **not** a portfolio optimizer and **not** a scoring system. It simulates *asset survival* when more than one sovereign attacks the financial rails at the same time.

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
├── index.html                      v3.2 UI — scenario toggles, phase selector, survival dashboard
├── demo.html                       self-contained v3.2 dashboard (double-click, offline)
├── terrain.html                    3D Sovereign Risk Terrain — Risk Terrain / Battle Map / Point Cloud
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
│   └── terrain/                    3D sovereign-risk terrain engine
│       ├── nodes.js                country / institution / asset reference scores
│       ├── risk_engine.js          FSS (OFAC) · CCR (SAFE) · TAX (CRS) + point cloud
│       ├── portfolio.js            the holder's AssetPosition[] (editable)
│       └── terrain.js              CLI → point cloud + risk table
│
└── tests/
    ├── golden.test.js              3 mandatory v3.2 golden cases (§9)
    └── terrain.test.js             3D risk-engine validation (17 checks)
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
$ npm test
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

## 3D Sovereign Risk Terrain

A companion engine (`engine/terrain/`, viewer `terrain.html`) projects a real portfolio into **three sovereign-risk axes** and renders it as a navigable 3D landscape.

| Axis | Force | Driver |
| --- | --- | --- |
| **X · FSS** | US financial sanctions (OFAC) | custody / venue / rail / issuer US-exposure |
| **Y · CCR** | China capital controls (SAFE) | holder residency · RMB convertibility · outbound rail |
| **Z · TAX** | CRS / global tax transparency | reporting jurisdiction + CRS exposure |

Every holding is a 4-tuple — `assetType · custodyCountry · institution · weight` — scored against reference `CountryNode` / `InstitutionNode` / `AssetNode` tables:

```
FSS = 0.5·country.sanctionRisk        + 0.3·institution.usExposure    + 0.2·asset.dtccRisk
CCR = 0.5·country.capitalControlRisk  + 0.3·institution.chinaExposure + 0.2·(Cash?80:20)
TAX = 0.5·country.taxTransparencyRisk + 0.3·institution.crsExposure   + 0.2·(Equity?70:30)
height = (FSS + CCR + TAX) / 3
```

> **Self-custody zone.** The spec's four jurisdictions cannot represent a cold wallet — self-custodied keys belong to no custody jurisdiction — so a fifth `SelfCustody` zone is added, low on every axis. This is why BTC / USDT / USDC / XAUT land in the safe valley instead of being force-fit into a hostile jurisdiction.

### Two display modes (+ a point cloud)
- **🌋 Risk Terrain** — jet-colormap surface; warm peaks = where capital piles risk, cyan valley = self-custody escape zone.
- **🗺 Battle Map** — grayscale relief board; snow plains = safe ground, dark ridges = hostile high-risk terrain, with topographic contour lines.
- **☁ Point Cloud** — spec §6: each holding plotted at `(FSS, CCR, TAX)`, marker size = weight, colour = worst-axis badge.

The surface is an additive Gaussian field over the OFAC×SAFE plane — risky clusters stack into peaks, the co-located cold-wallet positions sink a deep safe basin. Elevation is switchable (worst axis · composite · any single axis).

### Modeled portfolio
China-mainland tax resident / Chinese national: IBKR **GLDM** (paper gold, US-cleared), Singapore **DBS / OCBC / SC**, Hong Kong **HSBC / SC / BOCHK / Futu**, and a **cold wallet** (BTC / XAUT / USDT / USDC). The terrain's lesson is sharp: the dominant exposure is **CRS tax-transparency** (nearly the whole offshore book is reportable to China), the single sharpest spike is **GLDM on the OFAC axis (80.5)**, and the only low ground is **self-custody**.

```
$ node engine/terrain/terrain.js          # point cloud + risk table
$ node tests/terrain.test.js              # 17 passed, 0 failed
```

---

## Run it

```bash
# Zero-setup demo — just open the file in a browser (self-contained, offline)
open demo.html      # macOS · or double-click demo.html

# 3D Sovereign Risk Terrain (Plotly via CDN — needs internet for the chart lib)
open terrain.html   # Risk Terrain · Battle Map · Point Cloud

# Golden tests + 3D risk-engine tests (zero dependencies)
npm test            # node tests/golden.test.js && node tests/terrain.test.js

# CLI simulation (pass any scenarios)
npm run sim                                   # default: dual
node engine/engine.js US_SANCTION
node engine/engine.js US_SANCTION CN_CAPITAL_LOCK GLOBAL_COLLAPSE

# Modular UI — local-first dashboard (needs an HTTP origin for ES modules + fetch)
npm run serve       # python3 -m http.server 8080
# → open http://localhost:8080
```

`demo.html` is a single self-contained file (engine + data inlined) you can open
directly from disk — no server, no build. `index.html` is the modular version
that imports `engine/*.js` and `fetch`es `data.json`, so it needs an HTTP origin.

Requires **Node ≥ 18**. No build step, no npm dependencies — fully local-first.

---

## Design philosophy

> FINWAR is a multi-jurisdiction financial survival physics engine that models capital under dual-sovereignty collapse. It does not tell you what to buy. It tells you what survives when two sovereigns freeze the rails at once — and exactly which link in the chain fails.

**Disclaimer.** Heuristic stress model — *not* investment, legal, or tax advice. Vector severities and custody-resilience values are illustrative and live in `engine/scenario/freeze_vectors.js` and `engine/core/custody.js`; tune them to your own threat model. Scores are scenario stress outputs, not forecasts.
