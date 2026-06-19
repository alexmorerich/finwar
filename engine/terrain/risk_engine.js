// FINWAR 3D — risk engine. Implements the three axis formulas exactly as specified.
import { getCountry, getInstitution, getAsset } from "./nodes.js";

const r1 = (x) => Math.round(x * 10) / 10;

// X · OFAC sanction risk
export function computeFSS(country, inst, asset) {
  return 0.5 * country.sanctionRisk + 0.3 * inst.usExposure + 0.2 * asset.dtccRisk;
}
// Y · SAFE capital-control risk
export function computeCCR(country, inst, assetType) {
  return 0.5 * country.capitalControlRisk + 0.3 * inst.chinaExposure + 0.2 * (assetType === "Cash" ? 80 : 20);
}
// Z · CRS / tax-transparency risk
export function computeTAX(country, inst, assetType) {
  return 0.5 * country.taxTransparencyRisk + 0.3 * inst.crsExposure + 0.2 * (assetType === "Equity" ? 70 : 30);
}

// Badge by the WORST single axis — a spike on any one axis is a real threat even
// if the average is moderate (e.g. GLDM@IBKR: low CCR but extreme OFAC).
export function classifyByMax(v) {
  if (v > 65) return "HIGH";
  if (v >= 45) return "MODERATE";
  return "LOW";
}
export const RISK_EMOJI = { HIGH: "🔴", MODERATE: "🟡", LOW: "🟢" };

// Full per-position computation → point-cloud row (spec §6) + terrain fields (§7).
export function computePosition(pos) {
  const country = getCountry(pos.custodyCountry);
  const inst = getInstitution(pos.institution);
  const asset = getAsset(pos.assetType);

  const FSS = computeFSS(country, inst, asset);
  const CCR = computeCCR(country, inst, pos.assetType);
  const TAX = computeTAX(country, inst, pos.assetType);
  const height = (FSS + CCR + TAX) / 3;

  const axes = [
    { name: "OFAC", value: FSS },
    { name: "SAFE", value: CCR },
    { name: "CRS_TAX", value: TAX },
  ];
  const dominant = axes.reduce((a, b) => (b.value > a.value ? b : a));

  return {
    id: pos.id,
    x_OFAC: r1(FSS),
    y_SAFE: r1(CCR),
    z_TAX: r1(TAX),
    height: r1(height),
    weight: pos.weight,
    dominant_axis: dominant.name,
    dominant_value: r1(dominant.value),
    badge: classifyByMax(dominant.value),
    emoji: RISK_EMOJI[classifyByMax(dominant.value)],
    label: `${pos.custodyCountry} / ${pos.institution} / ${pos.assetType} / ${Math.round(pos.weight * 100)}%`,
  };
}

// Spec §6 — 3D point cloud for the whole portfolio.
export function computePointCloud(positions) {
  return positions.map(computePosition);
}

// Portfolio-weighted risk centroid — where the book sits in (X,Y,Z) risk space.
export function portfolioCentroid(cloud) {
  const w = cloud.reduce((s, p) => s + p.weight, 0) || 1;
  const acc = (k) => r1(cloud.reduce((s, p) => s + p[k] * p.weight, 0) / w);
  return { x_OFAC: acc("x_OFAC"), y_SAFE: acc("y_SAFE"), z_TAX: acc("z_TAX"), height: acc("height") };
}
