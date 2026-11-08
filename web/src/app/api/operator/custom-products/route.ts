import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { limitAuth } from "@/server/accounts";
import { verifyOperatorCode } from "@/lib/operator";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if(!process.env.DEMO_ACCESS_CODE?.trim())throw new ApiError(503,"OPERATOR_DISABLED");
    const body=await bodyObject(request);
    await limitAuth("operator","global",30);
    if(!verifyOperatorCode(body.accessCode))throw new ApiError(401,"INVALID_OPERATOR_CODE");
    const {rows}=await database().query(`SELECT p.id,p.name,p.brand,p.variant,p.size,p.unit,p.category,p.flag_reason,p.created_at,s.name AS shop_name
      FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.status='pending' ORDER BY p.created_at`);
    return json({pending:rows});
  } catch(error) {return failure(error);}
}
