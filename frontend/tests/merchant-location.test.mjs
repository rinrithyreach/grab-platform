import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { PHNOM_PENH_DISTRICTS } = await loadLib("phnom-penh");
const { manualRideLocation, rideLocationSelection, deviceRideLocation, readDeviceRideLocation, getDeviceLocation, DeviceLocationError } = await loadLib("merchant-location", "phnom-penh");

test("Phnom Penh contains all 14 districts and 105 distinct sangkats with matching parent codes", () => {
  assert.equal(PHNOM_PENH_DISTRICTS.length, 14);
  const sangkats = PHNOM_PENH_DISTRICTS.flatMap((district) => district.sangkats);
  assert.equal(sangkats.length, 105);
  assert.equal(new Set(sangkats.map((item) => item.code)).size, 105);
  for (const district of PHNOM_PENH_DISTRICTS) {
    assert.ok(district.name && district.km && district.sangkats.length);
    assert.ok(district.sangkats.every((item) => item.code.startsWith(district.code) && item.name && item.km));
    for (const sangkat of district.sangkats)
      assert.deepEqual(rideLocationSelection(manualRideLocation(district.code, sangkat.code)), { districtCode: district.code, sangkatCode: sangkat.code });
  }
});

test("a location is complete only after a valid sangkat belonging to the selected district", () => {
  assert.equal(manualRideLocation("1201", "120101"), "Tonle Basak, Khan Chamkar Mon, Phnom Penh");
  for (const [district, sangkat] of [["", ""], ["1201", ""], ["invalid", "120101"], ["1213", "120101"]])
    assert.equal(manualRideLocation(district, sangkat), "");
  assert.deepEqual(rideLocationSelection("Existing saved address"), { districtCode: "", sangkatCode: "" });
});

test("device coordinates are bounded, formatted consistently and can be restored after saving", () => {
  assert.equal(deviceRideLocation({ latitude: 11.55643217, longitude: 104.92821234 }), "GPS: 11.556432, 104.928212");
  assert.deepEqual(readDeviceRideLocation("GPS: 11.556432, 104.928212"), { latitude: 11.556432, longitude: 104.928212 });
  assert.equal(deviceRideLocation({ latitude: 0, longitude: 0 }), "GPS: 0.000000, 0.000000");
  for (const value of ["Phnom Penh", "GPS: NaN, 104.9", "GPS: 91, 100", "GPS: 11, 181", "GPS: 11, 104 trailing"])
    assert.equal(readDeviceRideLocation(value), null);
  assert.equal(deviceRideLocation({ latitude: Infinity, longitude: 104 }), "");
});

test("device detection requests fresh high-accuracy coordinates and retains accuracy", async () => {
  let calls = 0;
  const location = await getDeviceLocation({ getCurrentPosition(success, _failure, options) {
    calls++;
    assert.deepEqual(options, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    success({ coords: { latitude: 11.56, longitude: 104.92, accuracy: 12 } });
  } }, true);
  assert.equal(calls, 1);
  assert.deepEqual(location, { latitude: 11.56, longitude: 104.92, accuracy: 12 });
});

test("denied, unavailable, timed out, unsupported and insecure location requests have distinct failures", async () => {
  for (const [code, reason] of [[1, "permission"], [2, "unavailable"], [3, "timeout"]])
    await assert.rejects(getDeviceLocation({ getCurrentPosition(_success, failure) { failure({ code }); } }, true),
      (error) => error instanceof DeviceLocationError && error.reason === reason);
  await assert.rejects(getDeviceLocation(undefined, true), (error) => error.reason === "unsupported");
  await assert.rejects(getDeviceLocation({ getCurrentPosition() { assert.fail("Do not request location on an insecure page"); } }, false), (error) => error.reason === "insecure");
  await assert.rejects(getDeviceLocation({ getCurrentPosition(success) { success({ coords: { latitude: NaN, longitude: 104, accuracy: 3 } }); } }, true), (error) => error.reason === "unavailable");
});
