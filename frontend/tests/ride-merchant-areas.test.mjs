import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { loadLibGroup } from "./load-lib.mjs";

const modules = await loadLibGroup("ride-merchant-areas", "merchant-location", "merchant-area-centres", "phnom-penh");
const { rideMerchantMapArea, groupRideMerchantAreas, rideMerchantPopup } = modules["ride-merchant-areas"];
const { PHNOM_PENH_DISTRICTS } = modules["phnom-penh"];
const { manualRideLocation } = modules["merchant-location"];
const merchant = { id: "rider", name: "Dara", address: "", openingHours: "Mon 08:00-17:00" };

test("registered GPS points retain their coordinates and all 105 manual sangkats have an approximate map area", () => {
  const gps = rideMerchantMapArea({ ...merchant, address: "GPS: 11.556432, 104.928212" });
  assert.deepEqual(gps.position, [11.556432, 104.928212]);
  assert.equal(gps.approximate, false);
  for (const district of PHNOM_PENH_DISTRICTS) for (const sangkat of district.sangkats) {
    const area = rideMerchantMapArea({ ...merchant, address: manualRideLocation(district.code, sangkat.code) });
    assert.ok(area, sangkat.name);
    assert.equal(area.approximate, true);
    assert.ok(area.position[0] > 11 && area.position[0] < 12.5, sangkat.name);
    assert.ok(area.position[1] > 104 && area.position[1] < 106, sangkat.name);
  }
  assert.ok(rideMerchantMapArea({ ...merchant, address: "Phnom Penh" }).approximate);
  assert.equal(rideMerchantMapArea({ ...merchant, address: "Unknown address" }), null);
  assert.equal(rideMerchantMapArea({ ...merchant, address: "GPS: 91, 104" }), null);
});

test("merchants sharing an area are grouped without losing any names or working hours", () => {
  const first = rideMerchantMapArea({ ...merchant, address: "GPS: 11.55, 104.92" });
  const second = { ...first, id: "second", name: "Sok", openingHours: "Sun 18:00-02:00" };
  const third = rideMerchantMapArea({ ...merchant, id: "third", address: "GPS: 11.56, 104.93" });
  const groups = groupRideMerchantAreas([first, second, third]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].merchants.map((row) => row.name), ["Dara", "Sok"]);
  assert.equal(groups[0].merchants[1].openingHours, "Sun 18:00-02:00");
});

test("map popups display merchant content as plain text and show unset hours", () => {
  const dom = new JSDOM();
  const previous = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const area = { ...merchant, name: '<img src=x onerror="alert(1)">', address: "<script>bad()</script>", openingHours: "", position: [11.55, 104.92], approximate: true };
    const popup = rideMerchantPopup(area, { location: "Area", hours: "Working hours", noHours: "Not set" });
    assert.equal(popup.querySelector("img,script"), null);
    assert.ok(popup.textContent.includes(area.name));
    assert.ok(popup.textContent.includes(area.address));
    assert.ok(popup.textContent.includes("Working hours: Not set"));
  } finally { globalThis.document = previous; dom.window.close(); }
});
