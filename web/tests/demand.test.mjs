import { before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { migrate } from "../scripts/migrate.mjs";
import {
  DEMAND_SETTINGS,
  dedupeAlertsByKey,
  demandCellId,
  filterStockedAlerts,
  neighborCells,
} from "../src/lib/demand.ts";
import {
  DEMAND_DAILY_SQL,
  DEMAND_EXPIRE_PHOTOS_SQL,
  DEMAND_GROUP_SQL,
  DEMAND_PURGE_PHOTOS_SQL,
  DEMAND_PURGE_SIGNALS_SQL,
  DEMAND_SIGNAL_SQL,
  DEMAND_SIMULATED_SQL,
  DEMAND_STOCKED_SQL,
} from "../src/lib/demand-sql.ts";
import { readBuyer, signBuyer } from "../src/lib/buyer.ts";

const db = new PGlite();
const actor = "10000000-0000-4000-a000-000000000011";
const shop = "20000000-0000-4000-a000-000000000011";
const product = "30000000-0000-4000-a000-000000000011";
const cell = demandCellId(9.151, 7.324);
const cells = neighborCells(cell);
const SECRET = "test-secret-that-is-long-enough-1234";

before(async () => {
  await migrate(db);
  await db.query("INSERT INTO traders(id,display_name,simulated) VALUES($1,'Demand owner',true)", [actor]);
  await db.query(
    `INSERT INTO shops(id,owner_id,name,category,latitude,longitude,landmark,simulated)
     VALUES($1,$2,'Demand shop','provisions',9.151,7.324,'Simulated Kubwa pin',true)`,
    [shop, actor],
  );
  await db.query(
    "INSERT INTO products(id,name,brand,variant,size,unit,category,perishable) VALUES($1,'Noodles','Indomie','Chicken','70g','pack','provisions',true)",
    [product],
  );
});
beforeEach(async () => {
  await db.query("DELETE FROM demand_signals");
  await db.query("DELETE FROM demand_daily");
  await db.query("DELETE FROM demand_photos");
});

test("demand settings hold the owner-confirmed values", () => {
  assert.deepEqual(DEMAND_SETTINGS, {
    cellKm: 2,
    alertRangeKm: 5,
    visitorThreshold: 5,
    photoRetentionDays: 7,
    photosPerVisitorPerDay: 3,
  });
});

test("area cells are deterministic 2 km squares with 8 neighbors", () => {
  assert.equal(demandCellId(9.151, 7.324), cell);
  assert.equal(demandCellId(9.152, 7.325), cell);
  assert.notEqual(demandCellId(9.2, 7.324), cell);
  assert.equal(neighborCells(cell).length, 9);
  assert.ok(neighborCells(cell).includes(cell));
  assert.equal(new Set(neighborCells(cell)).size, 9);
});

test("demand tables store no coordinates or search text", async () => {
  const columns = (await db.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('demand_signals','demand_daily','demand_photos')"
  )).rows.map((row) => row.column_name);
  for (const banned of ["latitude", "longitude", "coordinates", "lat", "lng", "query", "search_text", "transcript"]) {
    assert.ok(!columns.includes(banned), `banned column present: ${banned}`);
  }
});

test("distinct visitors count once per key per cell per day", async () => {
  const signal = (visitor) => db.query(DEMAND_SIGNAL_SQL, ["product", product, cell, visitor]);
  assert.equal((await signal("visitor-a")).rows.length, 1);
  assert.equal((await signal("visitor-a")).rows.length, 0);
  await signal("visitor-b");
  const groups = (await db.query(DEMAND_GROUP_SQL, [cells, 1])).rows;
  assert.equal(groups.length, 1);
  assert.equal(groups[0].visitors, 2);
});

test("groups below 5 visitors are never returned", async () => {
  for (const visitor of ["v1", "v2", "v3", "v4"]) {
    await db.query(DEMAND_SIGNAL_SQL, ["product", product, cell, visitor]);
  }
  assert.equal((await db.query(DEMAND_GROUP_SQL, [cells, DEMAND_SETTINGS.visitorThreshold])).rows.length, 0);
  await db.query(DEMAND_SIGNAL_SQL, ["product", product, cell, "v5"]);
  const shown = await db.query(DEMAND_GROUP_SQL, [cells, DEMAND_SETTINGS.visitorThreshold]);
  assert.equal(shown.rows.length, 1);
  assert.equal(shown.rows[0].visitors, 5);
});

test("daily rows count attempts as signals and visitors distinctly", async () => {
  await db.query(DEMAND_DAILY_SQL, ["product", product, cell, 1]);
  await db.query(DEMAND_DAILY_SQL, ["product", product, cell, 0]);
  const row = (await db.query("SELECT signals, visitors FROM demand_daily")).rows[0];
  assert.deepEqual([row.signals, row.visitors], [2, 1]);
});

test("simulated demand hides below-threshold groups", async () => {
  await db.query(
    "INSERT INTO demand_daily(day,demand_kind,demand_key,cell_id,simulated,signals,visitors) VALUES (current_date,'product',$1,$2,true,10,8),(current_date,'product',$1,'0:0',true,3,3)",
    [product, cell],
  );
  const shown = await db.query(DEMAND_SIMULATED_SQL, [cells, DEMAND_SETTINGS.visitorThreshold]);
  assert.equal(shown.rows.length, 1);
  assert.equal(shown.rows[0].visitors, 8);
  const hidden = await db.query(DEMAND_SIMULATED_SQL, [["0:0"], DEMAND_SETTINGS.visitorThreshold]);
  assert.equal(hidden.rows.length, 0);
});

test("stocked products are excluded from alerts", async () => {
  await db.query("SELECT record_stock($1,$2,$3,$4,'opening',20)", [actor, shop, product, "demand-stock-test"]);
  const stocked = await db.query(DEMAND_STOCKED_SQL, [shop, [product, "00000000-0000-4000-a000-000000000000"]]);
  assert.deepEqual(stocked.rows.map((row) => row.id), [product]);
  assert.deepEqual(
    filterStockedAlerts(
      [
        { kind: "product", key: product, cell, visitors: 8, simulated: false },
        { kind: "idea", key: "toothpaste", cell, visitors: 6, simulated: false },
      ],
      [product],
    ).map((alert) => alert.key),
    ["toothpaste"],
  );
});

test("at most one alert per key per day, own cell first", () => {
  const groups = [
    { kind: "product", key: product, cell: "0:0", visitors: 9, simulated: false },
    { kind: "product", key: product, cell, visitors: 6, simulated: false },
    { kind: "idea", key: "toothpaste", cell, visitors: 6, simulated: false },
  ];
  const deduped = dedupeAlertsByKey(groups, cell);
  assert.equal(deduped.length, 2);
  assert.equal(deduped.find((alert) => alert.kind === "product").cell, cell);
});

test("old signals purge after 24 hours", async () => {
  await db.query(
    "INSERT INTO demand_signals(day,demand_kind,demand_key,cell_id,visitor_hash,at) VALUES (current_date-1,'product',$1,$2,'old-visitor',now()-interval '25 hours'),(current_date,'product',$1,$2,'new-visitor',now())",
    [product, cell],
  );
  await db.query(DEMAND_PURGE_SIGNALS_SQL);
  const left = await db.query("SELECT visitor_hash FROM demand_signals");
  assert.deepEqual(left.rows.map((row) => row.visitor_hash), ["new-visitor"]);
});

test("expired and stale photos purge with their paths", async () => {
  await db.query(
    `INSERT INTO demand_photos(demand_kind,demand_key,cell_id,path,status,created_at,expires_at) VALUES
     ('product',$1,$2,'demand-old.jpg','pending',now()-interval '2 hours',now()-interval '1 hour'),
     ('product',$1,$2,'demand-stale-pending.jpg','pending',now()-interval '25 hours',now()+interval '1 hour'),
     ('product',$1,$2,'demand-fresh.jpg','pending',now(),now()+interval '1 hour')`,
    [product, cell],
  );
  const purged = (await db.query(DEMAND_PURGE_PHOTOS_SQL)).rows.map((row) => row.path).sort();
  assert.deepEqual(purged, ["demand-old.jpg", "demand-stale-pending.jpg"]);
  assert.equal((await db.query("SELECT count(*)::int n FROM demand_photos")).rows[0].n, 1);
});

test("active photos expire when the alert drops below threshold", async () => {
  await db.query(
    "INSERT INTO demand_photos(demand_kind,demand_key,cell_id,path,status,expires_at) VALUES ('product',$1,$2,'demand-active.jpg','active',now()+interval '6 days')",
    [product, cell],
  );
  for (const visitor of ["w1", "w2", "w3", "w4"]) {
    await db.query(DEMAND_SIGNAL_SQL, ["product", product, cell, visitor]);
  }
  const expired = await db.query(DEMAND_EXPIRE_PHOTOS_SQL, [DEMAND_SETTINGS.visitorThreshold]);
  assert.deepEqual(expired.rows.map((row) => row.path), ["demand-active.jpg"]);
  assert.equal((await db.query("SELECT status FROM demand_photos")).rows[0].status, "expired");
});

test("idea tokens sign the visitor and idea with an expiry", () => {
  const token = signBuyer("buyer-idea", { visitor: "hash-a", idea: "toothpaste", expires: Date.now() + 10000 }, SECRET);
  const payload = readBuyer("buyer-idea", token, SECRET);
  assert.equal(payload.idea, "toothpaste");
  assert.equal(payload.visitor, "hash-a");
  assert.throws(() => readBuyer("buyer-idea", `${token}x`, SECRET), /INVALID_BUYER_TOKEN/);
  assert.throws(() => readBuyer("buyer-search", token, SECRET), /INVALID_BUYER_TOKEN/);
  const stale = signBuyer("buyer-idea", { visitor: "hash-a", idea: "toothpaste", expires: Date.now() - 1000 }, SECRET);
  assert.throws(() => readBuyer("buyer-idea", stale, SECRET), /BUYER_TOKEN_EXPIRED/);
});

test("demand alerts default to off per shop", async () => {
  const row = (await db.query("SELECT demand_alerts FROM shops WHERE id=$1", [shop])).rows[0];
  assert.equal(row.demand_alerts, false);
});

test("hosted demand seed uses the same cell math as the app", async () => {
  const { seedCellId, seedNeighbors } = await import("../scripts/seed-demand.mjs");
  for (const [lat, lng] of [[9.151, 7.324], [9.153, 7.328], [9.13, 7.3], [-3.5, 2.1]]) {
    assert.equal(seedCellId(lat, lng), demandCellId(lat, lng));
    assert.deepEqual(new Set(seedNeighbors(seedCellId(lat, lng))), new Set(neighborCells(seedCellId(lat, lng))));
  }
  assert.ok(!/require\(|process\.env\.(DATABASE_URL|MODEL_API_KEY|SESSION_SECRET)/.test(
    readFileSync(new URL("../scripts/seed-demand.mjs", import.meta.url), "utf8")));
});
