import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { limitAuth, requireDemoAccounts, setOwnerCookie } from "@/server/accounts";
import { sessionSecret } from "@/server/auth";
import { checkPassword, hashPassword, normalizeEmail, validPassword } from "@/lib/passwords";
export const runtime="nodejs";
let dummyHash: Promise<string> | undefined;
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); requireDemoAccounts(); sessionSecret();
    const body=await bodyObject(request);
    let email: string;
    try { email=normalizeEmail(body.email); } catch { throw new ApiError(401,"INVALID_LOGIN"); }
    if (!validPassword(body.password)) throw new ApiError(401,"INVALID_LOGIN");
    await limitAuth("login-global","demo",150);
    await limitAuth("login-email",email,8);
    const {rows}=await database().query(`SELECT c.trader_id,c.password_hash FROM trader_credentials c
      JOIN traders t ON t.id=c.trader_id WHERE c.email=$1 AND t.simulated`,[email]);
    dummyHash??=hashPassword("not-a-real-account-password");
    const valid=await checkPassword(body.password,rows[0]?.password_hash??await dummyHash);
    if (!rows.length || !valid) throw new ApiError(401,"INVALID_LOGIN");
    await setOwnerCookie(rows[0].trader_id);
    return json({signedIn:true,simulated:true});
  } catch(error) { return failure(error); }
}
