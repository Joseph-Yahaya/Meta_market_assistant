// Feature R part two: server-side road route for one buyer tap.
// Zero TypeScript imports by design: the API route passes the real lib
// implementations (@/lib/*) and tests pass the same implementations via
// relative .ts imports, so both exercise identical production behavior
// without a module loader. Coordinates are used transiently and never
// written to any table: only hashed counters (no coords) plus a short
// in-memory result cache owned by the caller.
import { createHash } from "node:crypto";

export type RouteDb = { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
export type RouteFetch = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
export type RoutePointLike = { latitude: number; longitude: number };
export type RouteResultLike = {
  distanceM: number; durationS: number; points: [number, number][];
  attribution: string; provider: "ors" | "mapbox"; mode: "walking" | "driving";
};
export type RouteCacheLike = { get: (key: string) => RouteResultLike | undefined; set: (key: string, value: RouteResultLike) => void };
export type RouteTicket = { shopId: string; productId: string; searchId: string };
export type RoutingImpl = {
  parseRouteMode: (value: unknown) => "walking" | "driving";
  parseRoutePoint: (latitude: unknown, longitude: unknown) => RoutePointLike;
  parseRoutingProvider: (raw: unknown) => "none" | "ors" | "mapbox";
  routingKeyName: (provider: "none" | "ors" | "mapbox") => "ORS_API_KEY" | "MAPBOX_ACCESS_TOKEN" | null;
  parseOrsBase: (raw: unknown) => string;
  routeCacheKey: (provider: string, mode: string, from: RoutePointLike, to: RoutePointLike) => string;
  orsRequest: (from: RoutePointLike, to: RoutePointLike, mode: "walking" | "driving", key: string, base: string) => { url: string; init: Record<string, unknown> };
  mapboxRequest: (from: RoutePointLike, to: RoutePointLike, mode: "walking" | "driving", key: string) => { url: string; init: Record<string, unknown> };
  parseOrsRoute: (payload: unknown, mode: "walking" | "driving") => RouteResultLike;
  parseMapboxRoute: (payload: unknown, mode: "walking" | "driving") => RouteResultLike;
};
export type RouteOutcome =
  | { status: "route"; distanceM: number; durationS: number; mode: "walking" | "driving"; provider: "ors" | "mapbox"; points: [number, number][]; attribution: string; cached: boolean }
  | { status: "unavailable" };
export type RouteRequest = {
  db: RouteDb; fetchImpl: RouteFetch; env: Record<string, string | undefined>; cache: RouteCacheLike; R: RoutingImpl;
  caps: { routing: number; global: number }; day: string; rateLimit: number;
  verifyTicket: (token: unknown) => RouteTicket;
  sleep?: (ms: number) => Promise<void>;
  visitor: string; token: unknown; latitude: unknown; longitude: unknown; mode: unknown;
};
const defaultSleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

async function countUp(db: RouteDb, key: string, limit: number, windowSql: string): Promise<void> {
  const hashed = createHash("sha256").update(key).digest("hex");
  const { rows } = await db.query(
    `INSERT INTO auth_rate_limits(key,attempts,expires_at) VALUES($1,1,${windowSql})
     ON CONFLICT(key) DO UPDATE SET attempts=auth_rate_limits.attempts+1 RETURNING attempts`, [hashed]);
  if (Number(rows[0]?.attempts) > limit) throw new Error("DAILY_LIMIT_REACHED");
}
async function limitRouteRate(db: RouteDb, visitor: string, limit: number): Promise<void> {
  const hashed = createHash("sha256").update(`route-rate:${visitor}`).digest("hex");
  const { rows } = await db.query(
    `INSERT INTO auth_rate_limits(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes')
     ON CONFLICT(key) DO UPDATE SET
     attempts=CASE WHEN auth_rate_limits.expires_at<=now() THEN 1 ELSE auth_rate_limits.attempts+1 END,
     expires_at=CASE WHEN auth_rate_limits.expires_at<=now() THEN now()+interval '15 minutes' ELSE auth_rate_limits.expires_at END
     RETURNING attempts`, [hashed]);
  if (Number(rows[0]?.attempts) > limit) throw new Error("TOO_MANY_ATTEMPTS");
  await db.query("DELETE FROM auth_rate_limits WHERE expires_at<now()-interval '1 day'");
}
async function limitRouteDaily(db: RouteDb, visitor: string, day: string, caps: { routing: number; global: number }): Promise<void> {
  const midnight = "(date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC'";
  await countUp(db, `daily:${day}:routing:${visitor}`, caps.routing, midnight);
  await countUp(db, `daily:${day}:routing-global:all`, caps.global, midnight);
}

export async function requestRoute(input: RouteRequest): Promise<RouteOutcome> {
  const mode = input.R.parseRouteMode(input.mode);
  const from = input.R.parseRoutePoint(input.latitude, input.longitude);
  const ticket = input.verifyTicket(input.token);
  const found = await input.db.query(
    `SELECT s.latitude,s.longitude FROM shops s WHERE s.id=$1 AND s.simulated
     AND EXISTS (SELECT 1 FROM searches w WHERE w.id=$2 AND w.visitor_hash=$3 AND w.simulated AND w.at>now()-interval '24 hours')`,
    [ticket.shopId, ticket.searchId, input.visitor]);
  if (!found.rows.length) throw new Error("FEEDBACK_EXPIRED");
  const to = input.R.parseRoutePoint(Number(found.rows[0].latitude), Number(found.rows[0].longitude));
  const provider = input.R.parseRoutingProvider(input.env.ROUTING_PROVIDER);
  if (provider === "none") return { status: "unavailable" };
  const keyName = input.R.routingKeyName(provider);
  const key = keyName ? input.env[keyName]?.trim() : "";
  if (!key) return { status: "unavailable" };
  await limitRouteRate(input.db, input.visitor, input.rateLimit);
  const cacheKey = input.R.routeCacheKey(provider, mode, from, to);
  const hit = input.cache.get(cacheKey);
  if (hit) return { status: "route", distanceM: hit.distanceM, durationS: hit.durationS, mode: hit.mode, provider: hit.provider, points: hit.points, attribution: hit.attribution, cached: true };
  await limitRouteDaily(input.db, input.visitor, input.day, input.caps);
  const built = provider === "ors"
    ? input.R.orsRequest(from, to, mode, key, input.R.parseOrsBase(input.env.ORS_BASE_URL))
    : input.R.mapboxRequest(from, to, mode, key);
  let payload: unknown;
  try {
    const response = await input.fetchImpl(built.url, { ...built.init, signal: AbortSignal.timeout(15000) });
    // 401/403: key refused or daily quota used up. 404: no road near a
    // point or no route between the points. All fall back to the
    // straight-line distance the buyer already sees; the key is never
    // logged, and nothing here reaches the browser.
    if (response.status === 429) {
      await (input.sleep ?? defaultSleep)(1000);
      return { status: "unavailable" };
    }
    if (!response.ok) return { status: "unavailable" };
    payload = await response.json();
  } catch { return { status: "unavailable" }; }
  let result: RouteResultLike;
  try { result = provider === "ors" ? input.R.parseOrsRoute(payload, mode) : input.R.parseMapboxRoute(payload, mode); }
  catch { return { status: "unavailable" }; }
  input.cache.set(cacheKey, result);
  return { status: "route", distanceM: result.distanceM, durationS: result.durationS, mode: result.mode, provider: result.provider, points: result.points, attribution: result.attribution, cached: false };
}
