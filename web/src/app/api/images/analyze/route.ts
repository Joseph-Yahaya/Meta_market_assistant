import { requireActor } from "@/server/auth";
import { ApiError, failure, json, requireSameOrigin } from "@/server/http";
import { metaClient } from "@/server/meta";
import { limitAuth, limitModelCall } from "@/server/accounts";
import { MAX_IMAGE_BYTES, stripImageMetadata, validateImageBytes } from "@/lib/image";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor=await requireActor();
    if(!request.headers.get("content-type")?.startsWith("image/"))throw new ApiError(415,"IMAGE_REQUIRED");
    const reader=request.body?.getReader();if(!reader)throw new ApiError(400,"IMAGE_REQUIRED");
    const chunks:Uint8Array[]=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_IMAGE_BYTES){await reader.cancel();throw new ApiError(413,"IMAGE_TOO_LARGE");}chunks.push(value);}
    const bytes=Buffer.concat(chunks);
    let type;
    try {type=validateImageBytes(bytes).type;}
    catch(error){const code=(error as Error).message;throw new ApiError(code==="IMAGE_TOO_LARGE"?413:400,code);}
    await limitAuth("image",actor,20);await limitModelCall("image",actor);
    // In-memory only: metadata is stripped, nothing is stored, originals are discarded.
    let clean:Uint8Array;
    try {clean=stripImageMetadata(bytes,type);}
    catch(error){throw new ApiError(400,(error as Error).message);}
    const mime=type==="jpeg"?"image/jpeg":type==="png"?"image/png":"image/webp";
    const proposal=await metaClient().analyzeImage(clean,mime);
    if(!proposal.isProduct)throw new ApiError(400,"NOT_A_PRODUCT");
    return json({proposal,requiresConfirmation:true});
  } catch(error) {return failure(error);}
}
