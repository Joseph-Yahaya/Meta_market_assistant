import { requireActor } from "@/server/auth";
import { prepareEntry } from "@/server/entry-service";
import { bodyObject, failure, json, requireSameOrigin } from "@/server/http";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {requireSameOrigin(request);const actor=await requireActor(),body=await bodyObject(request);return json(await prepareEntry(actor,body.shopId,body.entry));}
  catch(error) {return failure(error);}
}
