import { buyerIdentity } from "@/server/buyer-service";
import { limitAuth, limitModelCall } from "@/server/accounts";
import { readVoiceAudio } from "@/server/audio-request";
import { metaClient } from "@/server/meta";
import { failure,json,requireSameOrigin } from "@/server/http";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);const {visitor}=await buyerIdentity(),client=metaClient();
    const audio=await readVoiceAudio(request);await limitAuth("buyer-voice",visitor,10);await limitModelCall("buyer-voice",visitor);
    return json({transcript:await client.transcribe(audio),requiresVariantSelection:true});
  }catch(error){return failure(error);}
}
