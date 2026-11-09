import { buyerIdentity } from "@/server/buyer-service";
import { limitAuth, limitModelCall } from "@/server/accounts";
import { metaClient } from "@/server/meta";
import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { planSearch, requireAiConsent, validateAiChoice, validateAiQuery } from "@/lib/buyer-ai";
import { catalogWords, matchCatalogProducts } from "@/lib/catalog-match";
export const runtime = "nodejs";
// Local matching runs first; the AI only sees no-match and ambiguous
// queries from buyers who consented. The raw query is never stored or
// logged here: only validated catalog IDs leave this route.
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { visitor } = await buyerIdentity();
    const body = await bodyObject(request);
    let query: string;
    try {
      query = validateAiQuery(body.query);
      requireAiConsent(body.consent);
    } catch (error) { throw new ApiError(400, (error as Error).message); }
    await limitAuth("buyer-ai", visitor, 30);
    const catalog = (await database().query(
      "SELECT p.id,p.name,p.brand,p.variant,p.size,p.unit,p.category,p.perishable,p.status FROM products p WHERE p.status='approved' ORDER BY p.brand,p.name,p.size,p.id LIMIT 1000"
    )).rows;
    const plan = planSearch(query, catalog, matchCatalogProducts, catalogWords);
    if (plan.action === "local") {
      return json({ source: "local", products: catalog.filter((row: { id: string }) => plan.productIds.includes(row.id)), notInCatalog: null });
    }
    if (plan.action === "not-in-catalog") {
      return json({ source: "local", products: [], notInCatalog: { idea: null } });
    }
    const fallback = () => catalog.filter((row: { id: string }) => plan.localIds.includes(row.id));
    try {
      await limitModelCall("buyer-ai", visitor);
    } catch (error) {
      if (error instanceof ApiError && error.code === "DAILY_LIMIT_REACHED") {
        return json({ source: "local", capped: true, products: fallback(), notInCatalog: null });
      }
      throw error;
    }
    let choice;
    try {
      choice = await metaClient().interpretQuery(query, plan.candidates);
    } catch {
      return json({ source: "local", unavailable: true, products: fallback(), notInCatalog: plan.localIds.length ? null : { idea: null } });
    }
    let validated;
    try {
      validated = validateAiChoice(choice, plan.candidates.map((row) => row.id));
    } catch (error) { throw new ApiError(502, (error as Error).message); }
    return json({
      source: "ai",
      products: catalog.filter((row: { id: string }) => validated.productIds.includes(row.id)),
      notInCatalog: validated.notInCatalog ? { idea: validated.idea } : null,
    });
  } catch (error) { return failure(error); }
}
