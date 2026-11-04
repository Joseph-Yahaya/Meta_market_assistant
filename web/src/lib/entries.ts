import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export type StockEntry = {
  productId: string; action: "opening"|"sale"|"restock"|"recount"; quantity: number;
  batchId: string|null; expiryDate: string|null; unitPriceKobo: number|null; correctsEventId: string|null;
};
export type PendingEntry = {actor: string;shop: string;entry: StockEntry;key: string;expires: number;expectedQty: number|null};
const uuid=(v:unknown):v is string=>typeof v==="string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function validateEntry(value: unknown): StockEntry {
  if (!value || typeof value!=="object" || Array.isArray(value)) throw new Error("INVALID_ENTRY");
  const e=value as Record<string,unknown>;
  if (!uuid(e.productId) || !["opening","sale","restock","recount"].includes(String(e.action))
    || typeof e.quantity!=="number" || !Number.isSafeInteger(e.quantity) || e.quantity<0 || e.quantity>100000
    || (["sale","restock"].includes(String(e.action)) && e.quantity===0)) throw new Error("INVALID_ENTRY");
  if (e.batchId!=null && !uuid(e.batchId) || e.correctsEventId!=null && !uuid(e.correctsEventId)) throw new Error("INVALID_BATCH");
  if (e.unitPriceKobo!=null && (typeof e.unitPriceKobo!=="number" || !Number.isSafeInteger(e.unitPriceKobo) || e.unitPriceKobo<0 || e.unitPriceKobo>100000000000)) throw new Error("INVALID_PRICE");
  if (e.expiryDate!=null) {
    if (typeof e.expiryDate!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.expiryDate)) throw new Error("INVALID_DATE");
    const date=new Date(`${e.expiryDate}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==e.expiryDate) throw new Error("INVALID_DATE");
  }
  if (e.action==="recount") {
    if (!uuid(e.batchId) || e.expiryDate!=null || e.unitPriceKobo!=null) throw new Error("RECOUNT_REQUIRES_BATCH_ONLY");
  } else if (e.batchId!=null || e.correctsEventId!=null || e.action==="sale" && e.expiryDate!=null) throw new Error("INVALID_BATCH");
  return {productId:e.productId,action:e.action as StockEntry["action"],quantity:e.quantity,
    batchId:(e.batchId??null) as string|null,expiryDate:(e.expiryDate??null) as string|null,
    unitPriceKobo:(e.unitPriceKobo??null) as number|null,correctsEventId:(e.correctsEventId??null) as string|null};
}
export function signEntry(actor: string,shop: string,entry: StockEntry,expectedQty: number|null,secret: string,now=Date.now()) {
  if (secret.length<32 || !uuid(actor) || !uuid(shop)) throw new Error("INVALID_CONFIGURATION");
  const pending: PendingEntry={actor,shop,entry:validateEntry(entry),expectedQty,key:randomUUID(),expires:now+10*60000};
  const payload=Buffer.from(JSON.stringify(pending)).toString("base64url");
  return `${payload}.${createHmac("sha256",secret).update(`entry:${payload}`).digest("base64url")}`;
}
export function verifyEntry(token: string,actor: string,secret: string,now=Date.now()): PendingEntry {
  if (secret.length<32 || typeof token!=="string" || token.length>4096) throw new Error("INVALID_CONFIRMATION");
  const [payload,signature,...rest]=token.split(".");
  if (!payload || !signature || rest.length) throw new Error("INVALID_CONFIRMATION");
  const expected=createHmac("sha256",secret).update(`entry:${payload}`).digest();
  const supplied=Buffer.from(signature,"base64url");
  if (supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) throw new Error("INVALID_CONFIRMATION");
  let p: PendingEntry;
  try {p=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));} catch {throw new Error("INVALID_CONFIRMATION");}
  if (p.actor!==actor || !uuid(p.shop) || !uuid(p.key) || !Number.isSafeInteger(p.expires)) throw new Error("INVALID_CONFIRMATION");
  if (p.expires<=now) throw new Error("CONFIRMATION_EXPIRED");
  if (p.expires>now+10*60000) throw new Error("INVALID_CONFIRMATION");
  p.entry=validateEntry(p.entry);
  return p;
}
