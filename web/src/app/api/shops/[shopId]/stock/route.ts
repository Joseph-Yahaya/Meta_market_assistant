import { isUuid } from "@/lib/session";
import { requireActor } from "@/server/auth";
import { database } from "@/server/db";
import { ApiError, failure, json } from "@/server/http";
export const runtime = "nodejs";
type Context = {params:Promise<{shopId:string}>};
export async function GET(_request: Request, context: Context) {
  try {
    const actor=await requireActor(), {shopId}=await context.params;
    if (!isUuid(shopId)) throw new ApiError(400,"INVALID_SHOP");
    const db=database();
    const owner=await db.query("SELECT id FROM shops WHERE id=$1 AND owner_id=$2 AND simulated",[shopId,actor]);
    if (!owner.rows.length) throw new ApiError(403,"FORBIDDEN");
    const {rows}=await db.query(`SELECT b.batch_id,b.product_id,p.name,p.brand,p.variant,p.size,p.unit,
      b.expiry_date,b.estimated_qty,b.confirmed_at FROM batch_stock b JOIN products p ON p.id=b.product_id
      WHERE b.shop_id=$1 ORDER BY p.name,b.expiry_date ASC NULLS LAST,b.batch_id LIMIT 1000`,[shopId]);
    const events=await db.query(`SELECT e.id,e.product_id,e.batch_id,e.qty_delta,e.event_type,e.event_at,
      p.name,p.brand,p.size,p.unit FROM stock_events e JOIN products p ON p.id=e.product_id
      WHERE e.shop_id=$1 ORDER BY e.recorded_at DESC,e.id DESC LIMIT 12`,[shopId]);
    return json({shopId,stock:rows,events:events.rows});
  } catch(error) { return failure(error); }
}
export async function POST() {
  return json({error:{code:"CONFIRMATION_REQUIRED",message:"Review an entry before confirming it through the entry confirmation endpoint."}},405);
}