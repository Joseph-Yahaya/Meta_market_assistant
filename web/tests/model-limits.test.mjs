import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyCapFor, dailyDateKey, dailyLimitReached, DAILY_CAP_DEFAULTS } from "../src/lib/model-limits.ts";

test("daily caps default and honor valid env overrides", () => {
  assert.equal(dailyCapFor("interpret", {}), DAILY_CAP_DEFAULTS.interpret);
  assert.equal(dailyCapFor("transcribe", {}), DAILY_CAP_DEFAULTS.transcribe);
  assert.equal(dailyCapFor("buyer-voice", {}), DAILY_CAP_DEFAULTS["buyer-voice"]);
  assert.equal(dailyCapFor("buyer-ai", {}), DAILY_CAP_DEFAULTS["buyer-ai"]);
  assert.equal(dailyCapFor("image", {}), DAILY_CAP_DEFAULTS.image);
  assert.equal(dailyCapFor("routing", {}), DAILY_CAP_DEFAULTS.routing);
  assert.equal(dailyCapFor("global", {}), DAILY_CAP_DEFAULTS.global);
  assert.equal(dailyCapFor("interpret", { MODEL_DAILY_CAP_INTERPRET: "5" }), 5);
  assert.equal(dailyCapFor("image", { MODEL_DAILY_CAP_IMAGE: "7" }), 7);
  assert.equal(dailyCapFor("routing", { MODEL_DAILY_CAP_ROUTING: "9" }), 9);
  assert.equal(dailyCapFor("routing", { MODEL_DAILY_CAP_ROUTING: "abc" }), DAILY_CAP_DEFAULTS.routing);
  assert.equal(dailyCapFor("global", { MODEL_DAILY_CAP_GLOBAL: "10" }), 10);
});

test("daily caps reject invalid env values", () => {
  for (const raw of ["0", "-3", "1.5", "abc", "100001", "100abc", "", "   ", "1e3", "5 packs", "0x10"]) {
    assert.equal(dailyCapFor("interpret", { MODEL_DAILY_CAP_INTERPRET: raw }), DAILY_CAP_DEFAULTS.interpret);
  }
  assert.equal(dailyCapFor("interpret", { MODEL_DAILY_CAP_INTERPRET: " 5 " }), 5);
});

test("daily keys are UTC dates and limits trip only above the cap", () => {
  assert.equal(dailyDateKey(new Date("2026-11-05T02:30:00Z")), "2026-11-05");
  assert.equal(dailyLimitReached(100, 100), false);
  assert.equal(dailyLimitReached(101, 100), true);
});
