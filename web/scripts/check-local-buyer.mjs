import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const origin="http://127.0.0.1:3000";
async function request(path,body,jar=new Map()) {
  const response=await fetch(origin+path,{method:body?"POST":"GET",headers:{Origin:origin,...(body?{"Content-Type":"application/json"}:{}),Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join("; ")},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
  for(const value of response.headers.getSetCookie()){const pair=value.split(";")[0],i=pair.indexOf("=");jar.set(pair.slice(0,i),pair.slice(i+1));}
  return {status:response.status,data:await response.json()};
}
const config=await request("/api/status");assert.equal(config.data.localDemo,true,"Restricted to isolated local demo data");
const owner=new Map(),tag=randomUUID();
const account=await request("/api/auth/signup",{email:`buyer-flow-${tag}@example.test`,password:`demo-${randomUUID()}`,ownerName:"Fictional buyer-flow owner",shopName:`Buyer flow ${tag.slice(0,6)}`,landmark:"Fictional Kubwa test pin",latitude:9.151,longitude:7.324,demoNoticeAccepted:true},owner);
assert.equal(account.status,201,JSON.stringify(account.data));const shopId=account.data.shopId;
const catalog=await request("/api/products"),productId=catalog.data.products[0].id;
async function write(action,quantity,batchId) {
  const review=await request("/api/entries/prepare",{shopId,entry:{productId,action,quantity,batchId}},owner);assert.equal(review.status,200,JSON.stringify(review.data));
  const result=await request("/api/entries/confirm",{token:review.data.token},owner);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;
}
await write("opening",2);
const params={productId,latitude:9.151,longitude:7.324,radiusKm:.1};
async function search(jar,searchToken){const result=await request("/api/buyer/search",{...params,searchToken},jar);assert.equal(result.status,200,JSON.stringify(result.data));return result.data;}
const first=new Map(),second=new Map(),third=new Map();
const initial=await search(first);let listing=initial.shops.find(s=>s.shop_id===shopId);assert.ok(listing,"Fresh shop should be found without a buyer account");
assert.ok(first.has("market_buyer_demo"));assert.ok(!first.has("market_owner_session"));
for(const field of ["estimated_qty","owner_id","phone","unit_price_kobo"])assert.ok(!(field in listing));
const open1=await request("/api/buyer/feedback",{token:listing.feedbackToken,kind:"shop_open"},first);
const open2=await request("/api/buyer/feedback",{token:listing.feedbackToken,kind:"shop_open"},first);
assert.equal(open1.status,200);assert.equal(open2.data.replayed,true);
const insights=await request(`/api/shops/${shopId}/insights`,undefined,owner);
assert.equal(insights.status,200);assert.equal(insights.data.reach.opens,1);
assert.equal(insights.data.summary.products,1);
assert.equal(insights.data.summary.units[catalog.data.products[0].unit],2);
assert.ok(insights.data.reach.capture_started_at);
const repeat=await search(first,initial.searchToken);assert.equal(repeat.searchToken,initial.searchToken,"Polling must reuse the original search");
assert.equal((await request("/api/buyer/feedback",{token:listing.feedbackToken,kind:"visit_report",found:false},second)).status,403,"Another anonymous session must not reuse a feedback ticket");
const negative1=await request("/api/buyer/feedback",{token:listing.feedbackToken,kind:"visit_report",found:false},first);assert.equal(negative1.status,200);
const negativeRetry=await request("/api/buyer/feedback",{token:listing.feedbackToken,kind:"visit_report",found:false},first);assert.equal(negativeRetry.data.replayed,true);
assert.ok((await search(first,initial.searchToken)).shops.some(s=>s.shop_id===shopId),"One session report must not hide stock");
for(const jar of [second,third]){const result=await search(jar);const target=result.shops.find(s=>s.shop_id===shopId);assert.ok(target);assert.equal((await request("/api/buyer/feedback",{token:target.feedbackToken,kind:"visit_report",found:false},jar)).status,200);}
assert.ok(!(await search(first,initial.searchToken)).shops.some(s=>s.shop_id===shopId),"Three distinct session reports should suppress this listing");
const stock=await request(`/api/shops/${shopId}/stock`,undefined,owner);assert.equal(stock.data.stock[0].estimated_qty,2,"Feedback must not rewrite the ledger");
await write("recount",2,stock.data.stock[0].batch_id);
assert.ok((await search(first,initial.searchToken)).shops.some(s=>s.shop_id===shopId),"A fresh recount should clear earlier negative report suppression");
await write("sale",2);
assert.ok(!(await search(first,initial.searchToken)).shops.some(s=>s.shop_id===shopId),"A sold-out shop must disappear on the next poll");
assert.equal((await request("/api/buyer/search",{...params,latitude:91},first)).status,400);
const empty=await request("/api/buyer/search",{...params,latitude:0,longitude:0},first);assert.equal(empty.status,200);assert.equal(empty.data.shops.length,0);
console.log("Local buyer flow passed: anonymous search, public field restrictions, poll reuse, session-bound feedback, duplicate-report protection, confidence suppression, recount recovery and sold-out result removal. No buyer account, real location or external service was used.");
