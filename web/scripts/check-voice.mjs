// Trader-voice live checks through the real hosted routes.
// Never prints keys, access codes or cookies. Accuracy mode prints only
// expected-vs-got action/quantity/item for the owner's own test recordings.
//
// Single recording (transcription smoke):
//   node --env-file-if-exists=.env.local scripts/check-voice.mjs ./sample.wav
// Accuracy folder (manifest.json plus wav files; app Meta calls enabled):
//   node --env-file-if-exists=.env.local scripts/check-voice.mjs ./recordings/
// manifest.json: {"cases":[{"file":"sale1.wav","action":"sale","quantity":3,"product":"indomie"}]}
//
// Env: APP_ORIGIN (default: the Railway production URL), DEMO_ACCESS_CODE (required),
//   SHOP_ID (optional; defaults to the first simulated shop).
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const origin = (process.env.APP_ORIGIN || "https://ai-market-assistant-production.up.railway.app").replace(/\/$/, "");
const accessCode = process.env.DEMO_ACCESS_CODE;
const target = process.argv[2] || process.env.VOICE_SAMPLE;
if (!accessCode?.trim()) {
  console.error("FAIL: set DEMO_ACCESS_CODE to the Railway variable value first.");
  process.exit(1);
}
if (!target) {
  console.error("FAIL: pass a WAV sample path or a recordings folder: node scripts/check-voice.mjs ./sample.wav");
  process.exit(1);
}
async function post(path, { json, cookie, audio } = {}) {
  const headers = { Origin: origin };
  if (cookie) headers.Cookie = cookie;
  let body;
  if (json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else {
    if (!audio) throw new Error("AUDIO_REQUIRED");
    headers["Content-Type"] = "audio/wav";
    body = audio;
  }
  const response = await fetch(`${origin}${path}`, { method: "POST", headers, body, signal: AbortSignal.timeout(45000) });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const setCookie = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie()[0] : null;
  return { ok: response.ok, status: response.status, code: data?.error?.code || "", cookie: setCookie?.split(";")[0] || "", data };
}
async function login() {
  const list = await post("/api/demo/session", { json: { accessCode } });
  if (!list.ok) {
    console.error(`FAIL: demo session refused (HTTP ${list.status}, ${list.code || "no code"}).`);
    process.exit(1);
  }
  const shops = Array.isArray(list.data?.shops) ? list.data.shops : [];
  const shopId = process.env.SHOP_ID || shops[0]?.id;
  if (!shopId) {
    console.error("FAIL: no simulated shop found for this demo login.");
    process.exit(1);
  }
  const session = await post("/api/demo/session", { json: { accessCode, shopId } });
  if (!session.ok || !session.cookie) {
    console.error(`FAIL: demo shop login refused (HTTP ${session.status}, ${session.code || "no code"}).`);
    process.exit(1);
  }
  return { shopId, cookie: session.cookie };
}
function checkWav(buffer, label) {
  if (buffer.length < 44 || buffer.length > 1500000 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    console.error(`FAIL: ${label} must be a WAV file under 1.5 MB.`);
    process.exit(1);
  }
}
async function transcribe(shopId, cookie, buffer) {
  return post(`/api/entries/transcribe?shopId=${shopId}`, { cookie, audio: buffer });
}
function failMetaNotConfigured(step, result) {
  if (!result.ok && result.code === "META_NOT_CONFIGURED") {
    console.error(`FAIL: ${step} needs app Meta calls enabled with a funded key. No stock was changed.`);
    process.exit(1);
  }
}
try {
  const info = await stat(target).catch(() => null);
  if (!info) {
    console.error("FAIL: could not read the sample path.");
    process.exit(1);
  }
  if (!info.isDirectory()) {
    const sample = await readFile(target).catch(() => null);
    if (!sample) {
      console.error("FAIL: could not read the sample WAV file.");
      process.exit(1);
    }
    checkWav(sample, "sample");
    const { shopId, cookie } = await login();
    const said = await transcribe(shopId, cookie, sample);
    failMetaNotConfigured("transcription", said);
    if (!said.ok) {
      console.error(`FAIL: transcription refused (HTTP ${said.status}, ${said.code || "no code"}). No stock was changed.`);
      process.exit(1);
    }
    const transcript = typeof said.data?.transcript === "string" ? said.data.transcript.trim() : "";
    const words = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
    if (!words) {
      console.error("FAIL: transcription returned no usable words. No stock was changed.");
      process.exit(1);
    }
    console.log(`PASS: live transcription returned ${words} words through /api/entries/transcribe. No stock was changed.`);
    process.exit(0);
  }
  const manifestRaw = await readFile(join(target, "manifest.json"), "utf8").catch(() => null);
  if (!manifestRaw) {
    console.error("FAIL: recordings folder needs a manifest.json with cases.");
    process.exit(1);
  }
  let cases;
  try {
    cases = JSON.parse(manifestRaw).cases;
  } catch {
    cases = null;
  }
  if (!Array.isArray(cases) || !cases.length) {
    console.error("FAIL: manifest.json must hold a non-empty cases array.");
    process.exit(1);
  }
  for (const [index, c] of cases.entries()) {
    if (
      !c || typeof c.file !== "string" || !["sale", "restock", "recount"].includes(c.action) ||
      !Number.isSafeInteger(c.quantity) || c.quantity < 0 || typeof c.product !== "string" || !c.product.trim()
    ) {
      console.error(`FAIL: manifest case ${index} needs file, action, quantity and product.`);
      process.exit(1);
    }
  }
  const files = new Set(await readdir(target));
  const { shopId, cookie } = await login();
  let actionPass = 0, quantityPass = 0, productPass = 0, ran = 0, skipped = 0;
  for (const c of cases) {
    if (!files.has(c.file)) {
      console.log(`${c.file}: SKIPPED (missing file)`);
      skipped += 1;
      continue;
    }
    ran += 1;
    let got = { action: null, quantity: null, item: "" }, failed = "";
    try {
      const buffer = await readFile(join(target, c.file));
      if (buffer.length < 44 || buffer.length > 1500000) throw new Error("BAD_WAV");
      const said = await transcribe(shopId, cookie, buffer);
      failMetaNotConfigured("transcription", said);
      if (!said.ok || typeof said.data?.transcript !== "string" || !said.data.transcript.trim()) throw new Error("NO_TRANSCRIPT");
      const done = await post("/api/entries/interpret", { json: { shopId, text: said.data.transcript }, cookie });
      failMetaNotConfigured("interpretation", done);
      if (!done.ok || !done.data?.extraction) throw new Error("NO_EXTRACTION");
      got = done.data.extraction;
    } catch {
      failed = " (transcribe/interpret failed)";
    }
    const actionOk = got.action === c.action, quantityOk = got.quantity === c.quantity;
    const productOk = typeof got.item === "string" && got.item.toLowerCase().includes(c.product.toLowerCase());
    if (actionOk) actionPass += 1;
    if (quantityOk) quantityPass += 1;
    if (productOk) productPass += 1;
    console.log(
      `${c.file}${failed}: action ${actionOk ? "PASS" : "FAIL"} (got ${got.action}, want ${c.action}) | ` +
      `quantity ${quantityOk ? "PASS" : "FAIL"} (got ${got.quantity}, want ${c.quantity}) | ` +
      `product ${productOk ? "PASS" : "FAIL"} (want "${c.product}" in "${typeof got.item === "string" ? got.item : ""}")`,
    );
  }
  const rate = (n) => (ran ? `${Math.round((100 * n) / ran)}% (${n}/${ran})` : "n/a");
  console.log(`Accuracy over ${ran} recordings (${skipped} skipped): action ${rate(actionPass)}, quantity ${rate(quantityPass)}, product ${rate(productPass)}. No stock was changed.`);
} catch {
  console.error("FAIL: voice check could not finish. Check network access and try again.");
  process.exit(1);
}
