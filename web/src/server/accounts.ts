import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "./db";
import { ApiError } from "./http";
import { SESSION_COOKIE, sessionSecret } from "./auth";
import { signSession } from "@/lib/session";
import { dailyCapFor, dailyDateKey, type ModelScope } from "@/lib/model-limits";

export function requireDemoAccounts() {
  if (process.env.DEMO_MODE!=="true") throw new ApiError(503,"DEMO_ACCOUNTS_DISABLED");
}
export async function limitAuth(scope: string, identifier: string, limit: number) {
  const key=createHash("sha256").update(`${scope}:${identifier}`).digest("hex");
  const {rows}=await database().query(`INSERT INTO auth_rate_limits(key,attempts,expires_at)
    VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN auth_rate_limits.expires_at<=now() THEN 1 ELSE auth_rate_limits.attempts+1 END,
    expires_at=CASE WHEN auth_rate_limits.expires_at<=now() THEN now()+interval '15 minutes' ELSE auth_rate_limits.expires_at END
    RETURNING attempts`,[key]);
  if (rows[0].attempts>limit) throw new ApiError(429,"TOO_MANY_ATTEMPTS");
  // Bounded counter maintenance; no raw credentials are logged.
  await database().query("DELETE FROM auth_rate_limits WHERE expires_at<now()-interval '1 day'");
}
export async function limitDaily(scope: string, identifier: string, limit: number) {
  const day = dailyDateKey();
  const key = createHash("sha256").update(`daily:${day}:${scope}:${identifier}`).digest("hex");
  const { rows } = await database().query(
    `INSERT INTO auth_rate_limits(key,attempts,expires_at)
    VALUES($1,1,(date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC')
    ON CONFLICT(key) DO UPDATE SET attempts = auth_rate_limits.attempts + 1
    RETURNING attempts`,
    [key],
  );
  if (rows[0].attempts > limit) throw new ApiError(429, "DAILY_LIMIT_REACHED");
}
// Per-account/visitor daily cap plus an overall daily ceiling. Counts only, never content.
export async function limitModelCall(scope: ModelScope, identifier: string) {
  await limitDaily(scope, identifier, dailyCapFor(scope));
  await limitDaily("model-global", "all", dailyCapFor("global"));
}
export async function setOwnerCookie(actor: string) {
  const token=signSession(actor,sessionSecret());
  (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:8*3600});
}
