import { DISCOVERY_SQL, longitudeSpan } from "@/lib/discovery";
import { isUuid } from "@/lib/session";
import { database } from "@/server/db";
import { ApiError, failure, json } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(404,"DEMO_DISCOVERY_DISABLED");
    const params=new URL(request.url).searchParams;
    const product=params.get("productId"), latText=params.get("lat"), lngText=params.get("lng");
    const lat=Number(latText),lng=Number(lngText),radius=Number(params.get("radiusKm")??5),offset=Number(params.get("offset")??0);
    if (!isUuid(product) || !latText?.trim() || !lngText?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !Number.isFinite(radius) || radius<=0 || radius>50
      || !Number.isInteger(offset) || offset<0 || offset>10000) throw new ApiError(400,"INVALID_SEARCH");
    const {rows}=await database().query(DISCOVERY_SQL,[product,lat,lng,radius,offset,longitudeSpan(lat,radius)]);
    // Price, phone, owner identity, exact stock and private events are never selected.
    return json({simulated:true,availability:"estimated",distanceType:"straight-line",shops:rows.slice(0,50),nextOffset:rows.length>50?offset+50:null});
  } catch(error) { return failure(error); }
}
