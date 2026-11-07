import { requireActor } from "@/server/auth";
import { ownedShop } from "@/server/entry-service";
import { ApiError, failure, json, requireSameOrigin } from "@/server/http";
import { metaClient } from "@/server/meta";
import { limitAuth, limitModelCall } from "@/server/accounts";
import { MAX_AUDIO_BYTES, validateWav } from "@/lib/audio";
import { buildVoiceKeywords } from "@/lib/voice-keywords";
import { database } from "@/server/db";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);const actor=await requireActor();
    await ownedShop(actor,new URL(request.url).searchParams.get("shopId"));
    const client=metaClient();
    if(!request.headers.get("content-type")?.startsWith("audio/wav"))throw new ApiError(415,"WAV_REQUIRED");
    const reader=request.body?.getReader();if(!reader)throw new ApiError(400,"AUDIO_REQUIRED");
    const chunks:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_AUDIO_BYTES){await reader.cancel();throw new ApiError(413,"AUDIO_TOO_LARGE");}chunks.push(value);}
    const audio=Buffer.concat(chunks);
    try {validateWav(audio);} catch(error) {throw new ApiError(400,(error as Error).message);}
    await limitAuth("transcribe",actor,20);await limitModelCall("transcribe",actor);
    // In-memory only: no filesystem, database audio, request-body logging or storage upload.
    const catalog=await database().query("SELECT brand, name FROM products LIMIT 200");
    const keywords=buildVoiceKeywords(catalog.rows.map(r=>r.brand),catalog.rows.map(r=>r.name));
    return json({transcript:await client.transcribe(audio,{keywords}),requiresReview:true});
  } catch(error) {return failure(error);}
}
