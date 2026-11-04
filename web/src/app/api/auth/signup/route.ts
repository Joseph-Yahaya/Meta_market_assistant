import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { limitAuth, requireDemoAccounts, setOwnerCookie } from "@/server/accounts";
import { sessionSecret } from "@/server/auth";
import { hashPassword, normalizeEmail, validPassword } from "@/lib/passwords";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); requireDemoAccounts(); sessionSecret();
    const body=await bodyObject(request);
    let email: string;
    try { email=normalizeEmail(body.email); } catch { throw new ApiError(400,"INVALID_EMAIL"); }
    if (!validPassword(body.password)) throw new ApiError(400,"PASSWORD_MINIMUM_10_CHARACTERS");
    for (const field of ["ownerName","shopName","landmark"]) {
      if (typeof body[field]!=="string" || !(body[field] as string).trim() || (body[field] as string).length>120) throw new ApiError(400,"INVALID_SHOP_DETAILS");
    }
    if (body.demoNoticeAccepted!==true) throw new ApiError(400,"DEMO_NOTICE_REQUIRED");
    if (typeof body.latitude!=="number" || !Number.isFinite(body.latitude) || body.latitude< -90 || body.latitude>90
      || typeof body.longitude!=="number" || !Number.isFinite(body.longitude) || body.longitude< -180 || body.longitude>180) throw new ApiError(400,"INVALID_LOCATION");
    await limitAuth("signup-global","demo",30);
    const hash=await hashPassword(body.password),client=await database().connect();
    let actor: string,shopId: string;
    try {
      await client.query("BEGIN");
      const trader=await client.query("INSERT INTO traders(display_name,simulated) VALUES($1,true) RETURNING id",[(body.ownerName as string).trim()]);
      actor=trader.rows[0].id;
      await client.query("INSERT INTO trader_credentials(trader_id,email,password_hash) VALUES($1,$2,$3)",[actor,email,hash]);
      const shop=await client.query(`INSERT INTO shops(owner_id,name,category,latitude,longitude,landmark,simulated)
        VALUES($1,$2,'provisions',$3,$4,$5,true) RETURNING id`,[actor,(body.shopName as string).trim(),body.latitude,body.longitude,(body.landmark as string).trim()]);
      shopId=shop.rows[0].id;
      await client.query("COMMIT");
    } catch(error) {
      await client.query("ROLLBACK");
      if (error && typeof error==="object" && "code" in error && error.code==="23505") throw new ApiError(409,"ACCOUNT_CANNOT_BE_CREATED_TRY_LOGIN");
      throw error;
    } finally { client.release(); }
    await setOwnerCookie(actor);
    return json({simulated:true,shopId},201);
  } catch(error) { return failure(error); }
}
