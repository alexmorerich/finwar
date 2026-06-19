// FINWAR 3D — CLI. Prints the spec §6 point cloud + a portfolio risk table.
//   node engine/terrain/terrain.js
import { computePointCloud, portfolioCentroid } from "./risk_engine.js";
import { PORTFOLIO } from "./portfolio.js";

export function buildTerrain(positions = PORTFOLIO) {
  const cloud = computePointCloud(positions);
  return { point_cloud: cloud, centroid: portfolioCentroid(cloud) };
}

const isMain = (() => {
  try { return import.meta.url === `file://${process.argv[1]}`; } catch { return false; }
})();

if (isMain) {
  const { point_cloud, centroid } = buildTerrain();
  console.log("\nFINWAR 3D — Sovereign Risk Terrain\n");
  console.log("  badge      X·OFAC  Y·SAFE  Z·TAX   height  wt    dominant        position");
  console.log("  " + "─".repeat(92));
  for (const p of [...point_cloud].sort((a, b) => b.height - a.height)) {
    console.log(
      `  ${p.emoji} ${p.badge.padEnd(8)} ` +
        `${String(p.x_OFAC).padStart(5)}  ${String(p.y_SAFE).padStart(5)}  ` +
        `${String(p.z_TAX).padStart(5)}   ${String(p.height).padStart(5)}  ` +
        `${(p.weight * 100).toFixed(0).padStart(3)}%  ${(p.dominant_axis + "·" + p.dominant_value).padEnd(13)} ${p.label}`,
    );
  }
  console.log("  " + "─".repeat(92));
  console.log(
    `  portfolio centroid →  X·OFAC ${centroid.x_OFAC}  Y·SAFE ${centroid.y_SAFE}  ` +
      `Z·TAX ${centroid.z_TAX}  height ${centroid.height}\n`,
  );
  console.log(JSON.stringify(point_cloud, null, 2));
  console.log("");
}
