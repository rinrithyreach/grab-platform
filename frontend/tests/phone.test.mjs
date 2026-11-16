import assert from "node:assert/strict";
import test from "node:test";
import { loadLib } from "./load-lib.mjs";

const { normalizePhoneNumber } = await loadLib("phone");

test("phone login treats Cambodian local and international formats as one account", () => {
  for (const input of ["012345678", "12345678", "012 345 678", "(012) 345-678", "+85512345678", "85512345678", "0085512345678"])
    assert.equal(normalizePhoneNumber(input), "+85512345678");
  assert.equal(normalizePhoneNumber("0123456789"), "+855123456789");
  assert.equal(normalizePhoneNumber("+1 (415) 555-2671"), "+14155552671");
});

test("invalid phone identifiers are rejected before sending a login request", () => {
  for (const input of ["", "123", "abc012345678", "+855012345678", "+855123", "+00012345678", "++85512345678", "+1234567890123456", "012345678\nextra"])
    assert.equal(normalizePhoneNumber(input), null, input);
});
