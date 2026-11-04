import { requireActor } from "@/server/auth";
import { confirmEntry } from "@/server/entry-service";
import { bodyObject, failure, json, requireSameOrigin } from "@/server/http";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {requireSameOrigin(request);const actor=await requireActor(),body=await bodyObject(request);return json(await confirmEntry(actor,body.token));}
  catch(error) {return failure(error);}
}
