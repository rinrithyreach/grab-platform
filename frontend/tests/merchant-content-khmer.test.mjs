import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

test("published sample GrabFood products show Khmer when Khmer is selected", async () => {
  const { merchantProductText, merchantProductTitle, merchantBusinessDescription } = await loadLib("merchant-content");
  const english = "Jasmine rice fried with chicken, egg, vegetables and soy.";
  assert.deepEqual(merchantProductText("Chicken Fried Rice", english, "GrabFood", "km"), {
    title: "បាយឆាមាន់",
    description: "បាយម្លិះឆាជាមួយសាច់មាន់ ស៊ុត បន្លែ និងទឹកស៊ីអ៊ីវ។",
  });
  assert.equal(merchantProductTitle("Chicken Fried Rice", "km", "GrabFood"), "បាយឆាមាន់");
  assert.equal(merchantBusinessDescription("Aeon Mart", "Aeon Mart Foods", "GrabFood", "km"), "អាហារពី Aeon Mart");
  assert.deepEqual(merchantProductText("Chicken Fried Rice", english, "GrabFood", "en"), { title: "Chicken Fried Rice", description: english });
  const edited = "A new recipe from this merchant.";
  assert.deepEqual(merchantProductText("Chicken Fried Rice", edited, "GrabFood", "km"), { title: "Chicken Fried Rice", description: edited });
  assert.deepEqual(merchantProductText("Chicken Fried Rice", english, "GrabExpress", "km"), { title: "Chicken Fried Rice", description: english });
});
