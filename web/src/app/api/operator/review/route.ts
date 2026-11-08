import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { limitAuth } from "@/server/accounts";
import { verifyOperatorCode } from "@/lib/operator";
import { isUuid } from "@/lib/session";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if(!process.env.DEMO_ACCESS_CODE?.trim())throw new ApiError(503,"OPERATOR_DISABLED");
    const body=await bodyObject(request);
    await limitAuth("operator","global",30);
    if(!verifyOperatorCode(body.accessCode))throw new ApiError(401,"INVALID_OPERATOR_CODE");
    if(!isUuid(body.productId)||typeof body.approve!=="boolean")throw new ApiError(400,"INVALID_REVIEW");
    const done=await database().query("UPDATE products SET status=$1 WHERE id=$2 AND status='pending' RETURNING id,status",
      [body.approve?"approved":"rejected",body.productId]);
    if(!done.rows.length)throw new ApiError(409,"NOT_PENDING");
    return json({productId:done.rows[0].id,status:done.rows[0].status});
  } catch(error) {return failure(error);}
}
