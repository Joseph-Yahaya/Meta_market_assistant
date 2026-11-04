// LIVE Meta call, local synthetic inventory only. Requires explicit credit authorization.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const origin="http://127.0.0.1:3000";
async function call(path,body,jar=new Map()){
  const r=await fetch(origin+path,{method:body?"POST":"GET",headers:{Origin:origin,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; "),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
  for(const value of r.headers.getSetCookie()){const pair=value.split(";")[0],i=pair.indexOf("=");jar.set(pair.slice(0,i),pair.slice(i+1));}
  const data=await r.json();assert.ok(r.ok,`${path}: HTTP ${r.status} ${data.error?.code||""}`);return data;
}
try{
  const status=await call("/api/status");assert.ok(status.localDemo&&status.accountsConfigured&&status.metaConfigured,"Requires local synthetic database and enabled Meta access");
  const owner=new Map(),buyer=new Map(),tag=randomUUID();
  const account=await call("/api/auth/signup",{email:`meta-flow-${tag}@example.test`,password:`demo-${randomUUID()}`,ownerName:"Fictional Meta flow tester",shopName:`AI flow demo ${tag.slice(0,6)}`,landmark:"Simulated Kubwa test pin",latitude:9.151,longitude:7.324,demoNoticeAccepted:true},owner);
  const shopId=account.shopId,catalog=await call("/api/products?q=indomie"),product=catalog.products.find(p=>p.size==="70g");assert.ok(product);
  const stock=()=>call(`/api/shops/${shopId}/stock`,undefined,owner);
  const opening=await call("/api/entries/prepare",{shopId,entry:{productId:product.id,action:"opening",quantity:2}},owner);
  await call("/api/entries/confirm",{token:opening.token},owner);
  const params={productId:product.id,latitude:9.151,longitude:7.324,radiusKm:.1};
  const before=await call("/api/buyer/search",params,buyer);assert.ok(before.shops.some(s=>s.shop_id===shopId));
  const interpreted=await call("/api/entries/interpret",{shopId,text:"Sold 2 packs of Indomie chicken noodles 70g at N250.50 per pack."},owner);
  const e=interpreted.extraction;assert.equal(interpreted.requiresConfirmation,true);assert.equal(e.action,"sale");assert.equal(e.quantity,2);assert.equal(e.unit,"pack");assert.equal(e.needsClarification,false);assert.equal(Number(e.unitPriceNaira),250.5);
  assert.equal((await stock()).stock[0].estimated_qty,2,"Interpretation must not change stock");
  const review=await call("/api/entries/prepare",{shopId,entry:{productId:product.id,action:e.action,quantity:e.quantity,unitPriceKobo:25050}},owner);
  assert.equal((await stock()).stock[0].estimated_qty,2,"Review must not change stock");
  const confirmed=await call("/api/entries/confirm",{token:review.token},owner);assert.equal(confirmed.estimatedQty,0);
  const retry=await call("/api/entries/confirm",{token:review.token},owner);assert.equal(retry.replayed,true);assert.equal(retry.estimatedQty,0);
  const after=await stock();assert.equal(after.stock[0].estimated_qty,0);assert.equal(after.events.filter(x=>x.event_type==="sale").length,1);
  const polled=await call("/api/buyer/search",{...params,searchToken:before.searchToken},buyer);assert.ok(!polled.shops.some(s=>s.shop_id===shopId));
  console.log("PASS: live Spark interpretation → unchanged review → confirmed sale → duplicate retry without another sale → buyer polling removes sold-out shop. Fictional data only. Browser rendering and voice are not certified by this API test.");
}catch(error){console.error(error instanceof Error?error.message:"LIVE_FLOW_FAILED");process.exitCode=1;}
