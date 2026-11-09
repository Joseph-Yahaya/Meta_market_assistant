import { buyerIdentity } from "@/server/buyer-service";
import { limitAuth } from "@/server/accounts";
import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { readBuyer } from "@/lib/buyer";
import { validateDemandIdea } from "@/lib/custom-products";
import { demandCellId } from "@/lib/demand";
import { DEMAND_PURGE_SIGNALS_SQL } from "@/lib/demand-sql";
import { purgeDemandPhotos, recordDemandSignal } from "@/server/demand-service";
export const runtime = "nodejs";
// Counts validated not-in-catalog ideas only. The idea arrives in a signed
// token from the interpret route, so a client cannot invent keys. Catalog
// products are counted automatically by buyer search instead. The raw query
// is never accepted or stored here.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { secret, visitor } = await buyerIdentity();
    const body = await bodyObject(request);
    await limitAuth("buyer-demand", visitor, 60);
    const { latitude, longitude } = body;
    if (typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90
      || typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new ApiError(400, "INVALID_SEARCH");
    }
    let idea: string;
    try {
      const token = readBuyer("buyer-idea", body.ideaToken, secret);
      if (token.visitor !== visitor || typeof token.idea !== "string") throw new Error("INVALID_DEMAND_IDEA");
      idea = validateDemandIdea(token.idea);
    } catch (error) {
      const code = (error as Error).message;
      throw new ApiError(400, code === "REGULATED_PRODUCT" ? "REGULATED_PRODUCT" : "INVALID_DEMAND_IDEA");
    }
    const db = database();
    await db.query(DEMAND_PURGE_SIGNALS_SQL);
    await purgeDemandPhotos(db);
    await recordDemandSignal(db, { kind: "idea", key: idea, cell: demandCellId(latitude, longitude), visitor });
    return json({ recorded: true });
  } catch (error) { return failure(error); }
}
