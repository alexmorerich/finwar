// FINWAR v4.0 — Asset Coordinate Engine (the exposure → coordinate core).
//
// Pure & deterministic: no clock, no randomness, no I/O. The same AssetNode always
// maps to the same (x,y,z). Nothing here recommends, allocates, weights a
// portfolio, or optimizes — it ONLY locates an asset inside OFAC–SAFE–CRS space.
//
//   AssetNode { settlement_system, custody_jurisdiction, ownership_model, asset_class }
//        │
//        ▼  calculateExposure()   — priority-weighted fuse of the 4 layers
//   Exposure { OFAC, SAFE, CRS }   — each normalized 0.0 … 1.0
//        │
//        ▼  toVector()
//   AssetVector { x:OFAC, y:SAFE, z:CRS }   — one point in 3D space

import {
  LAYER_PRIORITY,
  getSettlement,
  getJurisdiction,
  getOwnership,
  getAssetClass,
} from "./layers.js";

const round3 = (x) => Math.round(x * 1000) / 1000;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Resolve an AssetNode to its four layer records (tolerant — never throws).
function layersOf(asset) {
  return {
    settlement_system:    getSettlement(asset.settlement_system),
    custody_jurisdiction: getJurisdiction(asset.custody_jurisdiction),
    ownership_model:      getOwnership(asset.ownership_model),
    asset_class:          getAssetClass(asset.asset_class),
  };
}

// Priority-weighted fuse of one axis (0–100 layer scores → 0–1 exposure).
// Settlement System dominates (0.40); Asset Class is a nudge (0.10).
function fuseAxis(L, axis) {
  const raw =
    LAYER_PRIORITY.settlement_system    * L.settlement_system[axis] +
    LAYER_PRIORITY.custody_jurisdiction * L.custody_jurisdiction[axis] +
    LAYER_PRIORITY.ownership_model      * L.ownership_model[axis] +
    LAYER_PRIORITY.asset_class          * L.asset_class[axis];
  return round3(clamp01(raw / 100));
}

// ─────────────────── calculateExposure(asset) → { OFAC, SAFE, CRS } (0–1) ───────────────────
export function calculateExposure(asset) {
  const L = layersOf(asset);
  return {
    OFAC: fuseAxis(L, "ofac"),
    SAFE: fuseAxis(L, "safe"),
    CRS:  fuseAxis(L, "crs"),
  };
}

// ─────────────────── toVector(asset) → { x, y, z } ───────────────────
// x = OFAC · y = SAFE · z = CRS. Every asset becomes one point in 3D space.
export function toVector(asset) {
  const e = calculateExposure(asset);
  return { x: e.OFAC, y: e.SAFE, z: e.CRS };
}

// Exposure weight = the magnitude of the (x,y,z) vector, normalized to 0–1
// (distance from the safe origin, ÷√3). This is a property of the asset's OWN
// coordinate — it is NOT a portfolio allocation or percentage weight. Drives the
// bubble size on the 3D terrain map (spec Panel 6).
const SQRT3 = Math.sqrt(3);
export function exposureWeight(asset) {
  const { x, y, z } = toVector(asset);
  return round3(Math.sqrt(x * x + y * y + z * z) / SQRT3);
}

// ─────────────────── assetCoordinate(asset) — the full per-asset bundle ───────────────────
// Everything the six UI panels need for one asset, in one deterministic object.
export function assetCoordinate(asset) {
  const exposure = calculateExposure(asset);
  const vector = { x: exposure.OFAC, y: exposure.SAFE, z: exposure.CRS };
  return {
    id: asset.id,
    label: asset.label || asset.id,
    note: asset.note || null,
    // the four input coordinates (echoed for the layer panels)
    settlement_system:    asset.settlement_system,
    custody_jurisdiction: asset.custody_jurisdiction,
    ownership_model:      asset.ownership_model,
    asset_class:          asset.asset_class,
    // the computed outputs
    exposure,                                  // { OFAC, SAFE, CRS } 0–1
    vector,                                    // { x, y, z }
    exposure_weight: exposureWeight(asset),    // 0–1 magnitude (NOT allocation)
  };
}

// Batch helper — map a list of AssetNodes to their coordinate bundles.
export function mapAssets(assets) {
  return assets.map(assetCoordinate);
}
