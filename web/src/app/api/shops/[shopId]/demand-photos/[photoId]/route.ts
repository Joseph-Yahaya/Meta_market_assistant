import { readFile } from "node:fs/promises";
import { requireActor } from "@/server/auth";
import { ownedShop } from "@/server/entry-service";
import { database } from "@/server/db";
import { ApiError, failure, requireSameOrigin } from "@/server/http";
import { isUuid } from "@/lib/session";
import { DEMAND_SETTINGS, demandCellId, neighborCells } from "@/lib/demand";
import { demandGroupVisitors, demandPhotoPath } from "@/server/demand-service";
export const runtime = "nodejs";
type Context = { params: Promise<{ shopId: string; photoId: string }> };
// Serves one alert photo to the owning trader only while its group is at
// or above the threshold. Anything else is a 404, same as a missing photo.
export async function GET(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const shop = await ownedShop(await requireActor(), (await context.params).shopId);
    const { photoId } = await context.params;
    if (!isUuid(photoId)) throw new ApiError(404, "PHOTO_MISSING");
    const db = database();
    const found = (await db.query(
      "SELECT demand_kind, demand_key, cell_id, path FROM demand_photos WHERE id=$1 AND status='active' AND expires_at>now()",
      [photoId],
    )).rows[0];
    if (!found) throw new ApiError(404, "PHOTO_MISSING");
    const shopRow = (await db.query("SELECT latitude, longitude FROM shops WHERE id=$1", [shop])).rows[0];
    if (!shopRow || !neighborCells(demandCellId(shopRow.latitude, shopRow.longitude)).includes(found.cell_id)) {
      throw new ApiError(404, "PHOTO_MISSING");
    }
    const visitors = await demandGroupVisitors(db, found.demand_kind, found.demand_key, found.cell_id);
    if (visitors < DEMAND_SETTINGS.visitorThreshold) throw new ApiError(404, "PHOTO_MISSING");
    const bytes = await readFile(demandPhotoPath(found.path)).catch(() => null);
    if (!bytes) throw new ApiError(404, "PHOTO_MISSING");
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
