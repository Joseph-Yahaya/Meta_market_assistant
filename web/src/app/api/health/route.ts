import {database} from "@/server/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    if(process.env.DEMO_MODE!=="true"||(process.env.SESSION_SECRET?.length??0)<32)throw Error("NOT_READY");
    // Check the latest required schema as well as database connectivity.
    const result=await database().query("SELECT name FROM insight_capture WHERE name='shop_open'");
    if(result.rows.length!==1)throw Error("NOT_READY");
    return Response.json({status:"ready"},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return Response.json({status:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
