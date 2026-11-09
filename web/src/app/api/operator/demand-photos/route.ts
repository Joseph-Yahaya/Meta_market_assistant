import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { limitAuth } from "@/server/accounts";
import { verifyOperatorCode } from "@/lib/operator";
export const runtime = "nodejs";
// Owner moderation list for demand photos. Shows photo status only, never
// visitor counts, so sub-threshold demand still leaks nothing.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!process.env.DEMO_ACCESS_CODE?.trim()) throw new ApiError(503, "OPERATOR_DISABLED");
    const body = await bodyObject(request);
    await limitAuth("operator", "global", 30);
    if (!verifyOperatorCode(body.accessCode)) throw new ApiError(401, "INVALID_OPERATOR_CODE");
    const { rows } = await database().query(
      `SELECT p.id, p.demand_kind AS kind, p.demand_key AS key, p.cell_id AS cell, p.status, p.created_at,
        CASE WHEN p.demand_kind = 'product'
          THEN (SELECT concat_ws(' ', pr.brand, pr.name, pr.size) FROM products pr WHERE pr.id = p.demand_key::uuid)
          ELSE p.demand_key END AS label
       FROM demand_photos p WHERE p.status <> 'expired' ORDER BY p.created_at DESC LIMIT 50`
    );
    return json({ photos: rows });
  } catch (error) { return failure(error); }
}
