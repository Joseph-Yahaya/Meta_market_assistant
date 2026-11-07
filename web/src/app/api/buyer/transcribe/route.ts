import { buyerIdentity } from "@/server/buyer-service";
import { limitAuth, limitModelCall } from "@/server/accounts";
import { readVoiceAudio } from "@/server/audio-request";
import { metaClient } from "@/server/meta";
import { buildVoiceKeywords } from "@/lib/voice-keywords";
import { database } from "@/server/db";
import { failure,json,requireSameOrigin } from "@/server/http";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    requireSameOrigin(request);const {visitor}=await buyerIdentity(),client=metaClient();
    const audio=await readVoiceAudio(request);await limitAuth("buyer-voice",visitor,10);await limitModelCall("buyer-voice",visitor);
    const catalog=await database().query("SELECT brand, name FROM products LIMIT 200");
    const keywords=buildVoiceKeywords(catalog.rows.map(r=>r.brand),catalog.rows.map(r=>r.name));
    return json({transcript:await client.transcribe(audio,{keywords}),requiresVariantSelection:true});
  }catch(error){return failure(error);}
}
