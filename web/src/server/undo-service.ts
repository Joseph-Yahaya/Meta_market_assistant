import "server-only";
import { database } from "./db";
import { ApiError } from "./http";
import { ownedShop } from "./entry-service";
import { planUndo, UNDO_WINDOW_SECONDS } from "@/lib/undo";
import { isUuid } from "@/lib/session";

// Short-window undo as compensating recounts: each original event row gets a
// recount restoring its batch to the pre-command estimate. History stays
// append-only; the reversal is new linked events, never an edit.
export async function undoEntry(actor: string, shop: unknown, commandId: unknown) {
  const shopId = await ownedShop(actor, shop);
  if (!isUuid(commandId)) throw new ApiError(400, "INVALID_COMMAND");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const owner = await client.query("SELECT id FROM shops WHERE id=$1 AND owner_id=$2 AND simulated FOR UPDATE", [shopId, actor]);
    if (!owner.rows.length) throw new ApiError(403, "FORBIDDEN");
    const cmd = await client.query("SELECT request FROM stock_commands WHERE id=$1 AND shop_id=$2", [commandId, shopId]);
    if (!cmd.rows.length) throw new ApiError(404, "UNKNOWN_COMMAND");
    const product = cmd.rows[0].request?.product;
    if (!isUuid(product)) throw new ApiError(409, "UNDO_BLOCKED");
    const events = (
      await client.query(
        'SELECT id, batch_id AS "batchId", qty_delta AS delta, recorded_at AS "recordedAt" FROM stock_events WHERE command_id=$1 ORDER BY batch_id',
        [commandId],
      )
    ).rows as { id: string; batchId: string; delta: number; recordedAt: string }[];
    if (!events.length) throw new ApiError(409, "UNDO_BLOCKED");
    const latest = Math.max(...events.map((e) => new Date(e.recordedAt).getTime()));
    if (Date.now() - latest > UNDO_WINDOW_SECONDS * 1000) throw new ApiError(409, "UNDO_EXPIRED");
    const newer = await client.query(
      "SELECT 1 FROM stock_events WHERE shop_id=$1 AND product_id=$2 AND command_id<>$3 AND recorded_at>=$4 LIMIT 1",
      [shopId, product, commandId, new Date(latest)],
    );
    if (newer.rows.length) throw new ApiError(409, "UNDO_BLOCKED");
    const stock = await client.query('SELECT batch_id AS "batchId", estimated_qty FROM batch_stock WHERE batch_id = ANY($1)', [
      events.map((e) => e.batchId),
    ]);
    const current: Record<string, number> = {};
    for (const row of stock.rows) current[row.batchId] = row.estimated_qty;
    let specs;
    try {
      specs = planUndo(
        events.map((e) => ({ id: e.id, batchId: e.batchId, delta: e.delta })),
        current,
      );
    } catch {
      throw new ApiError(409, "UNDO_BLOCKED");
    }
    let estimatedQty = 0;
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const done = (
        await client.query("SELECT record_stock($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result", [
          actor,
          shopId,
          product,
          `undo-${commandId}-${i}`,
          "recount",
          spec.quantity,
          spec.batchId,
          null,
          null,
          spec.correctsEventId,
        ])
      ).rows[0].result;
      estimatedQty = done.estimatedQty;
    }
    await client.query("COMMIT");
    return { undone: true, commandId, estimatedQty };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
