import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

// Refresh the local picker from the official NCDD gazetteer; never fetch it at runtime.
const source = "https://db.ncdd.gov.kh/gazetteer/view/province.castle?pv=12";
function plain(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/\s+/g, " ").trim();
}
async function rows(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`NCDD request failed: ${response.status}`);
  return [...(await response.text()).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => plain(cell[1])));
}
const provinceRows = (await rows(source)).filter((row) => /^12\d{2}$/.test(row[1]));
assert.equal(provinceRows.length, 14, "Review changed district boundaries before updating the picker.");
const districts = [];
for (let offset = 0; offset < provinceRows.length; offset += 4) {
  districts.push(...await Promise.all(provinceRows.slice(offset, offset + 4).map(async (row) => {
    const code = row[1];
    const sangkats = (await rows(`https://db.ncdd.gov.kh/gazetteer/view/district.castle?ds=${code}`))
      .filter((child) => /^12\d{4}$/.test(child[1])).map((child) => ({
        code: child[1], name: child[3].replace(/ Sangkat$/, ""), km: child[2].replace(/^សង្កាត់/, "").trim(),
      }));
    assert.equal(sangkats.length, Number(row[5]), `Incomplete sangkat list for ${code}`);
    assert.ok(sangkats.every((sangkat) => sangkat.code.startsWith(code)));
    return { code, name: row[3].replace(/ Khan$/, ""), km: row[2].replace(/^ខណ្ឌ/, "").trim(), sangkats };
  })));
}
const count = districts.reduce((total, district) => total + district.sangkats.length, 0);
assert.equal(count, 105, "Review changed sangkat boundaries before updating the picker.");
assert.equal(new Set(districts.flatMap((district) => district.sangkats.map((s) => s.code))).size, count);
const checkedOn = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
const output = `/** Official NCDD Phnom Penh district/sangkat names and codes.\n * Source: ${source}\n * Each district: https://db.ncdd.gov.kh/gazetteer/view/district.castle?ds={code}\n * Checked: ${checkedOn}. Refresh with node scripts/update-phnom-penh.mjs.\n */\nexport interface Sangkat { code: string; name: string; km: string }\nexport interface PhnomPenhDistrict { code: string; name: string; km: string; sangkats: Sangkat[] }\nexport const PHNOM_PENH_DISTRICTS: PhnomPenhDistrict[] = ${JSON.stringify(districts, null, 2)};\n`;
await writeFile(new URL("../lib/phnom-penh.ts", import.meta.url), output, "utf8");
console.log(`Saved ${districts.length} districts and ${count} sangkats from NCDD.`);
