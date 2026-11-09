// Feature O accuracy check: runs the 20 buyer phrases against the live
// /api/buyer/interpret route and prints each phrase, the products chosen
// and an overall pass rate. Prints no keys, cookies or query logs.
// Costs at most one AI call per phrase that local matching cannot settle.
//
// Env: APP_ORIGIN (default: http://127.0.0.1:3000). Refuses non-local
// origins unless --allow-remote is passed explicitly.
import { isLocalOrigin } from "../src/lib/app-origin.ts";
import { BUYER_AI_PHRASES } from "../tests/buyer-ai-phrases.mjs";

const allowRemote = process.argv.includes("--allow-remote");
const origin = (process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
if (!isLocalOrigin(origin) && !allowRemote) {
  console.error("FAIL: refusing non-local origin. Set APP_ORIGIN to a local address or pass --allow-remote.");
  process.exit(1);
}

let cookie = "";
async function interpret(query) {
  const response = await fetch(`${origin}/api/buyer/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ query, consent: true }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.code || `HTTP ${response.status}`);
  return data;
}

let pass = 0, aiCalls = 0;
for (const phrase of BUYER_AI_PHRASES) {
  let line;
  try {
    const data = await interpret(phrase.q);
    if (data.source === "ai") aiCalls++;
    const names = (data.products || []).map((p) => `${p.brand} ${p.name} ${p.size}`);
    const label = names.length ? names.slice(0, 3).join("; ") + (names.length > 3 ? ` (+${names.length - 3})` : "")
      : `NOT IN CATALOG${data.notInCatalog?.idea ? ` (idea: ${data.notInCatalog.idea})` : ""}`;
    let ok;
    if (phrase.none) ok = !names.length && !!data.notInCatalog;
    else {
      ok = (data.products || []).some((p) =>
        phrase.expect.every((word) => `${p.brand} ${p.name}`.toLowerCase().includes(word)));
    }
    if (ok) pass++;
    line = `${ok ? "PASS" : "FAIL"} [${data.source}] "${phrase.q}" -> ${label}`;
  } catch (error) {
    line = `FAIL [error] "${phrase.q}" -> ${error.message}`;
  }
  console.log(line);
}
console.log(`\nPass rate: ${pass}/${BUYER_AI_PHRASES.length} (${Math.round((pass / BUYER_AI_PHRASES.length) * 100)}%). AI calls used: ${aiCalls}.`);
