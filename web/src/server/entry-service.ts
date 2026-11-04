import "server-only";
import { database } from "./db";
import { ApiError } from "./http";
import { sessionSecret } from "./auth";
import { signEntry, validateEntry, verifyEntry } from "@/lib/entries";
import { isUuid } from "@/lib/session";

export async function ownedShop(actor: string,shop: unknown) {
  if (!isUuid(shop)) throw new ApiError(400,"INVALID_SHOP");
  const result=await database().query("SELECT id FROM shops WHERE id=$1 AND owner_id=$2 AND simulated",[shop,actor]);
  if (!result.rows.length) throw new ApiError(403,"FORBIDDEN");
  return shop;
}
export async function prepareEntry(actor: string,shop: unknown,input: unknown) {
  const shopId=await ownedShop(actor,shop);
  let entry;
  try {entry=validateEntry(input);} catch(error) {throw new ApiError(400,(error as Error).message);}
  const {rows}=await database().query("SELECT id,name,brand,variant,size,unit,perishable FROM products WHERE id=$1",[entry.productId]);
  if (!rows.length) throw new ApiError(400,"UNKNOWN_PRODUCT");
  if (!rows[0].perishable && entry.expiryDate) throw new ApiError(400,"INVALID_EXPIRY");
  let expected: number|null=null;
  if (entry.action==="recount") {
    const batch=await database().query("SELECT estimated_qty FROM batch_stock WHERE batch_id=$1 AND shop_id=$2 AND product_id=$3",[entry.batchId,shopId,entry.productId]);
    if (!batch.rows.length) throw new ApiError(400,"INVALID_BATCH");
    expected=batch.rows[0].estimated_qty;
  }
  return {token:signEntry(actor,shopId,entry,expected,sessionSecret()),entry,product:rows[0],expiresInSeconds:600};
}
export async function confirmEntry(actor: string,token: unknown) {
  if (typeof token!=="string") throw new ApiError(400,"INVALID_CONFIRMATION");
  let pending;
  try {pending=verifyEntry(token,actor,sessionSecret());} catch(error) {throw new ApiError(409,(error as Error).message);}
  const {entry,shop,key}=pending,client=await database().connect();
  try {
    await client.query("BEGIN");
    const owner=await client.query("SELECT id FROM shops WHERE id=$1 AND owner_id=$2 AND simulated FOR UPDATE",[shop,actor]);
    if (!owner.rows.length) throw new ApiError(403,"FORBIDDEN");
    const previous=await client.query("SELECT result FROM stock_commands WHERE shop_id=$1 AND idempotency_key=$2 AND actor_id=$3",[shop,key,actor]);
    let result;
    if (previous.rows.length) result={...previous.rows[0].result,replayed:true};
    else {
      if (entry.action==="recount") {
        const before=await client.query("SELECT estimated_qty FROM batch_stock WHERE batch_id=$1 AND shop_id=$2 AND product_id=$3",[entry.batchId,shop,entry.productId]);
        if (!before.rows.length || before.rows[0].estimated_qty!==pending.expectedQty) throw new ApiError(409,"STOCK_CHANGED_REVIEW_AGAIN");
      }
      result=(await client.query("SELECT record_stock($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result",
        [actor,shop,entry.productId,key,entry.action,entry.quantity,entry.batchId,entry.expiryDate,entry.unitPriceKobo,entry.correctsEventId])).rows[0].result;
    }
    await client.query("COMMIT");
    return {...result,action:entry.action,quantity:entry.quantity};
  } catch(error) {await client.query("ROLLBACK");throw error;} finally {client.release();}
}
