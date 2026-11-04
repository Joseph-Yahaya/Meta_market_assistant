import "server-only";
import { MAX_AUDIO_BYTES,validateWav } from "@/lib/audio";
import { ApiError } from "./http";
export async function readVoiceAudio(request:Request) {
  if(!request.headers.get("content-type")?.startsWith("audio/wav"))throw new ApiError(415,"WAV_REQUIRED");
  const reader=request.body?.getReader();if(!reader)throw new ApiError(400,"AUDIO_REQUIRED");
  const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_AUDIO_BYTES){await reader.cancel();throw new ApiError(413,"AUDIO_TOO_LARGE");}chunks.push(value);}
  const audio=Buffer.concat(chunks);
  try{validateWav(audio);}catch(error){throw new ApiError(400,(error as Error).message);}
  return audio;
}
