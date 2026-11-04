import { cookies } from "next/headers";
import { requireActor, SESSION_COOKIE } from "@/server/auth";
import { database } from "@/server/db";
import { failure, json, requireSameOrigin } from "@/server/http";
export const runtime="nodejs";
export async function GET() {
  try {
    const actor=await requireActor();
    const {rows}=await database().query("SELECT id,name,category,landmark,latitude,longitude,location_verified FROM shops WHERE owner_id=$1 AND simulated ORDER BY name",[actor]);
    return json({signedIn:true,simulated:true,shops:rows});
  } catch(error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {requireSameOrigin(request);(await cookies()).delete(SESSION_COOKIE);return json({signedOut:true});}
  catch(error) {return failure(error);}
}
