import {test} from "node:test";
import assert from "node:assert/strict";
import {parseBuyerSearch,signBuyer,readBuyer,visitorDigest,queryDigest,newBuyerSession} from "../src/lib/buyer.ts";
import {catalogMatches} from "../src/lib/catalog-match.ts";
import {directionsUrl} from "../src/lib/directions.ts";
const secret="b".repeat(32),productId="30000000-0000-4000-a000-000000000001";
test("buyer search requires an exact product and valid manual coordinates",()=>{
  const valid={productId,latitude:9.151,longitude:7.324};assert.equal(parseBuyerSearch(valid).radiusKm,5);
  for(const change of [{productId:"Indomie"},{latitude:"9.151"},{latitude:NaN},{longitude:181},{radiusKm:0},{radiusKm:51},{offset:-1},{offset:1.5}])assert.throws(()=>parseBuyerSearch({...valid,...change}),/INVALID_SEARCH/);
});
test("anonymous tokens expire and are bound to their purpose",()=>{
  const session=newBuyerSession(secret,1000),payload=readBuyer("buyer-session",session.token,secret,1001);assert.equal(payload.id,session.id);
  assert.throws(()=>readBuyer("buyer-feedback",session.token,secret,1001),/INVALID_BUYER_TOKEN/);
  assert.throws(()=>readBuyer("buyer-session",session.token+"x",secret,1001),/INVALID_BUYER_TOKEN/);
  assert.throws(()=>readBuyer("buyer-session",session.token,secret,1000+24*3600000),/BUYER_TOKEN_EXPIRED/);
});
test("feedback tickets expose no buyer coordinates or account details",()=>{
  const ticket=signBuyer("buyer-feedback",{visitor:"hash",shopId:productId,productId,searchId:productId,expires:10000},secret);
  const fields=readBuyer("buyer-feedback",ticket,secret,1);assert.ok(!("latitude" in fields));assert.ok(!("longitude" in fields));assert.ok(!("email" in fields));
});
test("search fingerprints bind location/radius without putting them in a token",()=>{
  const first=parseBuyerSearch({productId,latitude:9.151,longitude:7.324});
  assert.notEqual(queryDigest(first,secret),queryDigest({...first,radiusKm:10},secret));
  assert.notEqual(queryDigest(first,secret),queryDigest({...first,latitude:9.2},secret));
  assert.equal(queryDigest(first,secret),queryDigest({...first,offset:50},secret));
  assert.notEqual(visitorDigest("visitor",secret,0),visitorDigest("visitor",secret,86400000));
});
test("directions links open an external map for a valid shop pin",()=>{
  assert.equal(directionsUrl(9.151,7.324),"https://www.google.com/maps/dir/?api=1&destination=9.151,7.324");
  for(const [lat,lng] of [[NaN,7.324],[9.151,NaN],[91,0],[0,181],["9.151",7.324],[9.151,null]])assert.throws(()=>directionsUrl(lat,lng),/INVALID_DIRECTIONS_PIN/);
});
test("simple English and Pidgin filler words do not prevent exact variant selection",()=>{
  const product={brand:"Indomie",name:"Noodles",variant:"Chicken",size:"70g"};
  assert.equal(catalogMatches("I need Indomie 70 g",product),true);
  assert.equal(catalogMatches("Abeg find Indomie",product),true);
  assert.equal(catalogMatches("Indomie 120g",product),false);
  assert.equal(catalogMatches("please find",product),false);
});
