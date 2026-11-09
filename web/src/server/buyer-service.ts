import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { buyerUuid,newBuyerSession,parseBuyerSearch,queryDigest,readBuyer,signBuyer,visitorDigest } from "@/lib/buyer";
import { wideningSteps } from "@/lib/search-radius";
import { DISCOVERY_SQL,longitudeSpan } from "@/lib/discovery";
import { BUYER_EVENT_SQL,BUYER_FEEDBACK_SQL } from "@/lib/buyer-sql";
import { sessionSecret } from "./auth";
import { database } from "./db";
import { ApiError } from "./http";
import { limitAuth } from "./accounts";
import { demandCellId } from "@/lib/demand";
import { DEMAND_PURGE_SIGNALS_SQL } from "@/lib/demand-sql";
import { recordDemandSignal } from "./demand-service";
const BUYER_COOKIE="market_buyer_demo";
export async function buyerIdentity() {
  if(process.env.DEMO_MODE!=="true")throw new ApiError(404,"DEMO_DISCOVERY_DISABLED");
  const secret=sessionSecret(),jar=await cookies(),token=jar.get(BUYER_COOKIE)?.value;
  let id:string|undefined;
  try{const payload=readBuyer("buyer-session",token,secret);if(buyerUuid(payload.id))id=payload.id;}catch{/* Start a new short-lived anonymous session. */}
  if(!id){const session=newBuyerSession(secret);id=session.id;jar.set(BUYER_COOKIE,session.token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:24*3600});}
  return {secret,visitor:visitorDigest(id,secret)};
}
export async function buyerSearch(body:Record<string,unknown>) {
  const {secret,visitor}=await buyerIdentity();let input;
  try{input=parseBuyerSearch(body);}catch{throw new ApiError(400,"INVALID_SEARCH");}
  await limitAuth("buyer-search",visitor,240);
  const db=database(),digest=queryDigest(input,secret);
  let searchId:string,searchToken:string;
  if(body.searchToken) {
    let token;
    try{token=readBuyer("buyer-search",body.searchToken,secret);}catch{throw new ApiError(409,"SEARCH_EXPIRED");}
    if(token.visitor!==visitor||token.query!==digest||!buyerUuid(token.searchId))throw new ApiError(409,"SEARCH_EXPIRED");
    const exists=await db.query("SELECT id FROM searches WHERE id=$1 AND visitor_hash=$2 AND simulated AND at>now()-interval '24 hours'",[token.searchId,visitor]);
    if(!exists.rows.length)throw new ApiError(409,"SEARCH_EXPIRED");
    searchId=token.searchId;searchToken=body.searchToken as string;
  } else {
    if(input.offset!==0)throw new ApiError(400,"SEARCH_FIRST_PAGE_REQUIRED");
    const product=await db.query("SELECT id FROM products WHERE id=$1",[input.productId]);
    if(!product.rows.length)throw new ApiError(400,"UNKNOWN_PRODUCT");
    searchId=randomUUID();
    searchToken=signBuyer("buyer-search",{visitor,query:digest,searchId,expires:Date.now()+24*3600000},secret);
  }
  const initial=await db.query(DISCOVERY_SQL,[input.productId,input.latitude,input.longitude,input.radiusKm,input.offset,longitudeSpan(input.latitude,input.radiusKm)]);
  let searchedRadiusKm=input.radiusKm,rows=initial.rows;
  if(input.offset===0&&!rows.length){
    for(const step of wideningSteps(input.radiusKm).slice(1)){
      const attempt=await db.query(DISCOVERY_SQL,[input.productId,input.latitude,input.longitude,step,input.offset,longitudeSpan(input.latitude,step)]);
      searchedRadiusKm=step;rows=attempt.rows;
      if(rows.length)break;
    }
  }
  if(!body.searchToken) {
    await db.query("DELETE FROM searches WHERE simulated AND at<now()-interval '24 hours'");
    await db.query("DELETE FROM feedback WHERE at<now()-interval '24 hours' AND shop_id IN (SELECT id FROM shops WHERE simulated)");
    await db.query(DEMAND_PURGE_SIGNALS_SQL);
    await db.query("INSERT INTO searches(id,product_id,found_results,simulated,visitor_hash) VALUES($1,$2,$3,true,$4)",[searchId,input.productId,rows.length>0,visitor]);
    if(searchedRadiusKm>=20&&!rows.length)await recordDemandSignal(db,{kind:"product",key:input.productId,cell:demandCellId(input.latitude,input.longitude),visitor});
  }
  const shops=rows.slice(0,50).map(row=>({...row,feedbackToken:signBuyer("buyer-feedback",{visitor,searchId,shopId:row.shop_id,productId:input.productId,expires:Date.now()+15*60000},secret)}));
  return {simulated:true,availability:"estimated",distanceType:"straight-line",requestedRadiusKm:input.radiusKm,searchedRadiusKm,shops,nextOffset:rows.length>50?input.offset+50:null,searchToken,refreshSeconds:5};
}
export async function buyerInteraction(body:Record<string,unknown>) {
  const {visitor,secret}=await buyerIdentity();let token;
  try{token=readBuyer("buyer-feedback",body.token,secret);}catch{throw new ApiError(409,"FEEDBACK_EXPIRED");}
  if(token.visitor!==visitor||!buyerUuid(token.shopId)||!buyerUuid(token.productId)||!buyerUuid(token.searchId))throw new ApiError(403,"INVALID_FEEDBACK");
  if(body.kind!=="shop_open"&&body.kind!=="visit_report")throw new ApiError(400,"INVALID_FEEDBACK");
  if(body.kind==="visit_report"&&typeof body.found!=="boolean")throw new ApiError(400,"INVALID_FEEDBACK");
  await limitAuth("buyer-feedback",visitor,30);await limitAuth("buyer-feedback-global","simulated",300);
  const client=await database().connect();
  try {
    await client.query("BEGIN");
    const search=await client.query("SELECT id FROM searches WHERE id=$1 AND visitor_hash=$2 AND product_id=$3 AND simulated AND at>now()-interval '24 hours'",[token.searchId,visitor,token.productId]);
    const shop=await client.query("SELECT id FROM shops WHERE id=$1 AND simulated",[token.shopId]);
    if(!search.rows.length||!shop.rows.length)throw new ApiError(409,"FEEDBACK_EXPIRED");
    const recorded=await client.query(BUYER_EVENT_SQL,[token.searchId,token.shopId,token.productId,body.kind]);
    if(body.kind==="visit_report")await client.query(BUYER_FEEDBACK_SQL,[token.shopId,token.productId,visitor,body.found,token.searchId]);
    await client.query("COMMIT");return {recorded:true,replayed:recorded.rows.length===0,stockChanged:false};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
