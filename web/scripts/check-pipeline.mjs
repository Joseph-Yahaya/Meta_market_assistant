// Tries the shared image pipeline with a product photo from your computer.
// Prints only the structured proposal fields. Never prints the image bytes
// or the key. Each run makes ONE live Meta call.
//
// Usage: node --env-file-if-exists=.env.local scripts/check-pipeline.mjs ./photo.jpg
// Env: APP_ORIGIN (default: http://127.0.0.1:3000), VOICE_TEST_EMAIL and
//   VOICE_TEST_PASSWORD (test trader account). Refuses non-local origins
//   unless --allow-remote is passed explicitly.
import { readFile } from "node:fs/promises";
import { isLocalOrigin } from "../src/lib/app-origin.ts";
import { sniffImageType } from "../src/lib/image.ts";

const allowRemote = process.argv.includes("--allow-remote");
const origin = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
if (!isLocalOrigin(origin) && !allowRemote) {
  console.error("FAIL: refusing non-local origin. Set APP_ORIGIN to a local address or pass --allow-remote.");
  process.exit(1);
}
const email = process.env.VOICE_TEST_EMAIL, password = process.env.VOICE_TEST_PASSWORD;
if (!email?.trim() || !password) {
  console.error("FAIL: set VOICE_TEST_EMAIL and VOICE_TEST_PASSWORD to a test trader account first.");
  process.exit(1);
}
const target = process.argv.slice(2).find((a) => a !== "--allow-remote");
if (!target) {
  console.error("FAIL: pass a photo path: node scripts/check-pipeline.mjs ./photo.jpg");
  process.exit(1);
}
async function post(path, { json, cookie, audio, contentType } = {}) {
  const headers = { Origin: origin };
  if (cookie) headers.Cookie = cookie;
  let body;
  if (json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else {
    headers["Content-Type"] = contentType;
    body = audio;
  }
  const response = await fetch(`${origin}${path}`, { method: "POST", headers, body, signal: AbortSignal.timeout(90000) });
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
  const photo = await readFile(target).catch(() => null);
  if (!photo) {
    console.error("FAIL: could not read the photo file. No request was made.");
    process.exit(1);
  }
  const type = sniffImageType(photo);
  if (!type) {
    console.error("FAIL: only JPEG, PNG and WebP photos are accepted. No request was made.");
    process.exit(1);
  }
  const auth = await post("/api/auth/login", { json: { email, password } });
  if (!auth.ok || !auth.cookie) {
    console.error(`FAIL: trader login refused (HTTP ${auth.status}, ${auth.code || "no code"}).`);
    process.exit(1);
  }
  const mime = type === "jpeg" ? "image/jpeg" : type === "png" ? "image/png" : "image/webp";
  const done = await post("/api/images/analyze", { cookie: auth.cookie, audio: photo, contentType: mime });
  if (!done.ok) {
    console.error(`FAIL: pipeline refused the photo (HTTP ${done.status}, ${done.code || "no code"}). Nothing was saved.`);
    process.exit(1);
  }
  console.log(JSON.stringify(done.data?.proposal ?? null));
} catch {
  console.error("FAIL: pipeline check could not finish. Check network access and try again.");
  process.exit(1);
}
