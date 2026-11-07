import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../scripts/migrate.mjs";
import { generateDemo, seedDemo } from "../scripts/demo-data.mjs";
import { DISCOVERY_SQL, longitudeSpan } from "../src/lib/discovery.ts";
import { signSession, verifySession } from "../src/lib/session.ts";
import {BUYER_EVENT_SQL,BUYER_FEEDBACK_SQL} from "../src/lib/buyer-sql.ts";

const db = new PGlite();
const actor="10000000-0000-4000-a000-000000000001",other="10000000-0000-4000-a000-000000000002";
const shop="20000000-0000-4000-a000-000000000001",otherShop="20000000-0000-4000-a000-000000000002";
const product="30000000-0000-4000-a000-000000000001";
let date;
before(async()=>{await migrate(db); date=(await db.query("SELECT current_date::text AS d")).rows[0].d;});
beforeEach(async()=>{
  await db.exec("TRUNCATE traders,products CASCADE");
  await db.query("INSERT INTO traders(id,display_name,simulated) VALUES($1,'Demo owner',true),($2,'Other owner',true)",[actor,other]);
  await db.query(`INSERT INTO shops(id,owner_id,name,category,latitude,longitude,landmark,simulated)
    VALUES($1,$2,'Demo shop','provisions',9.151,7.324,'Simulated Kubwa pin',true),
    ($3,$4,'Other shop','provisions',9.152,7.325,'Simulated Kubwa pin',true)`,[shop,actor,otherShop,other]);
  await db.query("INSERT INTO products(id,name,brand,variant,size,unit,category,perishable) VALUES($1,'Noodles','Demo','Chicken','70g','pack','provisions',true)",[product]);
});
after(()=>db.close());
const command=async(action,quantity,key="request-0001",extras={})=>(await db.query(
  "SELECT record_stock($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS result",
  [extras.actor??actor,extras.shop??shop,extras.product??product,key,action,quantity,extras.batch??null,extras.expiry??null,extras.price??null,extras.corrects??null])).rows[0].result;
const day=(days)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
const discover=async()=> (await db.query(DISCOVERY_SQL,[product,9.151,7.324,5,0,longitudeSpan(9.151,5)])).rows;

test("migrations are repeatable",async()=>{await migrate(db); assert.equal((await db.query("SELECT count(*)::int n FROM schema_migrations")).rows[0].n,6);});
test("sale, recount and immutable correction history",async()=>{
  const opening=await command("opening",10);
  assert.equal((await command("sale",3,"request-sale")).estimatedQty,7);
  assert.equal((await command("recount",4,"request-recount",{batch:opening.batchId})).estimatedQty,4);
  const events=(await db.query("SELECT qty_delta FROM stock_events ORDER BY recorded_at,id")).rows.map(r=>r.qty_delta).sort((a,b)=>a-b);
  assert.deepEqual(events,[-3,-3,10]);
  await assert.rejects(db.query("UPDATE stock_events SET qty_delta=1"),/APPEND_ONLY/);
  await assert.rejects(db.query("DELETE FROM stock_events"),/APPEND_ONLY/);
});
test("retry does not duplicate a sale and changed keys are rejected",async()=>{
  await command("opening",10);
  const first=await command("sale",3,"unique-sale"),retry=await command("sale",3,"unique-sale");
  assert.equal(retry.commandId,first.commandId); assert.equal(retry.replayed,true);
  assert.equal((await db.query("SELECT sum(qty_delta)::int n FROM stock_events")).rows[0].n,7);
  await assert.rejects(command("sale",2,"unique-sale"),/KEY_REUSED/);
});
test("overselling rolls back without a command or stock change",async()=>{
  await command("opening",2);
  await assert.rejects(command("sale",9,"impossible-sale"),/INSUFFICIENT_STOCK_RECOUNT_REQUIRED/);
  assert.equal((await db.query("SELECT count(*)::int n FROM stock_commands")).rows[0].n,1);
  assert.equal((await db.query("SELECT estimated_qty FROM batch_stock")).rows[0].estimated_qty,2);
});
test("owner identity cannot operate another shop",async()=>{
  await assert.rejects(command("opening",5,"wrong-owner",{actor:other}),/FORBIDDEN/);
  await assert.rejects(command("opening",5,"wrong-shop",{shop:otherShop}),/FORBIDDEN/);
});
test("earliest expiry is depleted first; expired stock cannot be sold",async()=>{
  const early=await command("opening",2,"early-batch",{expiry:day(2)});
  await command("restock",4,"later-batch",{expiry:day(10)});
  await command("sale",3,"split-sale");
  const earlyStock=(await db.query("SELECT estimated_qty FROM batch_stock WHERE batch_id=$1",[early.batchId])).rows[0];
  assert.equal(earlyStock.estimated_qty,0);
  await assert.rejects(command("restock",2,"expired-restock",{expiry:day(-1)}),/INVALID_BATCH/);
});
test("exact kobo values survive round trip",async()=>{
  await command("opening",1,"money-check",{price:12345678901});
  assert.equal((await db.query("SELECT unit_price_kobo::text p FROM stock_events")).rows[0].p,"12345678901");
});
test("queued competing sales cannot consume the same remaining units",async()=>{
  await command("opening",3);
  const results=await Promise.allSettled([command("sale",2,"competing-a"),command("sale",2,"competing-b")]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await db.query("SELECT estimated_qty FROM batch_stock")).rows[0].estimated_qty,1);
  // PGlite serializes queries; a separate multi-connection PostgreSQL check is still required.
});
test("expired remaining batches are excluded from sale and discovery",async()=>{
  const batch="40000000-0000-4000-a000-000000000001";
  await db.query("INSERT INTO stock_batches(id,shop_id,product_id,expiry_date) VALUES($1,$2,$3,current_date-1)",[batch,shop,product]);
  await db.query("INSERT INTO stock_events(shop_id,product_id,batch_id,actor_id,qty_delta,event_type,source) VALUES($1,$2,$3,$4,9,'opening','seed')",[shop,product,batch,actor]);
  await db.query("INSERT INTO stock_confirmations(batch_id,actor_id,physical_count,previous_estimate) VALUES($1,$2,9,0)",[batch,actor]);
  await assert.rejects(command("sale",1,"expired-sale"),/INSUFFICIENT_STOCK_RECOUNT_REQUIRED/);
  assert.equal((await discover()).length,0);
});
test("recounts preserve previous counts and reject a batch from another shop",async()=>{
  const opening=await command("opening",6);
  const original=(await db.query("SELECT id FROM stock_events WHERE batch_id=$1",[opening.batchId])).rows[0].id;
  await command("recount",9,"correct-count",{batch:opening.batchId,corrects:original});
  assert.equal((await db.query("SELECT qty_delta FROM stock_events WHERE event_type='recount'")).rows[0].qty_delta,3);
  assert.equal((await db.query("SELECT previous_estimate FROM stock_confirmations WHERE physical_count=9")).rows[0].previous_estimate,6);
  assert.equal((await db.query("SELECT corrects_event_id FROM stock_events WHERE event_type='recount'")).rows[0].corrects_event_id,original);
  const foreign=await command("opening",2,"other-opening",{shop:otherShop,actor:other});
  await assert.rejects(command("recount",4,"cross-batch",{batch:foreign.batchId}),/INVALID_BATCH/);
});
test("zero stock disappears and search contains no private fields",async()=>{
  await command("opening",2);
  const rows=await discover(); assert.equal(rows.length,1);
  for (const field of ["estimated_qty","owner_id","phone","unit_price_kobo"]) assert.ok(!(field in rows[0]));
  await command("sale",2,"sell-all"); assert.equal((await discover()).length,0);
});
test("recent sales do not refresh an old stock confirmation",async()=>{
  const opening=await command("opening",5);
  // Isolated test reset to create an old confirmation without mutating the immutable audit table.
  await db.exec("TRUNCATE stock_confirmations");
  await db.query("INSERT INTO stock_confirmations(batch_id,actor_id,physical_count,previous_estimate,confirmed_at) VALUES($1,$2,5,5,now()-interval '4 days')",[opening.batchId,actor]);
  await command("sale",1,"recent-sale"); assert.equal((await discover()).length,0);
});
test("a new delivery cannot hide an older unconfirmed remaining batch",async()=>{
  const opening=await command("opening",5);
  await db.exec("TRUNCATE stock_confirmations");
  await command("restock",2,"new-delivery");
  assert.ok(opening.batchId); assert.equal((await discover()).length,0);
});
test("one buyer report does not hide an item; three distinct reports suppress it",async()=>{
  await command("opening",5);
  const feedback=(hash)=>db.query("INSERT INTO feedback(shop_id,product_id,visitor_hash,found) VALUES($1,$2,$3,false)",[shop,product,hash]);
  await feedback("visitor-a"); assert.equal((await discover()).length,1);
  await feedback("visitor-b"); await feedback("visitor-c"); assert.equal((await discover()).length,0);
  assert.equal((await db.query("SELECT estimated_qty FROM batch_stock")).rows[0].estimated_qty,5);
});
test("buyer feedback updates one session report without changing stock; event retries do not inflate visits",async()=>{
  await command("opening",5);
  const search="50000000-0000-4000-a000-000000000001";
  await db.query("INSERT INTO searches(id,product_id,found_results,simulated,visitor_hash) VALUES($1,$2,true,true,'anonymous-test')",[search,product]);
  await db.query(BUYER_EVENT_SQL,[search,shop,product,"visit_report"]);
  await db.query(BUYER_EVENT_SQL,[search,shop,product,"visit_report"]);
  await db.query(BUYER_FEEDBACK_SQL,[shop,product,"anonymous-test",false,search]);
  await db.query(BUYER_FEEDBACK_SQL,[shop,product,"anonymous-test",true,search]);
  assert.equal((await db.query("SELECT count(*)::int n FROM buyer_interactions")).rows[0].n,1);
  const reports=await db.query("SELECT found FROM feedback");assert.equal(reports.rows.length,1);assert.equal(reports.rows[0].found,true);
  assert.equal((await db.query("SELECT estimated_qty FROM batch_stock")).rows[0].estimated_qty,5);
  const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='searches'")).rows.map(row=>row.column_name);
  for(const field of ["latitude","longitude","query","email","phone"])assert.ok(!columns.includes(field));
});
test("signed sessions reject tampering and expiration",()=>{
  const secret="a".repeat(32),now=1000000,token=signSession(actor,secret,now);
  assert.equal(verifySession(token,secret,now),actor);
  assert.equal(verifySession(token+"x",secret,now),null);
  assert.equal(verifySession(token,"b".repeat(32),now),null);
  assert.equal(verifySession(token,secret,now+8*3600000),null);
});
test("seed is reproducible, valid and refuses an existing dataset",async()=>{
  const data=generateDemo(20261103,date);
  assert.deepEqual(data,generateDemo(20261103,date));
  assert.equal(data.shops.length,30); assert.equal(data.products.length,60);
  assert.equal(new Set(data.products.map(p=>p.id)).size,60);
  assert.equal(data.batches.filter(b=>b.expiry_date && b.expiry_date<=day(30)).length,8);
  await assert.rejects(seedDemo(db,data),/empty shop dataset/);
  await db.exec("TRUNCATE traders,products CASCADE");
  await seedDemo(db,data);
  assert.equal((await db.query("SELECT count(*)::int n FROM shops")).rows[0].n,30);
  assert.equal((await db.query("SELECT count(*)::int n FROM batch_stock WHERE estimated_qty<0")).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int n FROM (SELECT sum(qty_delta) OVER(PARTITION BY batch_id ORDER BY event_at,id) running FROM stock_events) a WHERE running<0")).rows[0].n,0);
  await assert.rejects(seedDemo(db,data),/empty shop dataset/);
});



test('shop reach survives raw-event cleanup and deduplicates retries without mixing shops',async()=>{
  const search='50000000-0000-4000-a000-000000000099';
  await db.query('INSERT INTO searches(id,product_id,found_results,simulated) VALUES($1,$2,true,true)',[search,product]);
  await db.query(BUYER_EVENT_SQL,[search,shop,product,'shop_open']);
  await db.query(BUYER_EVENT_SQL,[search,shop,product,'shop_open']);
  await db.query(BUYER_EVENT_SQL,[search,shop,product,'visit_report']);
  await db.query(BUYER_EVENT_SQL,[search,otherShop,product,'shop_open']);
  const {REACH_SUMMARY_SQL}=await import('../src/lib/insight-sql.ts');
  assert.equal((await db.query(REACH_SUMMARY_SQL,[shop,date])).rows[0].opens,1);
  assert.equal((await db.query(REACH_SUMMARY_SQL,[otherShop,date])).rows[0].opens,1);
  await db.query('DELETE FROM searches WHERE id=$1',[search]);
  assert.equal((await db.query(REACH_SUMMARY_SQL,[shop,date])).rows[0].opens,1);
  assert.deepEqual((await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='shop_reach_daily' ORDER BY ordinal_position")).rows.map(r=>r.column_name),['shop_id','day','opens']);
});
test('reach uses WAT day and excludes days outside the trailing seven calendar days',async()=>{
  const {REACH_SUMMARY_SQL}=await import('../src/lib/insight-sql.ts');
  await db.query('INSERT INTO shop_reach_daily(shop_id,day,opens) VALUES($1,$2::date-7,100),($1,$2::date-6,2),($1,$2::date,3),($1,$2::date+1,100)',[shop,date]);
  assert.equal((await db.query(REACH_SUMMARY_SQL,[shop,date])).rows[0].opens,5);
  const search='50000000-0000-4000-a000-000000000098';
  await db.query('INSERT INTO searches(id,product_id,found_results,simulated) VALUES($1,$2,true,true)',[search,product]);
  await db.query("INSERT INTO buyer_interactions(search_id,shop_id,product_id,kind,at) VALUES($1,$2,$3,'shop_open','2026-11-03T23:30:00Z')",[search,otherShop,product]);
  assert.equal((await db.query("SELECT opens FROM shop_reach_daily WHERE shop_id=$1 AND day='2026-11-04'",[otherShop])).rows[0].opens,1);
});
test("buyer records and digests store no raw coordinates",async()=>{
  const {queryDigest,visitorDigest}=await import("../src/lib/buyer.ts");
  const secret="c".repeat(32),visitor=visitorDigest("no-coords-visitor",secret);
  for(const table of ["searches","feedback","buyer_interactions"]){
    const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_name=$1",[table])).rows.map(r=>r.column_name);
    for(const field of ["latitude","longitude","lat","lng","lon","coordinates","coords","query","email","phone"])assert.ok(!columns.includes(field),`${table} must not store ${field}`);
  }
  const digest=queryDigest({productId:product,latitude:12.345678,longitude:7.654321,radiusKm:5,offset:0},secret);
  for(const stored of [digest,visitor])assert.ok(!stored.includes("12.345678")&&!stored.includes("7.654321"));
  const search="50000000-0000-4000-a000-000000000042";
  await db.query("INSERT INTO searches(id,product_id,found_results,simulated,visitor_hash) VALUES($1,$2,true,true,$3)",[search,product,visitor]);
  await db.query(BUYER_EVENT_SQL,[search,shop,product,"shop_open"]);
  await db.query(BUYER_FEEDBACK_SQL,[shop,product,visitor,true,search]);
  const dump=JSON.stringify([
    (await db.query("SELECT * FROM searches WHERE id=$1",[search])).rows,
    (await db.query("SELECT * FROM buyer_interactions WHERE search_id=$1",[search])).rows,
    (await db.query("SELECT * FROM feedback WHERE search_id=$1",[search])).rows,
  ]);
  assert.ok(!dump.includes("12.345678")&&!dump.includes("7.654321"));
  assert.equal((await db.query("SELECT count(*)::int n FROM feedback WHERE search_id=$1",[search])).rows[0].n,1);
});
test('sales summary excludes unpriced revenue and recount corrections, and uses WAT boundaries',async()=>{
  const {SALES_SUMMARY_SQL}=await import('../src/lib/insight-sql.ts');
  const opening=await command('opening',20);
  await command('sale',2,'priced-sale',{price:12345});
  await command('sale',1,'unpriced-sale');
  await command('recount',16,'correction',{batch:opening.batchId});
  const result=(await db.query(SALES_SUMMARY_SQL,[shop,date])).rows[0];
  assert.equal(result.entries,2);assert.equal(result.unpriced,1);assert.equal(result.revenue,'24690');
  assert.equal((await db.query(SALES_SUMMARY_SQL,[otherShop,date])).rows[0].entries,0);
});

