import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

// Public administrative data only; no merchant addresses are sent to a geocoder.
const source = "https://data.mef.gov.kh/api/v1/public-datasets/pd_66c2f89949eb6c00013c1385/file";
async function download() {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Boundary download failed: ${response.status}`);
  return response.json();
}
const geo = process.argv[2] ? JSON.parse(await readFile(process.argv[2], "utf8")) : await download();
const names = await readFile(new URL("../lib/phnom-penh.ts", import.meta.url), "utf8");
const districts = JSON.parse(names.match(/export const PHNOM_PENH_DISTRICTS[^=]+=(\s*\[[\s\S]+\]);/)[1]);
const features = geo.features.filter((feature) => feature.properties.ADM1_PCODE === "KH12");
assert.ok(features.length > 80, "Expected Phnom Penh commune boundaries");
const normalize = (name) => (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const code = (feature) => feature.properties.ADM3_PCODE.replace(/^KH/, "");
function centre(rows) {
  let area = 0, x = 0, y = 0;
  for (const feature of new Set(rows)) {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const [ring] of polygons) {
      let sum = 0, cx = 0, cy = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [a, b] = [ring[i], ring[i + 1]];
        const weight = a[0] * b[1] - b[0] * a[1];
        sum += weight; cx += (a[0] + b[0]) * weight; cy += (a[1] + b[1]) * weight;
      }
      if (!sum) continue;
      const weight = Math.abs(sum);
      area += weight; x += cx / (3 * sum) * weight; y += cy / (3 * sum) * weight;
    }
  }
  assert.ok(area > 0, "Area must have a valid polygon");
  return [Number((y / area).toFixed(6)), Number((x / area).toFixed(6))];
}
const result = { sangkats: {}, districts: {}, city: centre(features) };
for (const district of districts) {
  const matched = [];
  for (const sangkat of district.sangkats) {
    const normalized = normalize(sangkat.name);
    const sameName = features.filter((feature) => normalize(feature.properties.ADM3_EN) === normalized);
    const feature = features.find((item) => code(item) === sangkat.code && normalize(item.properties.ADM3_EN) === normalized)
      ?? (sameName.length === 1 ? sameName[0] : null);
    if (feature) { result.sangkats[sangkat.code] = centre([feature]); matched.push(feature); }
  }
  // Newly split sangkats use the broader district, never an invented precise pin.
  const fallback = matched.length < district.sangkats.length
    ? features.filter((feature) => feature.properties.ADM2_PCODE === `KH${district.code}`) : [];
  result.districts[district.code] = centre([...matched, ...fallback]);
}
assert.equal(Object.keys(result.districts).length, 14);
const formatted = JSON.stringify(result, null, 2).replace(/\[\n\s+(-?[\d.]+),\n\s+(-?[\d.]+)\n\s+\]/g, "[$1, $2]");
await writeFile(new URL("../lib/merchant-area-centres.ts", import.meta.url), `/** Approximate area centres from MEF/OCHA commune boundaries (2018 geometry).
 * Source: https://data.mef.gov.kh/datasets/pd_66c2f89949eb6c00013c1385
 * Names/codes follow the bundled NCDD gazetteer. New sangkats without matching
 * geometry fall back to their district centre. Refresh: node scripts/update-merchant-area-centres.mjs
 */
export const MERCHANT_AREA_CENTRES: {
  sangkats: Record<string, [number, number]>; districts: Record<string, [number, number]>; city: [number, number];
} = ${formatted};
`);
console.log(`Saved ${Object.keys(result.sangkats).length} sangkat centres and all 14 district centres; remaining sangkats use district approximations.`);
