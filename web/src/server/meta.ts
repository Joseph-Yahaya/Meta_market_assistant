import "server-only";
import { createMetaClient } from "@/lib/meta-client";
import { ApiError } from "./http";
export function metaClient() {
  if(process.env.ENABLE_META_CALLS!=="true" || !process.env.MODEL_API_KEY)throw new ApiError(503,"META_NOT_CONFIGURED");
  return createMetaClient({key:process.env.MODEL_API_KEY,baseUrl:process.env.META_API_BASE_URL,textModel:process.env.META_TEXT_MODEL,voiceModel:process.env.META_VOICE_MODEL,textProtocol:process.env.META_TEXT_PROTOCOL==="responses"?"responses":"chat"});
}
