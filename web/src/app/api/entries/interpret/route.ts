import { requireActor } from "@/server/auth";
import { ownedShop } from "@/server/entry-service";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { metaClient } from "@/server/meta";
import { limitAuth } from "@/server/accounts";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);const actor=await requireActor(),body=await bodyObject(request);
    await ownedShop(actor,body.shopId);
    if(typeof body.text!=="string" || !body.text.trim() || body.text.length>2000)throw new ApiError(400,"INVALID_TEXT");
    const client=metaClient();await limitAuth("interpret",actor,30);
    return json({extraction:await client.extract(body.text),requiresConfirmation:true});
  } catch(error) {return failure(error);}
}
