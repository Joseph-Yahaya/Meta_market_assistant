import "server-only";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import { ApiError } from "./http";
export const SESSION_COOKIE = "market_owner_session";
export function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503,"SESSION_NOT_CONFIGURED");
  return secret;
}
export async function requireActor() {
  if (process.env.DEMO_MODE !== "true") throw new ApiError(503,"DEMO_AUTH_DISABLED");
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) throw new ApiError(401,"SIGN_IN_REQUIRED");
  const actor = verifySession(cookie,sessionSecret());
  if (!actor) throw new ApiError(401,"SESSION_EXPIRED");
  return actor;
}
