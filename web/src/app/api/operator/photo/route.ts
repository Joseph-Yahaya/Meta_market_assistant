import { readFile } from "node:fs/promises";
import path from "node:path";
import { database } from "@/server/db";
import { ApiError, bodyObject, failure, requireSameOrigin } from "@/server/http";
import { limitAuth } from "@/server/accounts";
import { verifyOperatorCode } from "@/lib/operator";
import { isUuid } from "@/lib/session";
export const runtime="nodejs";
const UPLOAD_DIR=path.join(process.cwd(),".local-uploads");
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if(!process.env.DEMO_ACCESS_CODE?.trim())throw new ApiError(503,"OPERATOR_DISABLED");
    const body=await bodyObject(request);
    await limitAuth("operator","global",30);
    if(!verifyOperatorCode(body.accessCode))throw new ApiError(401,"INVALID_OPERATOR_CODE");
    if(!isUuid(body.productId))throw new ApiError(400,"INVALID_REVIEW");
    const found=await database().query("SELECT photo_path FROM products WHERE id=$1",[body.productId]);
    const filename=found.rows[0]?.photo_path;
    if(typeof filename!=="string"||!/^[0-9a-f-]{36}\.jpg$/.test(filename))throw new ApiError(404,"PHOTO_MISSING");
    const bytes=await readFile(path.join(UPLOAD_DIR,filename)).catch(()=>null);
    if(!bytes)throw new ApiError(404,"PHOTO_MISSING");
    return new Response(bytes,{headers:{"Content-Type":"image/jpeg","Cache-Control":"no-store"}});
  } catch(error) {return failure(error);}
}
