import { buyerInteraction } from "@/server/buyer-service";
import { bodyObject,failure,json,requireSameOrigin } from "@/server/http";
export const runtime="nodejs";
export async function POST(request:Request) {
  try{requireSameOrigin(request);return json(await buyerInteraction(await bodyObject(request)));}catch(error){return failure(error);}
}
