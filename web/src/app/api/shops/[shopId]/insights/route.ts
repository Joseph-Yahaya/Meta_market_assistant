import {requireActor} from "@/server/auth";
import {ownedShop} from "@/server/entry-service";
import {database} from "@/server/db";
import {ApiError,bodyObject,failure,json,requireSameOrigin} from "@/server/http";
import {stockAlerts,watDay} from "@/lib/stock-alerts";
import {SALES_SUMMARY_SQL,REACH_SUMMARY_SQL} from "@/lib/insight-sql";
export const runtime="nodejs";
type Context={params:Promise<{shopId:string}>};
export async function GET(_request:Request,context:Context){
  try{
    const shop=await ownedShop(await requireActor(),(await context.params).shopId),db=database();
    const saved=await db.query("SELECT low_stock,expiry_days,enabled FROM alert_settings WHERE shop_id=$1",[shop]);
    const row=saved.rows[0],settings={lowStock:row?.low_stock??5,expiryDays:row?.expiry_days??30,enabled:row?.enabled??true};
    const batches=await db.query(`SELECT b.batch_id,b.product_id,concat_ws(' ',p.brand,p.name,p.variant,p.size) label,p.unit,p.perishable,
      to_char(b.expiry_date,'YYYY-MM-DD') expiry_date,b.estimated_qty,b.confirmed_at FROM batch_stock b JOIN products p ON p.id=b.product_id WHERE b.shop_id=$1`,[shop]);
    const day=watDay();
    const sales=await db.query(SALES_SUMMARY_SQL,[shop,day]),reach=await db.query(REACH_SUMMARY_SQL,[shop,day]);
    const alerts=stockAlerts(batches.rows,{...settings,enabled:true});
    const available=batches.rows.filter(b=>b.estimated_qty>0&&(!b.expiry_date||b.expiry_date>=day));
    const units:Record<string,number>={};
    for(const b of available)units[b.unit]=(units[b.unit]||0)+b.estimated_qty;
    const summary={products:new Set(available.map(b=>b.product_id)).size,units,recounts:alerts.filter(a=>a.kind==="Recount needed").length,alerts:alerts.length};
    return json({simulated:true,day,settings,alerts:settings.enabled?alerts:[],summary,reach:reach.rows[0],sales:sales.rows[0]});
  }catch(error){return failure(error);}
}
export async function PUT(request:Request,context:Context){
  try{
    requireSameOrigin(request);
    const shop=await ownedShop(await requireActor(),(await context.params).shopId),body=await bodyObject(request);
    if(!Number.isInteger(body.lowStock)||Number(body.lowStock)<0||Number(body.lowStock)>100000||!Number.isInteger(body.expiryDays)||Number(body.expiryDays)<0||Number(body.expiryDays)>365||typeof body.enabled!=="boolean")throw new ApiError(400,"INVALID_ALERT_SETTINGS");
    await database().query(`INSERT INTO alert_settings(shop_id,low_stock,expiry_days,enabled) VALUES($1,$2,$3,$4)
      ON CONFLICT(shop_id) DO UPDATE SET low_stock=excluded.low_stock,expiry_days=excluded.expiry_days,enabled=excluded.enabled`,[shop,body.lowStock,body.expiryDays,body.enabled]);
    return json({saved:true});
  }catch(error){return failure(error);}
}
