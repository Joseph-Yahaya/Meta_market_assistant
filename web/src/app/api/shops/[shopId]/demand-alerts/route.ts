import { requireActor } from "@/server/auth";
import { ownedShop } from "@/server/entry-service";
import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { isRegulatedProduct } from "@/lib/custom-products";
import {
  DEMAND_SETTINGS,
  dedupeAlertsByKey,
  demandCellId,
  filterStockedAlerts,
  neighborCells,
} from "@/lib/demand";
import { DEMAND_GROUP_SQL, DEMAND_SIMULATED_SQL, DEMAND_STOCKED_SQL } from "@/lib/demand-sql";
import { purgeDemandPhotos, purgeDemandSignals } from "@/server/demand-service";
export const runtime = "nodejs";
type Context = { params: Promise<{ shopId: string }> };
// Demand alerts for one opted-in shop: nearby groups at or above the
// threshold, products the shop does not stock, one alert per key per day.
// Sub-threshold groups never leave this route; regulated ideas are refused
// at count time and rechecked here.
export async function GET(_request: Request, context: Context) {
  try {
    const shop = await ownedShop(await requireActor(), (await context.params).shopId);
    const db = database();
    const shopRow = (await db.query("SELECT latitude, longitude, demand_alerts FROM shops WHERE id=$1", [shop])).rows[0];
    if (!shopRow?.demand_alerts) return json({ simulated: true, enabled: false, alerts: [] });
    await purgeDemandPhotos(db);
    await purgeDemandSignals(db);
    const ownCell = demandCellId(shopRow.latitude, shopRow.longitude);
    const cells = neighborCells(ownCell);
    const real = (await db.query(DEMAND_GROUP_SQL, [cells, DEMAND_SETTINGS.visitorThreshold])).rows.map((row) => ({
      kind: row.kind, key: row.demand_key, cell: row.cell, visitors: row.visitors, simulated: false,
    }));
    const sim = (await db.query(DEMAND_SIMULATED_SQL, [cells, DEMAND_SETTINGS.visitorThreshold])).rows.map((row) => ({
      kind: row.kind, key: row.demand_key, cell: row.cell, visitors: row.visitors, simulated: true,
    }));
    const productKeys = [...new Set([...real, ...sim].filter((group) => group.kind === "product").map((group) => group.key))];
    const labels = productKeys.length
      ? (await db.query("SELECT id, brand, name, variant, size FROM products WHERE id = ANY($1)", [productKeys])).rows
      : [];
    const labelOf = new Map(labels.map((row) => [row.id, `${row.brand} ${row.name} · ${row.variant} · ${row.size}`]));
    const clean = [...real, ...sim].filter(
      (group) => group.kind !== "idea" || !isRegulatedProduct({ name: group.key, brand: "", category: "" }),
    );
    const stocked = productKeys.length
      ? (await db.query(DEMAND_STOCKED_SQL, [shop, productKeys])).rows.map((row) => row.id)
      : [];
    const alerts = dedupeAlertsByKey(filterStockedAlerts(clean, stocked), ownCell);
    const photoRows = alerts.length
      ? (await db.query(
          "SELECT demand_kind AS kind, demand_key AS demand_key, id FROM demand_photos WHERE status='active' AND expires_at>now() AND cell_id = ANY($1)",
          [cells],
        )).rows
      : [];
    const photoOf = new Map<string, string>();
    for (const row of photoRows) {
      const key = `${row.kind}:${row.demand_key}`;
      if (!photoOf.has(key)) photoOf.set(key, row.id);
    }
    return json({
      simulated: true,
      enabled: true,
      alerts: alerts.map((alert) => ({
        kind: alert.kind,
        key: alert.key,
        label: alert.kind === "product" ? (labelOf.get(alert.key) ?? "Listed product") : alert.key,
        visitors: alert.visitors,
        simulated: alert.simulated,
        photoId: photoOf.get(`${alert.kind}:${alert.key}`) ?? null,
      })),
    });
  } catch (error) { return failure(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    requireSameOrigin(request);
    const shop = await ownedShop(await requireActor(), (await context.params).shopId);
    const body = await bodyObject(request);
    if (typeof body.enabled !== "boolean") throw new ApiError(400, "INVALID_DEMAND_SETTINGS");
    await database().query("UPDATE shops SET demand_alerts=$1 WHERE id=$2", [body.enabled, shop]);
    return json({ enabled: body.enabled });
  } catch (error) { return failure(error); }
}
