// Feature R provider comparison: runs owner-supplied Kubwa trips on each
// routing provider with a key, walking and driving, and prints only
// distances, times and differences. Prints no keys and no coordinates.
//
// Usage (from web/):
//   node --env-file-if-exists=.env.local scripts/compare-routes.mjs [trips.json]
//   ... without --run it only prints the plan and makes no requests.
//   Add --run to make the requests. Add --include-examples to also run
//   trips flagged example:true (the shipped example file is placeholder
//   data only).
//
// Trips file: copy scripts/trips.example.json to scripts/trips.local.json
// (ignored by git) and fill in real trips. Each trip: label, from/to with
// latitude+longitude, optional realMinutesWalking/realMinutesDriving and
// an optional note of the real time you know.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mapboxRequest, orsRequest, parseMapboxRoute, parseOrsBase, parseOrsRoute, parseRoutePoint,
} from "../src/lib/routing.ts";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const run = args.includes("--run");
const includeExamples = args.includes("--include-examples");
const fileArg = args.find((entry) => !entry.startsWith("--"));
const tripsPath = fileArg ? resolve(process.cwd(), fileArg) : resolve(here, "trips.local.json");

let raw;
try { raw = JSON.parse(readFileSync(tripsPath, "utf8")); }
catch {
  console.error(`FAIL: cannot read ${tripsPath}. Copy scripts/trips.example.json to scripts/trips.local.json and fill in real trips.`);
  process.exit(1);
}
const trips = Array.isArray(raw?.trips) ? raw.trips : [];
if (!trips.length || trips.length > 50) { console.error("FAIL: trips file must hold 1 to 50 trips."); process.exit(1); }
for (const [index, trip] of trips.entries()) {
  try {
    if (typeof trip?.label !== "string" || !trip.label.trim()) throw new Error("bad trip");
    parseRoutePoint(trip.from?.latitude, trip.from?.longitude);
    parseRoutePoint(trip.to?.latitude, trip.to?.longitude);
    for (const field of ["realMinutesWalking", "realMinutesDriving"]) {
      if (trip[field] !== undefined && trip[field] !== null &&
        (typeof trip[field] !== "number" || !Number.isFinite(trip[field]) || trip[field] < 0)) throw new Error("bad trip");
    }
  } catch { console.error(`FAIL: trip ${index + 1} ("${trip?.label ?? "?"}") is invalid. Check its label and coordinates.`); process.exit(1); }
}
const runnable = includeExamples ? trips : trips.filter((trip) => !trip.example);
const skipped = trips.length - runnable.length;
const providers = [];
if (process.env.ORS_API_KEY?.trim()) providers.push("ors");
if (process.env.MAPBOX_ACCESS_TOKEN?.trim()) providers.push("mapbox");
if (!providers.length) { console.error("FAIL: no provider key found. Set ORS_API_KEY and/or MAPBOX_ACCESS_TOKEN in the environment."); process.exit(1); }
const modes = ["walking", "driving"];
const total = runnable.length * providers.length * modes.length;
console.log(`Plan: ${runnable.length} trip(s) x ${providers.length} provider(s) [${providers.join(", ")}] x 2 modes = ${total} request(s).${skipped ? ` ${skipped} example trip(s) skipped (pass --include-examples to run them).` : ""}`);
if (!run) { console.log("No requests made. Pass --run to make them."); process.exit(0); }

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const results = [];
for (const trip of runnable) {
  for (const provider of providers) {
    for (const mode of modes) {
      const key = (provider === "ors" ? process.env.ORS_API_KEY : process.env.MAPBOX_ACCESS_TOKEN).trim();
      const built = provider === "ors"
        ? orsRequest(trip.from, trip.to, mode, key, parseOrsBase(process.env.ORS_BASE_URL))
        : mapboxRequest(trip.from, trip.to, mode, key);
      try {
        const response = await fetch(built.url, { ...built.init, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const parsed = provider === "ors" ? parseOrsRoute(await response.json(), mode) : parseMapboxRoute(await response.json(), mode);
        results.push({ label: trip.label, provider, mode, km: parsed.distanceM / 1000, min: parsed.durationS / 60, real: mode === "walking" ? trip.realMinutesWalking ?? null : trip.realMinutesDriving ?? null });
        console.log(`${trip.label} | ${provider} | ${mode} | ${(parsed.distanceM / 1000).toFixed(2)} km | ${(parsed.durationS / 60).toFixed(1)} min`);
      } catch { console.log(`${trip.label} | ${provider} | ${mode} | FAIL (provider error, see terms/limits)`); }
      await sleep(500);
    }
  }
}
console.log("\nDifferences:");
let lines = 0;
for (const trip of runnable) {
  for (const mode of modes) {
    const pair = results.filter((entry) => entry.label === trip.label && entry.mode === mode);
    for (const entry of pair) {
      if (entry.real !== null) { console.log(`${entry.label} | ${entry.provider} | ${mode} | provider ${(entry.min).toFixed(1)} min vs known ${entry.real} min (diff ${(entry.min - entry.real).toFixed(1)} min)`); lines++; }
    }
    if (pair.length === 2) {
      console.log(`${trip.label} | ${mode} | ors ${pair[0].provider === "ors" ? pair[0].min.toFixed(1) : pair[1].min.toFixed(1)} min vs mapbox ${pair[0].provider === "mapbox" ? pair[0].min.toFixed(1) : pair[1].min.toFixed(1)} min (diff ${Math.abs(pair[0].min - pair[1].min).toFixed(1)} min)`); lines++;
    }
  }
}
if (!lines) console.log("(no known times and no provider pairs to compare)");
