import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVoiceKeywords, VOICE_ACTION_WORDS, VOICE_KEYWORD_LIMIT } from "../src/lib/voice-keywords.ts";
import { cleanEntryText, likelyAction, applyActionPreset } from "../src/lib/entry-text.ts";
import { normaliseVolume, trimSilence } from "../src/lib/audio.ts";
import { planUndo, UNDO_WINDOW_SECONDS } from "../src/lib/undo.ts";
import { createMetaClient } from "../src/lib/meta-client.ts";

test("voice keywords lead with action words, dedupe and stay capped", () => {
  const keywords = buildVoiceKeywords(["Indomie", "indomie", "Dangote"], ["Noodles", "noodles", "x".repeat(41), "  "]);
  assert.deepEqual(keywords.slice(0, VOICE_ACTION_WORDS.length), VOICE_ACTION_WORDS);
  assert.ok(keywords.includes("Indomie") && keywords.includes("Dangote") && keywords.includes("Noodles"));
  assert.equal(keywords.filter((w) => w.toLowerCase() === "indomie").length, 1);
  assert.ok(!keywords.some((w) => w.length > 40));
  const many = buildVoiceKeywords(Array.from({ length: 200 }, (_, i) => `brand${i}`), []);
  assert.equal(many.length, VOICE_KEYWORD_LIMIT);
});

test("transcription sends language bias and catalog keywords", async () => {
  const client = createMetaClient({ key: "test-only" }, async (url, options) => {
    const settings = JSON.parse(await options.body.get("request").text());
    assert.deepEqual(settings.languageBias, ["English"]);
    assert.deepEqual(settings.keywords, ["sale", "Indomie"]);
    return Response.json({ transcript: "sold three packs" });
  });
  assert.equal(await client.transcribe(new Uint8Array([1, 2, 3]), { keywords: ["sale", "Indomie"] }), "sold three packs");
});

const sine = (n, amp) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / 24000) * amp);
const peakOf = (s) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test("quiet recordings are normalised; loud and near-silent audio is untouched", () => {
  const quiet = sine(2400, 0.1);
  assert.ok(Math.abs(peakOf(normaliseVolume(quiet)) - 0.89) < 0.01);
  const loud = sine(2400, 0.95);
  assert.strictEqual(normaliseVolume(loud), loud);
  const faint = sine(2400, 0.001);
  assert.strictEqual(normaliseVolume(faint), faint);
});

test("leading and trailing silence is trimmed with a margin", () => {
  const clip = new Float32Array(9600);
  clip.set(sine(4800, 0.5), 2400);
  const trimmed = trimSilence(clip, 24000, 50);
  assert.equal(trimmed.length, 7200);
  assert.ok(peakOf(trimmed) > 0.4);
  assert.equal(trimSilence(new Float32Array(2400)).length, 0);
  const speech = sine(4800, 0.5);
  assert.equal(trimSilence(speech, 24000, 0).length, 4800);
});

test("filler words are stripped and today is noticed without changing the record", () => {
  assert.deepEqual(cleanEntryText("Please I sold three packs today"), { text: "I sold three packs", saidToday: true });
  assert.deepEqual(cleanEntryText("Abeg, um restock Indomie"), { text: "restock Indomie", saidToday: false });
  assert.deepEqual(cleanEntryText("sold 2 cartons"), { text: "sold 2 cartons", saidToday: false });
});

test("likely mishearings only suggest sale or restock, never decide", () => {
  assert.deepEqual(likelyAction("I saw three Indomie"), { action: "sale", heard: "saw" });
  assert.deepEqual(likelyAction("we stock don finish"), { action: "restock", heard: "we stock" });
  assert.deepEqual(likelyAction("restocked five Milo"), { action: "restock", heard: "restocked" });
  assert.deepEqual(likelyAction("I saw the restock"), { action: "restock", heard: "restock" });
  assert.equal(likelyAction("three Indomie packs"), null);
});

test("a tapped action preset fills a gap but reports a conflict", () => {
  assert.deepEqual(applyActionPreset(null, "sale"), { action: "sale", conflict: null });
  assert.deepEqual(applyActionPreset("sale", "sale"), { action: "sale", conflict: null });
  assert.deepEqual(applyActionPreset("restock", "sale"), { action: "sale", conflict: "restock" });
});

test("undo plans per-batch recounts restoring pre-command estimates", () => {
  assert.equal(UNDO_WINDOW_SECONDS, 60);
  assert.deepEqual(planUndo([{ id: "e1", batchId: "b1", delta: -3 }], { b1: 5 }), [
    { batchId: "b1", quantity: 8, correctsEventId: "e1" },
  ]);
  assert.deepEqual(
    planUndo(
      [
        { id: "e1", batchId: "b1", delta: -2 },
        { id: "e2", batchId: "b2", delta: -1 },
      ],
      { b1: 0, b2: 4 },
    ),
    [
      { batchId: "b1", quantity: 2, correctsEventId: "e1" },
      { batchId: "b2", quantity: 5, correctsEventId: "e2" },
    ],
  );
  assert.deepEqual(planUndo([{ id: "e1", batchId: "b1", delta: 4 }], { b1: 9 }), [
    { batchId: "b1", quantity: 5, correctsEventId: "e1" },
  ]);
  assert.throws(() => planUndo([], { b1: 5 }), /UNDO_BLOCKED/);
  assert.throws(() => planUndo([{ id: "e1", batchId: "b9", delta: -1 }], { b1: 5 }), /UNDO_BLOCKED/);
  assert.throws(() => planUndo([{ id: "e1", batchId: "b1", delta: 4 }], { b1: 2 }), /UNDO_BLOCKED/);
});
