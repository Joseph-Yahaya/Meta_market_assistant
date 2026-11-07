import { requireActor } from "@/server/auth";
import { ownedShop } from "@/server/entry-service";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { metaClient } from "@/server/meta";
import { limitAuth, limitModelCall } from "@/server/accounts";
import { applyActionPreset, type PresetAction } from "@/lib/entry-text";
export const runtime="nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);const actor=await requireActor(),body=await bodyObject(request);
    await ownedShop(actor,body.shopId);
    if(typeof body.text!=="string" || !body.text.trim() || body.text.length>2000)throw new ApiError(400,"INVALID_TEXT");
    const presetRaw:unknown=body.actionPreset;
    if(presetRaw!==null&&presetRaw!==undefined&&!["sale","restock","recount"].includes(presetRaw as string))throw new ApiError(400,"INVALID_ACTION_PRESET");
    const preset:PresetAction|null=(presetRaw??null) as PresetAction|null;
    const client=metaClient();await limitAuth("interpret",actor,30);await limitModelCall("interpret",actor);
    let extraction=await client.extract(body.text);
    if(preset){
      const applied=applyActionPreset(extraction.action,preset);
      extraction={...extraction,action:applied.action};
      if(applied.conflict)extraction={...extraction,needsClarification:true,question:`You chose ${preset} but this sounds like ${applied.conflict}. Which action did you mean?`};
      else if(extraction.quantity!==null&&extraction.item.trim())extraction={...extraction,needsClarification:false,question:null};
    }
    return json({extraction,requiresConfirmation:true});
  } catch(error) {return failure(error);}
}
