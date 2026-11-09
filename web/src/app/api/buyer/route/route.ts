import { buyerIdentity } from "@/server/buyer-service";
import { database } from "@/server/db";
import { requestRoute } from "@/server/route-service";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import * as routing from "@/lib/routing";
import { verifyFeedbackTicket } from "@/lib/buyer";
import { dailyCapFor, dailyDateKey } from "@/lib/model-limits";
import { createRouteCache } from "@/lib/routing";
export const runtime = "nodejs";
// Feature R part two: road route for one buyer tap. The buyer's pin and the
// shop location are used transiently for this request and never stored.
// Caps and provider failures fall back silently: the buyer keeps the
// straight-line distance, never an error. Keys never leave the server.
const sharedCache = createRouteCache(routing.ROUTE_CACHE_TTL_MS, routing.ROUTE_CACHE_MAX);
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { secret, visitor } = await buyerIdentity();
    const body = await bodyObject(request);
    const outcome = await requestRoute({
      db: database(), fetchImpl: fetch, env: process.env, cache: sharedCache, R: routing,
      caps: { routing: dailyCapFor("routing"), global: dailyCapFor("global") }, day: dailyDateKey(),
      rateLimit: routing.ROUTE_RATE_LIMIT, verifyTicket: (token) => verifyFeedbackTicket(token, secret, visitor),
      visitor, token: body.token, latitude: body.latitude, longitude: body.longitude, mode: body.mode,
    });
    return json(outcome);
  } catch (error) {
    if (error instanceof Error && (error.message === "DAILY_LIMIT_REACHED" || error.message === "TOO_MANY_ATTEMPTS")) {
      return json({ status: "unavailable" });
    }
    if (error instanceof Error && error.message === "INVALID_ROUTE") return failure(new ApiError(400, "INVALID_ROUTE"));
    if (error instanceof Error && error.message === "FEEDBACK_EXPIRED") return failure(new ApiError(409, "FEEDBACK_EXPIRED"));
    if (error instanceof Error && error.message === "INVALID_FEEDBACK") return failure(new ApiError(403, "INVALID_FEEDBACK"));
    return failure(error);
  }
}
