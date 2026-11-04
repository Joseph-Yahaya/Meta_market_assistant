import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const origin='http://127.0.0.1:3000';
async function call(path,method='GET',body,cookie=''){const r=await fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
assert.equal((await call('/api/status')).data.localDemo,true);
const a=await call('/api/auth/signup','POST',{email:`alerts-${randomUUID()}@example.test`,password:`demo-${randomUUID()}`,ownerName:'Fictional alert tester',shopName:'Alert test provision shop',landmark:'Simulated Kubwa',latitude:9.151,longitude:7.324,demoNoticeAccepted:true});assert.equal(a.status,201);
const path=`/api/shops/${a.data.shopId}/insights`,cookie=a.cookie;
assert.equal((await call(path)).status,401);
assert.equal((await call(path,'GET',null,cookie)).data.settings.lowStock,5);
assert.equal((await call(path,'PUT',{lowStock:-1,expiryDays:30,enabled:true},cookie)).status,400);
const products=(await call('/api/products')).data.products,p=products.find(p=>p.perishable);assert.ok(p);
const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const review=await call('/api/entries/prepare','POST',{shopId:a.data.shopId,entry:{productId:p.id,action:'opening',quantity:4,expiryDate:date}},cookie);assert.equal(review.status,200);
assert.equal((await call('/api/entries/confirm','POST',{token:review.data.token},cookie)).status,200);
const first=await call(path,'GET',null,cookie);assert.equal(first.status,200);assert.ok(first.data.alerts.some(a=>a.kind==='Expiry approaching'));assert.ok(first.data.alerts.some(a=>a.kind==='Low stock'));
assert.deepEqual((await call(path,'GET',null,cookie)).data.alerts,first.data.alerts);
assert.equal((await call(path,'PUT',{lowStock:2,expiryDays:3,enabled:true},cookie)).status,200);assert.equal((await call(path,'GET',null,cookie)).data.alerts.length,0);
assert.equal((await call(path,'PUT',{lowStock:5,expiryDays:30,enabled:false},cookie)).status,200);assert.equal((await call(path,'GET',null,cookie)).data.alerts.length,0);
console.log('Local alert API passed: owner access, expiry, low stock, repeat reads, settings persistence and opt-out.');
