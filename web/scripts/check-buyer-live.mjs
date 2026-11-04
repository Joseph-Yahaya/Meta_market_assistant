// Browser-test fixture for the isolated local demo. Never uses real accounts or services.
import {readFile,writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
const origin="http://127.0.0.1:3000",file=new URL("../.local-run/task04-live-fixture.json",import.meta.url);
async function call(path,body,cookie="") {
  const response=await fetch(origin+path,{method:body?"POST":"GET",headers:{Origin:origin,Cookie:cookie,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
  const data=await response.json();assert.ok(response.ok,JSON.stringify({status:response.status,error:data.error}));
  return {data,cookie:response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ")};
}
assert.equal((await call("/api/status")).data.localDemo,true);
if(process.argv[2]==="sell") {
  const fixture=JSON.parse(await readFile(file,"utf8"));
  const receipt=await call("/api/entries/confirm",{token:fixture.token},fixture.cookie);
  assert.equal(receipt.data.estimatedQty,0);
  console.log("Simulated stock sold out. The buyer page should remove the fixture on its next automatic poll.");
} else {
  const tag=randomUUID(),shopName=`Live-update demo ${tag.slice(0,6)}`;
  const account=await call("/api/auth/signup",{email:`live-${tag}@example.test`,password:`demo-${randomUUID()}`,ownerName:"Fictional polling tester",shopName,landmark:"Simulated Kubwa live-update test",latitude:9.151,longitude:7.324,demoNoticeAccepted:true});
  const catalog=await call("/api/products?q=indomie"),product=catalog.data.products.find(p=>p.size==="70g");assert.ok(product);
  const shopId=account.data.shopId,cookie=account.cookie;
  const opening=await call("/api/entries/prepare",{shopId,entry:{productId:product.id,action:"opening",quantity:2}},cookie);
  await call("/api/entries/confirm",{token:opening.data.token},cookie);
  const sale=await call("/api/entries/prepare",{shopId,entry:{productId:product.id,action:"sale",quantity:2}},cookie);
  await writeFile(file,JSON.stringify({shopId,shopName,cookie,token:sale.data.token}),{mode:0o600});
  console.log(JSON.stringify({shopName,product:"Indomie Noodles 70g",simulated:true}));
}
