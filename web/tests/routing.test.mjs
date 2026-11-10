import { before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../scripts/migrate.mjs";
import { signBuyer, verifyFeedbackTicket } from "../src/lib/buyer.ts";
import { dailyCapFor, dailyDateKey } from "../src/lib/model-limits.ts";
import * as routing from "../src/lib/routing.ts";
import {
  ORS_DEFAULT_BASE,
  ROUTING_ATTRIBUTION,
  createRouteCache,
  formatRoadText,
  mapboxRequest,
  orsRequest,
  parseOrsBase,
  parseRouteMode,
  parseRoutingProvider,
  roundCoord,
  routeCacheKey,
} from "../src/lib/routing.ts";
import { requestRoute } from "../src/server/route-service.ts";

const db = new PGlite();
const actor = "40000000-0000-4000-a000-000000000011";
const shop = "50000000-0000-4000-a000-000000000011";
const product = "60000000-0000-4000-a000-000000000011";
const searchIds = {
  "visitor-a": "70000000-0000-4000-a000-000000000011",
  "visitor-b": "70000000-0000-4000-a000-000000000022",
  "visitor-capped": "70000000-0000-4000-a000-000000000033",
};
const SECRET = "test-secret-that-is-long-enough-5678";
const ORS_KEY = "ors-test-key-value";
const MAPBOX_KEY = "mapbox-test-key-value";

const orsPayload = {
  features: [{
    properties: { summary: { distance: 1400, duration: 720 } },
    geometry: { coordinates: [[7.324, 9.151], [7.33, 9.155]] },
  }],
};
const mapboxPayload = {
  code: "Ok",
  routes: [{
    distance: 1500, duration: 800,
    geometry: { coordinates: [[7.324, 9.151], [7.33, 9.155]] },
  }],
};
const fakeFetch = (payload, calls, status = 200) => async (url, init) => {
  calls.push({ url, init });
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
};
const ticket = (visitor, overrides = {}) => signBuyer("buyer-feedback", {
  visitor, searchId: searchIds[visitor] ?? searchIds["visitor-a"], shopId: shop, productId: product, expires: Date.now() + 15 * 60000, ...overrides,
}, SECRET);
const call = (overrides = {}) => {
  const env = overrides.env ?? { ROUTING_PROVIDER: "ors", ORS_API_KEY: ORS_KEY };
  const visitor = overrides.visitor ?? `visitor-${Math.random()}`;
  return requestRoute({
    db, fetchImpl: fakeFetch(orsPayload, []), env, R: routing,
    cache: createRouteCache(), caps: { routing: dailyCapFor("routing", env), global: dailyCapFor("global", env) },
    day: dailyDateKey(), rateLimit: routing.ROUTE_RATE_LIMIT,
    verifyTicket: (token) => verifyFeedbackTicket(token, SECRET, visitor),
    visitor, token: null, latitude: 9.151, longitude: 7.324, mode: "walking", ...overrides,
  });
};
const callFor = (visitor, overrides = {}) => {
  const base = { visitor, token: ticket(visitor) };
  return call({ ...base, ...overrides });
};

before(async () => {
  await migrate(db);
  await db.query("INSERT INTO traders(id,display_name,simulated) VALUES($1,'Route owner',true)", [actor]);
  await db.query(
    `INSERT INTO shops(id,owner_id,name,category,latitude,longitude,landmark,simulated)
     VALUES($1,$2,'Route shop','provisions',9.155,7.33,'Simulated Kubwa pin',true)`,
    [shop, actor],
  );
  await db.query(
    "INSERT INTO products(id,name,brand,variant,size,unit,category,perishable) VALUES($1,'Noodles','Indomie','Chicken','70g','pack','provisions',true)",
    [product],
  );
});
beforeEach(async () => {
  await db.query("DELETE FROM auth_rate_limits");
  await db.query("DELETE FROM searches");
  for (const [visitor, id] of Object.entries(searchIds)) {
    await db.query("INSERT INTO searches(id,product_id,found_results,simulated,visitor_hash) VALUES($1,$2,true,true,$3)", [id, product, visitor]);
  }
});

test("provider and mode parsing default safely", () => {
  assert.equal(parseRoutingProvider(undefined), "none");
  assert.equal(parseRoutingProvider("google"), "none");
  assert.equal(parseRoutingProvider("ors"), "ors");
  assert.equal(parseRoutingProvider("mapbox"), "mapbox");
  assert.equal(parseRouteMode(undefined), "walking");
  assert.equal(parseRouteMode("cycling"), "walking");
  assert.equal(parseRouteMode("driving"), "driving");
  assert.equal(roundCoord(9.15149), 9.151);
  assert.equal(
    routeCacheKey("ors", "walking", { latitude: 9.1511, longitude: 7.3241 }, { latitude: 9.155, longitude: 7.33 }),
    routeCacheKey("ors", "walking", { latitude: 9.1514, longitude: 7.3244 }, { latitude: 9.155, longitude: 7.33 }),
  );
  assert.notEqual(
    routeCacheKey("ors", "walking", { latitude: 9.151, longitude: 7.324 }, { latitude: 9.155, longitude: 7.33 }),
    routeCacheKey("ors", "driving", { latitude: 9.151, longitude: 7.324 }, { latitude: 9.155, longitude: 7.33 }),
  );
});

test("road text matches the required wording", () => {
  assert.equal(formatRoadText(720, 1400, "walking"), "about 12 min walking, 1.4 km by road");
  assert.equal(formatRoadText(300, 450, "driving"), "about 5 min driving, 450 m by road");
  assert.equal(formatRoadText(20, 60, "walking"), "about 1 min walking, 60 m by road");
});

test("provider none never calls the network", async () => {
  const calls = [];
  const outcome = await callFor("visitor-a", {
    fetchImpl: fakeFetch(orsPayload, calls), env: { ROUTING_PROVIDER: "none", ORS_API_KEY: ORS_KEY },
  });
  assert.equal(outcome.status, "unavailable");
  assert.equal(calls.length, 0);
});

test("missing key falls back without a call", async () => {
  const calls = [];
  const outcome = await callFor("visitor-a", {
    fetchImpl: fakeFetch(orsPayload, calls), env: { ROUTING_PROVIDER: "ors" },
  });
  assert.equal(outcome.status, "unavailable");
  assert.equal(calls.length, 0);
});

test("ORS success sends the key in the header and never in the response", async () => {
  const calls = [];
  const outcome = await callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, calls) });
  assert.equal(outcome.status, "route");
  assert.equal(outcome.distanceM, 1400);
  assert.equal(outcome.durationS, 720);
  assert.deepEqual(outcome.points, [[9.151, 7.324], [9.155, 7.33]]);
  assert.equal(outcome.attribution, ROUTING_ATTRIBUTION.ors);
  assert.equal(outcome.cached, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /foot-walking/);
  assert.equal(calls[0].init.headers.Authorization, ORS_KEY);
  assert.ok(!calls[0].url.includes(ORS_KEY));
  assert.ok(!JSON.stringify(outcome).includes(ORS_KEY));
});

test("Mapbox success uses the driving profile when asked", async () => {
  const calls = [];
  const outcome = await callFor("visitor-a", {
    fetchImpl: fakeFetch(mapboxPayload, calls),
    env: { ROUTING_PROVIDER: "mapbox", MAPBOX_ACCESS_TOKEN: MAPBOX_KEY },
    mode: "driving",
  });
  assert.equal(outcome.status, "route");
  assert.equal(outcome.provider, "mapbox");
  assert.equal(outcome.mode, "driving");
  assert.match(calls[0].url, /mapbox\/driving\//);
  assert.ok(!JSON.stringify(outcome).includes(MAPBOX_KEY));
});

test("omitted mode defaults to walking", async () => {
  const calls = [];
  const outcome = await callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, calls), mode: undefined });
  assert.equal(outcome.status, "route");
  assert.equal(outcome.mode, "walking");
  assert.match(calls[0].url, /foot-walking/);
});

test("provider failures fall back silently", async () => {
  const failing = [
    async () => ({ ok: false, status: 500, json: async () => ({}) }),
    async () => { throw new Error("timeout"); },
    async () => ({ ok: true, status: 200, json: async () => ({ nonsense: true }) }),
    async () => ({ ok: true, status: 200, json: async () => ({ features: [] }) }),
  ];
  for (const fetchImpl of failing) {
    const outcome = await callFor("visitor-a", { fetchImpl, cache: createRouteCache() });
    assert.equal(outcome.status, "unavailable");
  }
  const badShape = await callFor("visitor-a", {
    fetchImpl: fakeFetch({ code: "NoRoute", routes: [] }, []),
    env: { ROUTING_PROVIDER: "mapbox", MAPBOX_ACCESS_TOKEN: MAPBOX_KEY },
    cache: createRouteCache(),
  });
  assert.equal(badShape.status, "unavailable");
});

test("invalid coordinates are rejected before any provider call", async () => {
  const calls = [];
  for (const coords of [
    { latitude: Number.NaN, longitude: 7.324 },
    { latitude: 91, longitude: 7.324 },
    { latitude: 9.151, longitude: 181 },
    { latitude: "9.151", longitude: 7.324 },
    { latitude: undefined, longitude: 7.324 },
  ]) {
    await assert.rejects(callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, calls), ...coords }), /INVALID_ROUTE/);
  }
  assert.equal(calls.length, 0);
});

test("route binding rejects bad, mismatched and expired tickets", async () => {
  await assert.rejects(callFor("visitor-a", { token: "not-a-ticket" }), /FEEDBACK_EXPIRED/);
  await assert.rejects(call({ visitor: "visitor-a", token: ticket("visitor-b") }), /INVALID_FEEDBACK/);
  await assert.rejects(callFor("visitor-a", {
    token: ticket("visitor-a", { expires: Date.now() - 1000 }),
  }), /FEEDBACK_EXPIRED/);
  await assert.rejects(callFor("visitor-a", {
    token: ticket("visitor-a", { shopId: "00000000-0000-4000-a000-000000000099" }),
  }), /FEEDBACK_EXPIRED/);
});

test("repeated and nearby pins share one cached route", async () => {
  const calls = [];
  const cache = createRouteCache();
  const first = await callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, calls), cache });
  const second = await callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, calls), cache });
  const nearby = await callFor("visitor-a", {
    fetchImpl: fakeFetch(orsPayload, calls), cache, latitude: 9.1514, longitude: 7.3244,
  });
  assert.equal(first.status, "route");
  assert.equal(second.cached, true);
  assert.equal(nearby.cached, true);
  assert.equal(calls.length, 1);
  const otherMode = await callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, calls), cache, mode: "driving" });
  assert.equal(otherMode.cached, false);
  assert.equal(calls.length, 2);
});

test("cache hits do not consume the daily cap", async () => {
  const env = { ROUTING_PROVIDER: "ors", ORS_API_KEY: ORS_KEY, MODEL_DAILY_CAP_ROUTING: "1" };
  const cache = createRouteCache();
  const first = await callFor("visitor-capped", { env, cache, fetchImpl: fakeFetch(orsPayload, []) });
  const second = await callFor("visitor-capped", { env, cache, fetchImpl: fakeFetch(orsPayload, []) });
  assert.equal(first.status, "route");
  assert.equal(second.status, "route");
});

test("per-visitor daily cap trips on the third fresh route", async () => {
  const env = { ROUTING_PROVIDER: "ors", ORS_API_KEY: ORS_KEY, MODEL_DAILY_CAP_ROUTING: "2" };
  await callFor("visitor-capped", { env, latitude: 9.151 });
  await callFor("visitor-capped", { env, latitude: 9.161 });
  await assert.rejects(callFor("visitor-capped", { env, latitude: 9.171 }), /DAILY_LIMIT_REACHED/);
});

test("global daily cap is shared across visitors", async () => {
  const env = { ROUTING_PROVIDER: "ors", ORS_API_KEY: ORS_KEY, MODEL_DAILY_CAP_GLOBAL: "1" };
  const first = await callFor("visitor-a", { env, latitude: 9.151 });
  assert.equal(first.status, "route");
  await assert.rejects(callFor("visitor-b", { env, latitude: 9.161 }), /DAILY_LIMIT_REACHED/);
});

test("burst rate limit trips after 60 taps", async () => {
  const fetchImpl = fakeFetch(orsPayload, []);
  const env = { ROUTING_PROVIDER: "ors", ORS_API_KEY: ORS_KEY, MODEL_DAILY_CAP_ROUTING: "1000" };
  for (let index = 0; index < 60; index++) {
    const outcome = await callFor("visitor-a", { env, fetchImpl, latitude: 9.0 + index * 0.002 });
    assert.equal(outcome.status, "route");
  }
  await assert.rejects(callFor("visitor-a", { env, fetchImpl, latitude: 9.0 + 60 * 0.002 }), /TOO_MANY_ATTEMPTS/);
});

test("ORS uses the verified HeiGIT base, overridable by ORS_BASE_URL", async () => {
  assert.equal(ORS_DEFAULT_BASE, "https://api.heigit.org/openrouteservice");
  assert.equal(parseOrsBase(undefined), ORS_DEFAULT_BASE);
  assert.equal(parseOrsBase(""), ORS_DEFAULT_BASE);
  assert.equal(parseOrsBase("https://custom.example/ors/"), "https://custom.example/ors");
  assert.equal(parseOrsBase("http://insecure.example/ors"), ORS_DEFAULT_BASE);
  assert.equal(parseOrsBase("not a url"), ORS_DEFAULT_BASE);
  const calls = [];
  await callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, calls) });
  assert.ok(calls[0].url.startsWith("https://api.heigit.org/openrouteservice/v2/directions/"));
  const custom = [];
  await callFor("visitor-a", {
    fetchImpl: fakeFetch(orsPayload, custom),
    env: { ROUTING_PROVIDER: "ors", ORS_API_KEY: ORS_KEY, ORS_BASE_URL: "https://custom.example/ors" },
  });
  assert.ok(custom[0].url.startsWith("https://custom.example/ors/v2/directions/"));
});

test("swapped coordinates fail clearly: ORS expects longitude first", () => {
  const from = { latitude: 9.151, longitude: 7.324 }, to = { latitude: 9.155, longitude: 7.33 };
  const coords = JSON.parse(orsRequest(from, to, "walking", "k").init.body).coordinates;
  assert.deepEqual(coords[0], [7.324, 9.151], "ORS body must be [longitude, latitude], not [latitude, longitude]");
  assert.deepEqual(coords[1], [7.33, 9.155], "ORS body must be [longitude, latitude], not [latitude, longitude]");
  assert.notDeepEqual(coords[0], [from.latitude, from.longitude], "latitude-first order would route to the wrong place");
});

test("Kubwa coordinates keep longitude-first order in every request", async () => {
  const from = { latitude: 9.151, longitude: 7.324 }, to = { latitude: 9.155, longitude: 7.33 };
  for (const mode of ["walking", "driving"]) {
    const orsCoords = JSON.parse(orsRequest(from, to, mode, "k").init.body).coordinates;
    assert.deepEqual(orsCoords, [[7.324, 9.151], [7.33, 9.155]], `ORS ${mode} must send longitude first`);
    assert.ok(mapboxRequest(from, to, mode, "k").url.includes("7.324,9.151;7.33,9.155"), `Mapbox ${mode} must send longitude first`);
  }
  const orsCalls = [];
  await callFor("visitor-a", { fetchImpl: fakeFetch(orsPayload, orsCalls) });
  assert.deepEqual(JSON.parse(orsCalls[0].init.body).coordinates, [[7.324, 9.151], [7.33, 9.155]]);
  const mapboxCalls = [];
  await callFor("visitor-a", {
    fetchImpl: fakeFetch(mapboxPayload, mapboxCalls),
    env: { ROUTING_PROVIDER: "mapbox", MAPBOX_ACCESS_TOKEN: MAPBOX_KEY },
  });
  assert.ok(mapboxCalls[0].url.includes("7.324,9.151;7.33,9.155"));
});

test("401, 403 and 404 fall back with no key printed", async () => {
  for (const status of [401, 403, 404]) {
    const outcome = await callFor("visitor-a", {
      fetchImpl: fakeFetch({ error: { message: "refused" } }, [], status),
      cache: createRouteCache(),
    });
    assert.equal(outcome.status, "unavailable");
    assert.ok(!JSON.stringify(outcome).includes(ORS_KEY));
  }
  const noRoute = await callFor("visitor-a", {
    fetchImpl: fakeFetch({ code: "NoRoute", routes: [] }, []),
    env: { ROUTING_PROVIDER: "mapbox", MAPBOX_ACCESS_TOKEN: MAPBOX_KEY },
    cache: createRouteCache(),
  });
  assert.equal(noRoute.status, "unavailable");
  assert.ok(!JSON.stringify(noRoute).includes(MAPBOX_KEY));
});

test("429 waits briefly then falls back", async () => {
  let waited = 0;
  const outcome = await callFor("visitor-a", {
    fetchImpl: fakeFetch({}, [], 429),
    sleep: async (ms) => { waited = ms; },
  });
  assert.equal(outcome.status, "unavailable");
  assert.equal(waited, 1000);
});

test("request builders pick the right profiles", () => {
  const from = { latitude: 9.151, longitude: 7.324 }, to = { latitude: 9.155, longitude: 7.33 };
  assert.match(orsRequest(from, to, "walking", "k").url, /foot-walking/);
  assert.match(orsRequest(from, to, "driving", "k").url, /driving-car/);
  assert.equal(orsRequest(from, to, "walking", "k").init.method, "POST");
  assert.match(mapboxRequest(from, to, "walking", "k").url, /mapbox\/walking\//);
  assert.match(mapboxRequest(from, to, "driving", "k").url, /mapbox\/driving\//);
  assert.ok(ROUTING_ATTRIBUTION.ors.toLowerCase().includes("openrouteservice"));
  assert.ok(ROUTING_ATTRIBUTION.mapbox.toLowerCase().includes("mapbox"));
});
