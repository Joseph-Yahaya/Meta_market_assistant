import {test} from "node:test";
import assert from "node:assert/strict";
import {parseBuyerSearch,signBuyer,readBuyer,visitorDigest,queryDigest,newBuyerSession} from "../src/lib/buyer.ts";
import {catalogMatches,matchCatalogProducts} from "../src/lib/catalog-match.ts";
import {groupShopsByShop} from "../src/lib/shop-groups.ts";
import {directionsUrl} from "../src/lib/directions.ts";
import {wideningSteps,widenMessage} from "../src/lib/search-radius.ts";
import {locationErrorMessage} from "../src/lib/geolocation.ts";
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
test("search widening steps rise from 5 km toward 20 km with a clear message",()=>{
  assert.deepEqual(wideningSteps(5),[5,10,20]);
  assert.deepEqual(wideningSteps(10),[10,20]);
  assert.deepEqual(wideningSteps(20),[20]);
  assert.deepEqual(wideningSteps(50),[50]);
  assert.equal(widenMessage(5,5),null);
  assert.equal(widenMessage(5,10),"No shops within 5 km, showing the nearest within 10 km");
  assert.equal(widenMessage(5,20),"No shops within 10 km, showing the nearest within 20 km");
});
test("location failures speak plainly with a browser hint for blocked permission",()=>{
  assert.equal(locationErrorMessage(1,"choose a demo area"),"Location is blocked for this site. Click the lock or tune icon in the browser address bar, set Location to Allow, then try again. You can also choose a demo area.");
  assert.equal(locationErrorMessage(2,"choose a demo area"),"Your device could not determine its location. Please choose a demo area instead.");
  assert.equal(locationErrorMessage(3,"choose a demo area"),"Reading your location took too long. Please try again, or choose a demo area.");
  assert.equal(locationErrorMessage(99,"keep the demo pin"),"Reading your location took too long. Please try again, or keep the demo pin.");
});
test("free text matches variants with a cap, and rows group by shop",()=>{
  const catalog=[
    {brand:"Indomie",name:"Noodles",variant:"Chicken",size:"70g"},
    {brand:"Indomie",name:"Noodles",variant:"Onion",size:"70g"},
    {brand:"Dangote",name:"Sugar",variant:"White",size:"1kg"},
  ];
  const found=matchCatalogProducts("indomie",catalog);
  assert.equal(found.matched.length,2);assert.equal(found.truncated,false);
  assert.deepEqual(matchCatalogProducts("please",catalog).matched,[]);
  const capped=matchCatalogProducts("e",[...catalog,...catalog,...catalog,...catalog],2);
  assert.equal(capped.matched.length,2);assert.equal(capped.truncated,true);
  const rows=[
    {shop_id:"s1",distance_km:0.5,product_id:"p1"},
    {shop_id:"s2",distance_km:2.1,product_id:"p1"},
    {shop_id:"s1",distance_km:0.5,product_id:"p2"},
  ];
  const groups=groupShopsByShop(rows);
  assert.equal(groups.length,2);
  assert.equal(groups[0].shopId,"s1");assert.equal(groups[0].variants.length,2);
  assert.deepEqual(groups[0].variants.map(v=>v.product_id),["p1","p2"]);
  assert.equal(groups[1].shopId,"s2");
});
test("simple English and Pidgin filler words do not prevent exact variant selection",()=>{
  const product={brand:"Indomie",name:"Noodles",variant:"Chicken",size:"70g"};
  assert.equal(catalogMatches("I need Indomie 70 g",product),true);
  assert.equal(catalogMatches("Abeg find Indomie",product),true);
  assert.equal(catalogMatches("Indomie 120g",product),false);
  assert.equal(catalogMatches("please find",product),false);
});
