import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { migrate } from "../../scripts/migrate.mjs";
import { generateDemo, seedDemo } from "../../scripts/demo-data.mjs";
import { demandCellId, neighborCells } from "@/lib/demand";

type LocalState={ready:Promise<PGlite>;tail:Promise<void>};
const globalState=globalThis as typeof globalThis & {marketLocalState?:LocalState};
async function openEngine() {
  const {PGlite}=await import("@electric-sql/pglite");
  const db=new PGlite(path.join(process.cwd(),".local-demo"));
  const folder=pathToFileURL(path.join(process.cwd(),"db","migrations")+path.sep);
  await migrate(db,folder);
  const count=await db.query<{count:number}>("SELECT count(*)::integer AS count FROM shops");
  if(count.rows[0].count===0) {
    const date=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Lagos"});
    await seedDemo(db,generateDemo(20261103,date));
  }
  await seedDemand(db);
  return db;
}
// Simulated demand fixtures for the demo database. Idempotent: tops up only
// when no simulated rows exist for the last 7 days. The demand cell holds a
// product with no stock in that cell (8 visitors) and a "toothpaste" idea
// (6 visitors); a 3-visitor group stays below the threshold and hidden; one
// adjacent-cell shop stocks the product so it gets no alert for it.
async function seedDemand(db: { query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }) {
  if (process.env.DEMO_MODE !== "true") return;
  const fresh = await db.query("SELECT 1 FROM demand_daily WHERE simulated AND day > current_date - 7 LIMIT 1");
  if (fresh.rows.length) return;
  const cell = demandCellId(9.151, 7.324);
  const shops = (await db.query("SELECT id, owner_id, name, latitude, longitude FROM shops WHERE simulated")).rows as {
    id: string; owner_id: string; name: string; latitude: number; longitude: number;
  }[];
  const cellShops = shops.filter((shop) => demandCellId(shop.latitude, shop.longitude) === cell).map((shop) => shop.id);
  const clean = (await db.query(
    `SELECT p.id FROM products p WHERE p.status='approved' AND p.shop_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM batch_stock b WHERE b.product_id=p.id AND b.estimated_qty>0 AND b.shop_id = ANY($1))
     ORDER BY p.id LIMIT 2`, [cellShops])).rows as { id: string }[];
  if (!clean.length) { console.log("Demand seed skipped: every catalog product is stocked in the demo cell."); return; }
  const adjacent = new Set(neighborCells(cell).filter((entry) => entry !== cell));
  const nearShops = shops.filter((shop) => adjacent.has(demandCellId(shop.latitude, shop.longitude)));
  let keeperName = "";
  if (nearShops.length) {
    const held = (await db.query(
      "SELECT b.shop_id AS id FROM batch_stock b WHERE b.product_id=$1 AND b.estimated_qty>0 AND b.shop_id = ANY($2) LIMIT 1",
      [clean[0].id, nearShops.map((shop) => shop.id)])).rows as { id: string }[];
    if (held.length) keeperName = nearShops.find((shop) => shop.id === held[0].id)?.name ?? "a nearby shop";
    else {
      const keeper = nearShops[0];
      await db.query("SELECT record_stock($1,$2,$3,$4,'opening',20)", [keeper.owner_id, keeper.id, clean[0].id, `seed-demand-${clean[0].id}`]);
      keeperName = keeper.name;
    }
  }
  const secondCell = clean.length > 1 ? cell : [...adjacent][0];
  const secondKey = clean.length > 1 ? clean[1].id : clean[0].id;
  await db.query(
    `INSERT INTO demand_daily(day,demand_kind,demand_key,cell_id,simulated,signals,visitors) VALUES
     (current_date,'product',$1,$2,true,10,8),
     (current_date,'idea','toothpaste',$2,true,7,6),
     (current_date,'product',$3,$4,true,3,3)
     ON CONFLICT DO NOTHING`, [clean[0].id, cell, secondKey, secondCell ?? cell]);
  const label = (await db.query("SELECT concat_ws(' ', brand, name, variant, size) AS label FROM products WHERE id=$1", [clean[0].id])).rows[0]?.label ?? "one product";
  console.log(`Seeded simulated demand in cell ${cell}: 8 visitors for ${label}, 6 for toothpaste, 3 hidden below threshold${keeperName ? `; ${keeperName} stocks ${label} and gets no alert for it` : ""}.`);
}
export function localDemoPool(): Pick<Pool,"query"|"connect"> {
  // PGlite is an isolated, single-connection development engine, never production.
  if(process.env.NODE_ENV==="production" || process.env.LOCAL_DEMO_DATABASE!=="true")throw new Error("LOCAL_DEMO_DISABLED");
  const state=globalState.marketLocalState??={ready:openEngine(),tail:Promise.resolve()};
  async function acquire() {
    const prior=state.tail;let unlock!:()=>void;
    state.tail=new Promise<void>(resolve=>{unlock=resolve;});await prior;return unlock;
  }
  const adapter={
    async query(sql:string,values:unknown[]=[]) {
      const release=await acquire();try{return await (await state.ready).query(sql,values);}finally{release();}
    },
    async connect() {
      const release=await acquire();let released=false;
      try {
        const db=await state.ready;
        return {query:(sql:string,values:unknown[]=[])=>{if(released)throw new Error("CLIENT_RELEASED");return db.query(sql,values);},
          release:()=>{if(!released){released=true;release();}}};
      }catch(error){release();throw error;}
    },
  };
  // Implements the query/connect subset used by the app; it intentionally has no pool/server lifecycle APIs.
  return adapter as unknown as Pick<Pool,"query"|"connect">;
}
