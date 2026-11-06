// Trader-voice live check through the real hosted route.
// Prints pass/fail only: never prints keys, access codes, cookies or full responses.
//
// Usage (needs a short real English recording as 16-bit mono WAV, 16/24 kHz, <=30 s):
//   node --env-file-if-exists=.env.local scripts/check-voice.mjs ./sample.wav
// Env: APP_ORIGIN (default: the Railway production URL), DEMO_ACCESS_CODE (required),
//   SHOP_ID (optional; defaults to the first simulated shop).
import { readFile } from "node:fs/promises";

const origin = (process.env.APP_ORIGIN || "https://ai-market-assistant-production.up.railway.app").replace(/\/$/, "");
const accessCode = process.env.DEMO_ACCESS_CODE;
const samplePath = process.argv[2] || process.env.VOICE_SAMPLE;
if (!accessCode?.trim()) {
  console.error("FAIL: set DEMO_ACCESS_CODE to the Railway variable value first.");
  process.exit(1);
}
if (!samplePath) {
  console.error("FAIL: pass a WAV sample path: node scripts/check-voice.mjs ./sample.wav");
  process.exit(1);
}
let audio;
try {
  audio = await readFile(samplePath);
} catch {
  console.error("FAIL: could not read the sample WAV file.");
  process.exit(1);
}
if (audio.length < 44 || audio.length > 1500000 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") {
  console.error("FAIL: sample must be a WAV file under 1.5 MB.");
  process.exit(1);
}
async function post(path, { json, cookie } = {}) {
  const headers = { Origin: origin };
  if (cookie) headers.Cookie = cookie;
  let body;
  if (json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else {
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
try {
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
  const login = await post("/api/demo/session", { json: { accessCode, shopId } });
  if (!login.ok || !login.cookie) {
    console.error(`FAIL: demo shop login refused (HTTP ${login.status}, ${login.code || "no code"}).`);
    process.exit(1);
  }
  const said = await post(`/api/entries/transcribe?shopId=${shopId}`, { cookie: login.cookie });
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
} catch {
  console.error("FAIL: voice check could not finish. Check network access and try again.");
  process.exit(1);
}
