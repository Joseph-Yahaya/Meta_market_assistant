import { requireActor } from "@/server/auth";
import { undoEntry } from "@/server/undo-service";
import { bodyObject, failure, json, requireSameOrigin } from "@/server/http";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {requireSameOrigin(request);const actor=await requireActor(),body=await bodyObject(request);return json(await undoEntry(actor,body.shopId,body.commandId));}
  catch(error) {return failure(error);}
}
