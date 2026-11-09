// Simulated demand fixtures (Feature P). Shared by local boot seeding and
// the hosted release step. Self-contained (no src imports) so it also runs
// in the production container, which ships only scripts/ and db/.
// Idempotent: tops up only when no simulated rows exist for the last 7 days.
// Cell math mirrors src/lib/demand.ts; demand.test.mjs checks they agree.
const CELL_STEP = 2 / 111;
export const seedCellId = (lat, lng) => `${Math.floor(lat / CELL_STEP)}:${Math.floor(lng / CELL_STEP)}`;
export const seedNeighbors = (cell) => {
  const [la, ln] = cell.split(":").map(Number);
  const out = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) out.push(`${la + a}:${ln + b}`);
  return out;
};
// The demand cell holds a product with no stock in that cell (8 visitors)
// and a "toothpaste" idea (6 visitors); a 3-visitor group stays below the
// threshold and hidden; one adjacent-cell shop stocks the product so it
// gets no alert for it.
export async function seedDemand(db) {
  const fresh = await db.query("SELECT 1 FROM demand_daily WHERE simulated AND day > current_date - 7 LIMIT 1");
  if (fresh.rows.length) return { seeded: false };
  const cell = seedCellId(9.151, 7.324);
  const shops = (await db.query("SELECT id, owner_id, name, latitude, longitude FROM shops WHERE simulated")).rows;
  const cellShops = shops.filter((shop) => seedCellId(shop.latitude, shop.longitude) === cell).map((shop) => shop.id);
  const clean = (await db.query(
    `SELECT p.id FROM products p WHERE p.status='approved' AND p.shop_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM batch_stock b WHERE b.product_id=p.id AND b.estimated_qty>0 AND b.shop_id = ANY($1))
     ORDER BY p.id LIMIT 2`, [cellShops])).rows;
  if (!clean.length) { console.log("Demand seed skipped: every catalog product is stocked in the demo cell."); return { seeded: false }; }
  const adjacent = new Set(seedNeighbors(cell).filter((entry) => entry !== cell));
  const nearShops = shops.filter((shop) => adjacent.has(seedCellId(shop.latitude, shop.longitude)));
  let keeperName = "";
  if (nearShops.length) {
    const held = (await db.query(
      "SELECT b.shop_id AS id FROM batch_stock b WHERE b.product_id=$1 AND b.estimated_qty>0 AND b.shop_id = ANY($2) LIMIT 1",
      [clean[0].id, nearShops.map((shop) => shop.id)])).rows;
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
  return { seeded: true };
}
