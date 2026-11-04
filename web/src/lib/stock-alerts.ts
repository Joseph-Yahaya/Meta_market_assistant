export type AlertBatch={batch_id:string;product_id:string;label:string;unit:string;perishable:boolean;expiry_date:string|null;estimated_qty:number;confirmed_at:string|null};
export type AlertSettings={lowStock:number;expiryDays:number;enabled:boolean};
export type StockAlert={id:string;kind:string;label:string;message:string};
export function watDay(now=new Date()) {return new Date(now.getTime()+3600000).toISOString().slice(0,10);}
export function stockAlerts(batches:AlertBatch[],settings:AlertSettings,now=new Date()):StockAlert[] {
  if(!settings.enabled)return [];
  const today=watDay(now), end=new Date(Date.parse(today)+settings.expiryDays*86400000).toISOString().slice(0,10);
  const alerts:StockAlert[]=[],products=new Map<string,{label:string;unit:string;qty:number}>();
  for(const b of batches){
    const expiry=b.expiry_date?.slice(0,10), expired=Boolean(expiry&&expiry<today);
    const p=products.get(b.product_id)||{label:b.label,unit:b.unit,qty:0};
    if(!expired)p.qty+=Math.max(0,b.estimated_qty);
    products.set(b.product_id,p);
    if(b.estimated_qty<=0)continue;
    if(expired)alerts.push({id:`expired:${b.batch_id}`,kind:"Expired — do not sell",label:b.label,message:`Expiry ${expiry}. Separate this batch and review disposal or return options. It is excluded from sellable stock.`});
    else if(b.perishable&&expiry&&expiry<=end)alerts.push({id:`expiry:${b.batch_id}`,kind:"Expiry approaching",label:b.label,message:`Estimated ${b.estimated_qty} ${b.unit}s expire ${expiry}. Check the date and condition; prioritise this batch only while safe and in date. No price change has been made.`});
    else if(b.perishable&&!expiry)alerts.push({id:`missing:${b.batch_id}`,kind:"Check expiry",label:b.label,message:"No expiry date recorded. Inspect the batch before making a clearance decision."});
    if(!b.confirmed_at||now.getTime()-Date.parse(b.confirmed_at)>72*3600000)alerts.push({id:`recount:${b.batch_id}`,kind:"Recount needed",label:b.label,message:"The last physical count is missing or over 72 hours old. A recent sale does not confirm the remaining count."});
  }
  for(const [id,p] of products)if(p.qty<=settings.lowStock)alerts.push({id:`low:${id}`,kind:"Low stock",label:p.label,message:`Estimated ${p.qty} ${p.unit}s available; threshold ${settings.lowStock}. Recount before deciding to restock.`});
  return alerts;
}
