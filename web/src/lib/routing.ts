// Feature R part two: routing provider layer (pure helpers, no secrets).
// Supports OpenRouteService and Mapbox behind ROUTING_PROVIDER. API keys
// are read from the environment by the caller (server or comparison
// script) and are never logged, printed or sent to the browser here.
export type RoutingProvider = "none" | "ors" | "mapbox";
export type RouteMode = "walking" | "driving";
export type RoutePoint = { latitude: number; longitude: number };
export type RouteResult = {
  distanceM: number; durationS: number; points: [number, number][];
  attribution: string; provider: Exclude<RoutingProvider, "none">; mode: RouteMode;
};
// Short-lived in-memory cache only: rounded coordinate pairs, never
// persisted. Cap the entries and the points per route to bound memory.
export const ROUTE_CACHE_TTL_MS = 15 * 60 * 1000;
export const ROUTE_CACHE_MAX = 200;
export const ROUTE_POINT_LIMIT = 2000;
export const ROUTE_RATE_LIMIT = 60;
export const ROUTING_ATTRIBUTION = {
  ors: "Road route by openrouteservice (HeiGIT) · map data © OpenStreetMap contributors",
  mapbox: "Road route by Mapbox · map data © OpenStreetMap contributors",
} as const;

export function parseRoutingProvider(raw: unknown): RoutingProvider {
  return raw === "ors" || raw === "mapbox" ? raw : "none";
}
export function routingKeyName(provider: RoutingProvider): "ORS_API_KEY" | "MAPBOX_ACCESS_TOKEN" | null {
  if (provider === "ors") return "ORS_API_KEY";
  if (provider === "mapbox") return "MAPBOX_ACCESS_TOKEN";
  return null;
}
export function parseRouteMode(value: unknown): RouteMode {
  return value === "driving" ? "driving" : "walking";
}
export function parseRoutePoint(latitude: unknown, longitude: unknown): RoutePoint {
  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180
  ) throw new Error("INVALID_ROUTE");
  return { latitude, longitude };
}
// Three decimals (~110 m) so nearby pins share one cached route.
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}
export function routeCacheKey(provider: string, mode: string, from: RoutePoint, to: RoutePoint): string {
  return [provider, mode, roundCoord(from.latitude), roundCoord(from.longitude), roundCoord(to.latitude), roundCoord(to.longitude)].join(":");
}
export function createRouteCache(ttlMs = ROUTE_CACHE_TTL_MS, max = ROUTE_CACHE_MAX) {
  const entries = new Map<string, { value: RouteResult; expires: number }>();
  return {
    get(key: string): RouteResult | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expires <= Date.now()) { entries.delete(key); return undefined; }
      return hit.value;
    },
    set(key: string, value: RouteResult): void {
      while (entries.size >= max) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
      entries.set(key, { value, expires: Date.now() + ttlMs });
    },
  };
}
export type RouteCache = ReturnType<typeof createRouteCache>;

// Request builders: the key travels only in the returned init object.
export function orsRequest(from: RoutePoint, to: RoutePoint, mode: RouteMode, key: string) {
  const profile = mode === "driving" ? "driving-car" : "foot-walking";
  return {
    url: `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
    init: {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[from.longitude, from.latitude], [to.longitude, to.latitude]] }),
    },
  };
}
export function mapboxRequest(from: RoutePoint, to: RoutePoint, mode: RouteMode, key: string) {
  const profile = mode === "driving" ? "driving" : "walking";
  const waypoints = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  return {
    url: `https://api.mapbox.com/directions/v5/mapbox/${profile}/${waypoints}?${new URLSearchParams({ access_token: key, geometries: "geojson", overview: "full" })}`,
    init: { method: "GET" },
  };
}
function parseLngLatList(value: unknown): [number, number][] {
  if (!Array.isArray(value) || value.length < 2 || value.length > ROUTE_POINT_LIMIT) throw new Error("INVALID_ROUTE_RESPONSE");
  return value.map((pair) => {
    if (!Array.isArray(pair) || typeof pair[0] !== "number" || typeof pair[1] !== "number" ||
      !Number.isFinite(pair[0]) || !Number.isFinite(pair[1]) || Math.abs(pair[1]) > 90 || Math.abs(pair[0]) > 180) throw new Error("INVALID_ROUTE_RESPONSE");
    return [pair[1], pair[0]] as [number, number];
  });
}
function parseSummary(distance: unknown, duration: unknown): { distanceM: number; durationS: number } {
  if (
    typeof distance !== "number" || !Number.isFinite(distance) || distance < 0 || distance > 2000000 ||
    typeof duration !== "number" || !Number.isFinite(duration) || duration < 0 || duration > 86400
  ) throw new Error("INVALID_ROUTE_RESPONSE");
  return { distanceM: distance, durationS: duration };
}
export function parseOrsRoute(payload: unknown, mode: RouteMode): RouteResult {
  const record = payload as { features?: { properties?: { summary?: { distance?: unknown; duration?: unknown } }; geometry?: { coordinates?: unknown } }[] };
  const feature = Array.isArray(record?.features) ? record.features[0] : undefined;
  if (!feature) throw new Error("INVALID_ROUTE_RESPONSE");
  const summary = parseSummary(feature.properties?.summary?.distance, feature.properties?.summary?.duration);
  return { ...summary, points: parseLngLatList(feature.geometry?.coordinates), attribution: ROUTING_ATTRIBUTION.ors, provider: "ors", mode };
}
export function parseMapboxRoute(payload: unknown, mode: RouteMode): RouteResult {
  const record = payload as { code?: unknown; routes?: { distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } }[] };
  if (record?.code !== "Ok") throw new Error("INVALID_ROUTE_RESPONSE");
  const route = Array.isArray(record.routes) ? record.routes[0] : undefined;
  if (!route) throw new Error("INVALID_ROUTE_RESPONSE");
  const summary = parseSummary(route.distance, route.duration);
  return { ...summary, points: parseLngLatList(route.geometry?.coordinates), attribution: ROUTING_ATTRIBUTION.mapbox, provider: "mapbox", mode };
}
const routeDistanceText = (distanceM: number) => distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`;
export function formatRoadText(durationS: number, distanceM: number, mode: RouteMode): string {
  const minutes = Math.max(1, Math.round(durationS / 60));
  return `about ${minutes} min ${mode}, ${routeDistanceText(distanceM)} by road`;
}
