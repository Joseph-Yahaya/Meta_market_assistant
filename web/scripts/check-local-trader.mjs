// End-to-end checks against our isolated local app only. No Railway or Meta calls.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const origin="http://127.0.0.1:3000";
async function call(path,{method="GET",body,cookie}={}) {
  const response=await fetch(`${origin}${path}`,{method,headers:{Origin:origin,...(body?{"Content-Type":"application/json"}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
  const data=await response.json();
  return {status:response.status,data,cookie:response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ")};
}
const config=await call("/api/status");
assert.equal(config.data.localDemo,true,"This script is restricted to the isolated local demo database");
const tag=randomUUID(),email=`local-${tag}@example.test`,password=`test-${randomUUID()}`;
const signup={email,password,ownerName:"Fictional local test owner",shopName:"Local flow test shop",landmark:"Simulated Kubwa pin",latitude:9.151,longitude:7.324,demoNoticeAccepted:true};
const account=await call("/api/auth/signup",{method:"POST",body:signup});
assert.equal(account.status,201,JSON.stringify({status:account.status,error:account.data.error}));
const shop=account.data.shopId,cookie=account.cookie;
assert.ok(cookie.includes("market_owner_session="));
const catalog=await call("/api/products"),product=catalog.data.products[0].id;
const stock=()=>call(`/api/shops/${shop}/stock`,{cookie});
assert.equal((await stock()).data.stock.length,0);
assert.equal((await call(`/api/shops/${shop}/stock`)).status,401);
assert.equal((await call(`/api/shops/${shop}/stock`,{method:"POST",body:{},cookie})).status,405);
async function prepare(entry) {
  const response=await call("/api/entries/prepare",{method:"POST",cookie,body:{shopId:shop,entry:{productId:product,...entry}}});
  assert.equal(response.status,200,JSON.stringify(response.data));return response.data.token;
}
const confirm=token=>call("/api/entries/confirm",{method:"POST",cookie,body:{token}});
const opening=await prepare({action:"opening",quantity:10,unitPriceKobo:12345});
assert.equal((await stock()).data.stock.length,0,"Preparing a review must not change stock");
const recorded=await confirm(opening);assert.equal(recorded.status,200);assert.equal(recorded.data.estimatedQty,10);
const replay=await confirm(opening);assert.equal(replay.data.replayed,true);assert.equal(replay.data.estimatedQty,10);
const sale=await prepare({action:"sale",quantity:3});assert.equal((await confirm(sale)).data.estimatedQty,7);
const batch=(await stock()).data.stock[0].batch_id;
const recount=await prepare({action:"recount",quantity:5,batchId:batch});assert.equal((await confirm(recount)).data.estimatedQty,5);
const stale=await prepare({action:"recount",quantity:2,batchId:batch});
await confirm(await prepare({action:"sale",quantity:1}));
const conflict=await confirm(stale);assert.equal(conflict.status,409);assert.equal(conflict.data.error.code,"STOCK_CHANGED_REVIEW_AGAIN");
const excessive=await confirm(await prepare({action:"sale",quantity:9999}));assert.equal(excessive.status,409);assert.equal(excessive.data.error.code,"INSUFFICIENT_STOCK_RECOUNT_REQUIRED");
assert.equal((await stock()).data.stock[0].estimated_qty,4);
const wrong=await call("/api/auth/login",{method:"POST",body:{email,password:"wrong-demo-password"}});assert.equal(wrong.status,401);
const login=await call("/api/auth/login",{method:"POST",body:{email,password}});assert.equal(login.status,200);
assert.equal((await call("/api/auth/session",{cookie:login.cookie})).data.shops[0].id,shop);
const second=await call("/api/auth/signup",{method:"POST",body:{...signup,email:`other-${tag}@example.test`,shopName:"Other fictional shop"}});assert.equal(second.status,201);
assert.equal((await call(`/api/shops/${shop}/stock`,{cookie:second.cookie})).status,403);
assert.equal((await call("/api/entries/confirm",{method:"POST",cookie:second.cookie,body:{token:sale}})).status,409);
const disabled=await call("/api/entries/interpret",{method:"POST",cookie,body:{shopId:shop,text:"I sell 3 packs of Indomie"}});
assert.equal(disabled.status,503);assert.equal(disabled.data.error.code,"META_NOT_CONFIGURED");
const logout=await call("/api/auth/session",{method:"DELETE",cookie});assert.equal(logout.status,200);
console.log("Local trader flow passed: signup/login, owner isolation, review before save, retry protection, sale, recount, stale-review rejection, overselling rejection and explicit AI-disabled fallback. Only fictional local records created; no external services called.");
