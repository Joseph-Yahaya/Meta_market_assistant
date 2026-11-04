import { cookies } from "next/headers";
import { equalSecret, isUuid, signSession } from "@/lib/session";
import { database } from "@/server/db";
import { SESSION_COOKIE, sessionSecret } from "@/server/auth";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(404,"NOT_FOUND");
    requireSameOrigin(request);
    const body = await bodyObject(request);
    const code = process.env.DEMO_ACCESS_CODE;
    if (!code || code.length < 16) throw new ApiError(503,"DEMO_LOGIN_NOT_CONFIGURED");
    if (typeof body.accessCode !== "string" || !equalSecret(body.accessCode,code)) throw new ApiError(401,"INVALID_ACCESS_CODE");
    const db = database();
    if (!body.shopId) {
      const shops = await db.query("SELECT id,name FROM shops WHERE simulated ORDER BY name LIMIT 50");
      return json({simulated:true,shops:shops.rows});
    }
    if (!isUuid(body.shopId)) throw new ApiError(400,"INVALID_SHOP");
    const { rows } = await db.query("SELECT owner_id FROM shops WHERE id=$1 AND simulated",[body.shopId]);
    if (!rows.length) throw new ApiError(404,"SHOP_NOT_FOUND");
    const token = signSession(rows[0].owner_id,sessionSecret());
    (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"strict",path:"/",maxAge:8*3600});
    return json({simulated:true,shopId:body.shopId});
  } catch(error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try { requireSameOrigin(request); (await cookies()).delete(SESSION_COOKIE); return json({signedOut:true}); }
  catch(error) { return failure(error); }
}
