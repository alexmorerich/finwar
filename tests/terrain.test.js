// FINWAR 3D — risk-engine validation. Zero deps.  node tests/terrain.test.js
import { computePosition, computeFSS, computeCCR, computeTAX } from "../engine/terrain/risk_engine.js";
import { getCountry, getInstitution, getAsset, INSTITUTIONS } from "../engine/terrain/nodes.js";
import { PORTFOLIO } from "../engine/terrain/portfolio.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { fail++; console.log(`  \x1b[31m✗ ${name}\x1b[0m${detail ? `  (${detail})` : ""}`); }
}
const near = (a, b, eps = 0.05) => Math.abs(a - b) <= eps;

console.log("\nFINWAR 3D — Sovereign Risk Terrain · test suite\n");

// ── Formula correctness vs hand-computed values ──
{
  const gldm = computePosition({ id: "t", assetType: "Gold", custodyCountry: "US", institution: "IBKR", weight: 0.2 });
  check("GLDM@IBKR  FSS = 80.5", near(gldm.x_OFAC, 80.5), gldm.x_OFAC);
  check("GLDM@IBKR  CCR = 12.0", near(gldm.y_SAFE, 12.0), gldm.y_SAFE);
  check("GLDM@IBKR  TAX = 68.5", near(gldm.z_TAX, 68.5), gldm.z_TAX);
  check("GLDM@IBKR  dominant axis = OFAC", gldm.dominant_axis === "OFAC", gldm.dominant_axis);
  check("GLDM@IBKR  badge = HIGH (US-sanction spike)", gldm.badge === "HIGH", gldm.badge);

  const btc = computePosition({ id: "t", assetType: "Crypto", custodyCountry: "SelfCustody", institution: "CryptoWallet", weight: 0.15 });
  check("ColdWallet BTC  FSS = 21.5", near(btc.x_OFAC, 21.5), btc.x_OFAC);
  check("ColdWallet BTC  CCR = 8.3", near(btc.y_SAFE, 8.3), btc.y_SAFE);
  check("ColdWallet BTC  TAX = 12.8", near(btc.z_TAX, 12.8), btc.z_TAX);
  check("ColdWallet BTC  badge = LOW (escapes all axes)", btc.badge === "LOW", btc.badge);
}

// ── Cash vs Equity conditional weights ──
{
  const c = getCountry("Singapore"), i = getInstitution("DBS");
  check("Cash drives CCR conditional (+80×0.2)",
    near(computeCCR(c, i, "Cash") - computeCCR(c, i, "Gold"), 0.2 * (80 - 20)));
  check("Equity drives TAX conditional (+70×0.2)",
    near(computeTAX(c, i, "Equity") - computeTAX(c, i, "Gold"), 0.2 * (70 - 30)));
}

// ── Portfolio integrity ──
{
  const sum = PORTFOLIO.reduce((s, p) => s + p.weight, 0);
  check("portfolio weights sum to 1.0", near(sum, 1.0, 0.0001), sum);
  const consistent = PORTFOLIO.every((p) => INSTITUTIONS[p.institution].country === p.custodyCountry);
  check("every position: institution.country === custodyCountry", consistent);
  const inRange = PORTFOLIO.map(computePosition).every(
    (p) => [p.x_OFAC, p.y_SAFE, p.z_TAX, p.height].every((v) => v >= 0 && v <= 100));
  check("all axis values within 0–100", inRange);
}

// ── Story checks — the 3D map must reveal the real exposure ──
{
  const cloud = PORTFOLIO.map(computePosition);
  const byId = Object.fromEntries(cloud.map((p) => [p.id, p]));
  const maxFSS = cloud.reduce((a, b) => (b.x_OFAC > a.x_OFAC ? b : a));
  check("highest OFAC exposure is the IBKR GLDM position", maxId(cloud, "x_OFAC") === "ibkr_gldm", maxFSS.id);
  const minHeight = cloud.reduce((a, b) => (b.height < a.height ? b : a));
  check("lowest composite risk is a cold-wallet position", minHeight.id.startsWith("cw_"), minHeight.id);
  check("cold wallet sits below offshore banks on every axis",
    byId.cw_btc.height < byId.hsbc_cash.height && byId.cw_btc.z_TAX < byId.dbs_cash.z_TAX);
}

function maxId(cloud, k) { return cloud.reduce((a, b) => (b[k] > a[k] ? b : a)).id; }

console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
