import { database } from "@/server/db";
import { ApiError, failure, json } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url), query=(url.searchParams.get("q") || "").trim().toLowerCase();
    if (query.length > 120) throw new ApiError(400,"QUERY_TOO_LONG");
    const offset = Number(url.searchParams.get("offset") || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new ApiError(400,"INVALID_OFFSET");
    const { rows } = await database().query(`SELECT p.id,p.name,p.brand,p.variant,p.size,p.unit,p.category,p.perishable
      FROM products p WHERE $1 = '' OR strpos(lower(concat_ws(' ',p.brand,p.name,p.variant,p.size)),$1)>0
      OR EXISTS (SELECT 1 FROM product_aliases a WHERE a.product_id=p.id AND strpos(a.alias,$1)>0)
      ORDER BY p.brand,p.name,p.size,p.id LIMIT 51 OFFSET $2`,[query,offset]);
    return json({products:rows.slice(0,50),nextOffset:rows.length>50?offset+50:null});
  } catch(error) { return failure(error); }
}
