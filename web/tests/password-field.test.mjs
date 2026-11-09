import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldHideAfterBlur } from "../src/lib/password-field.ts";

test("a revealed password hides only after more than a minute away", () => {
  assert.equal(shouldHideAfterBlur(null, 100000), false);
  assert.equal(shouldHideAfterBlur(100000, 100000 + 59000), false);
  assert.equal(shouldHideAfterBlur(100000, 100000 + 60000), false);
  assert.equal(shouldHideAfterBlur(100000, 100000 + 60001), true);
  assert.equal(shouldHideAfterBlur(100000, 100000 + 5000, 4000), true);
});
