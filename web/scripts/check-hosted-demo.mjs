// Explicit integration test for this authorized synthetic Railway demo only.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const origin="https://ai-market-assistant-production.up.railway.app";
const liveAI=!process.argv.includes("--manual");
async function request(path,body,jar=new Map()){
  const r=await fetch(origin+path,{method:body?"POST":"GET",headers:{Origin:origin,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
  for(const value of r.headers.getSetCookie()){const pair=value.split(";")[0],i=pair.indexOf("=");jar.set(pair.slice(0,i),pair.slice(i+1));}
  return {status:r.status,data:await r.json()};
}
function ok(r){assert.ok(r.status>=200&&r.status<300,`HTTP ${r.status}: ${r.data.error?.code||"request failed"}`);return r.data;}
try{
  assert.equal(ok(await request("/api/health")).status,"ready");
  const config=ok(await request("/api/status"));assert.equal(config.localDemo,false);assert.equal(config.accountsConfigured,true);assert.equal(config.metaConfigured,true);
  const owner=new Map(),buyer=new Map(),tag=randomUUID();
  const account=ok(await request("/api/auth/signup",{email:`hosted-${tag}@example.test`,password:`demo-${randomUUID()}`,ownerName:"Fictional hosted tester",shopName:`Hosted demo ${tag.slice(0,6)}`,landmark:"Simulated Kubwa test pin",latitude:9.151,longitude:7.324,demoNoticeAccepted:true},owner));
  const shopId=account.shopId,catalog=ok(await request("/api/products?q=indomie")),product=catalog.products.find(p=>p.size==="70g"),second=catalog.products.find(p=>p.id!==product.id);assert.ok(product&&second);
  const stock=()=>request(`/api/shops/${shopId}/stock`,undefined,owner);
  const prepare=async(productId,action,quantity)=>ok(await request("/api/entries/prepare",{shopId,entry:{productId,action,quantity}},owner));
  const confirm=token=>request("/api/entries/confirm",{token},owner);
  ok(await confirm((await prepare(product.id,"opening",2)).token));
  const params={productId:product.id,latitude:9.151,longitude:7.324,radiusKm:.1};
  const before=ok(await request("/api/buyer/search",params,buyer));assert.ok(before.shops.some(s=>s.shop_id===shopId));
  const proposal=liveAI?ok(await request("/api/entries/interpret",{shopId,text:"Sold 2 packs of Indomie chicken noodles 70g."},owner)):{extraction:{action:"sale",quantity:2,needsClarification:false}};assert.equal(proposal.extraction.action,"sale");assert.equal(proposal.extraction.quantity,2);assert.equal(proposal.extraction.needsClarification,false);
  assert.equal(ok(await stock()).stock.find(b=>b.product_id===product.id).estimated_qty,2);
  const review=await prepare(product.id,proposal.extraction.action,proposal.extraction.quantity);
  assert.equal(ok(await stock()).stock.find(b=>b.product_id===product.id).estimated_qty,2);
  assert.equal(ok(await confirm(review.token)).estimatedQty,0);assert.equal(ok(await confirm(review.token)).replayed,true);
  const after=ok(await request("/api/buyer/search",{...params,searchToken:before.searchToken},buyer));assert.ok(!after.shops.some(s=>s.shop_id===shopId));
  assert.equal((await request(`/api/shops/${shopId}/stock`)).status,401);
  ok(await confirm((await prepare(second.id,"opening",1)).token));
  const a=await prepare(second.id,"sale",1),b=await prepare(second.id,"sale",1);
  const concurrent=await Promise.all([confirm(a.token),confirm(b.token)]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.ok(concurrent.some(r=>r.data.error?.code==="INSUFFICIENT_STOCK_RECOUNT_REQUIRED"));
  assert.equal(ok(await stock()).stock.find(x=>x.product_id===second.id).estimated_qty,0);
  ok(await request(`/api/shops/${shopId}/insights`,undefined,owner));
  console.log(`PASS: hosted readiness, signup/session, ${liveAI?"live Spark interpretation":"manual sale (AI not tested)"}, no pre-confirmation write, replay protection, buyer refresh, private stock access, concurrent oversell prevention and insights. Only fictional records created. Voice/browser/backup restore remain separate checks.`);
}catch(error){console.error(error instanceof Error?error.message:"HOSTED_DEMO_FAILED");process.exitCode=1;}
