import { createHash } from "node:crypto";

export function stableId(value) {
  const hash = createHash("sha256").update(value).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
function randomSource(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state,1664525)+1013904223) >>> 0; return state / 4294967296; };
}
const families = [
  ["Noodles","Indomie","Chicken",["70g","120g","210g"],15000,true],
  ["Pasta","Golden Penny","Spaghetti",["200g","500g","1kg"],45000,false],
  ["Rice","Demo Pantry","Parboiled",["500g","1kg","5kg"],65000,false],
  ["Sugar","Dangote","White",["250g","500g","1kg"],30000,false],
  ["Salt","Dangote","Iodised",["250g","500g","1kg"],15000,false],
  ["Milk powder","Peak","Full cream",["14g","120g","360g"],18000,true],
  ["Malt drink powder","Milo","Original",["20g","200g","400g"],20000,true],
  ["Tea","Lipton","Black",["10 bags","25 bags","50 bags"],35000,false],
  ["Tomato paste","Gino","Original",["70g","210g","400g"],25000,true],
  ["Vegetable oil","Kings","Refined",["250ml","500ml","1L"],70000,true],
  ["Biscuits","McVitie's","Digestive",["40g","100g","200g"],25000,true],
  ["Cheese balls","Demo Snacks","Cheese",["15g","30g","60g"],10000,true],
  ["Corn flakes","NASCO","Original",["50g","250g","500g"],35000,true],
  ["Oats","Quaker","Rolled",["100g","500g","1kg"],60000,true],
  ["Custard","Checkers","Vanilla",["100g","400g","1kg"],30000,true],
  ["Water","Demo Water","Still",["500ml","750ml","1.5L"],15000,true],
  ["Soft drink","Coca-Cola","Original",["350ml","500ml","1L"],30000,true],
  ["Chocolate","Cadbury","Milk",["20g","50g","100g"],35000,true],
  ["Peanuts","Demo Snacks","Roasted",["50g","100g","250g"],25000,true],
  ["Beans","Demo Pantry","Brown",["500g","1kg","2kg"],75000,false],
];

// All identities, packaging choices, stock, prices and history are illustrative fixtures.
export function generateDemo(seed = 20261103, asOf = "2026-11-03") {
  const random = randomSource(seed);
  const anchor = new Date(`${asOf}T12:00:00.000Z`);
  if (!Number.isFinite(anchor.getTime())) throw new Error("Invalid demo date");
  const products = families.flatMap(([name,brand,variant,sizes,base,perishable], family) =>
    sizes.map((size,index) => ({ id:stableId(`product:${family}:${index}`), name, brand, variant, size,
      unit:"pack", category:"provisions", perishable, basePriceKobo:base*[1,4,8][index],
      aliases:[`${brand} ${name}`.toLowerCase(),`${brand} ${name} ${size}`.toLowerCase()] })));
  const traders = [], shops = [], batches = [], events = [], confirmations = [];
  const clusters = [[9.151,7.324],[9.145,7.335],[9.161,7.317]];
  let nearExpiry = 0;
  for (let shopIndex=0; shopIndex<30; shopIndex++) {
    const ownerId = stableId(`owner:${shopIndex}`), shopId = stableId(`shop:${shopIndex}`);
    traders.push({id:ownerId,display_name:`Demo owner ${shopIndex+1}`,simulated:true});
    const cluster = clusters[shopIndex%clusters.length];
    shops.push({ id:shopId,owner_id:ownerId,name:`Demo Provision Shop ${String(shopIndex+1).padStart(2,"0")}`,
      category:"provisions",latitude:cluster[0]+(random()-.5)*.004,longitude:cluster[1]+(random()-.5)*.004,
      landmark:`Simulated pin near Kubwa cluster ${shopIndex%3+1}; not a verified business address`,
      location_verified:false,simulated:true });
    for (let slot=0; slot<12; slot++) {
      const product = products[(shopIndex*7+slot*3)%products.length];
      const batchId = stableId(`batch:${shopIndex}:${slot}`);
      const date = new Date(anchor);
      const soon = product.perishable && nearExpiry < 8;
      if (soon) nearExpiry++;
      date.setUTCDate(date.getUTCDate()+(soon ? 5+nearExpiry*2 : 120+slot));
      const expiry = product.perishable ? date.toISOString().slice(0,10) : null;
      batches.push({id:batchId,shop_id:shopId,product_id:product.id,expiry_date:expiry,created_at:new Date(anchor.getTime()-76*86400000).toISOString()});
      const price = Math.round(product.basePriceKobo*(.9+random()*.2));
      let balance = 160;
      const event = (day,delta,type,tag) => events.push({id:stableId(`event:${shopIndex}:${slot}:${tag}`),
        shop_id:shopId,product_id:product.id,batch_id:batchId,actor_id:ownerId,qty_delta:delta,
        event_type:type,unit_price_kobo:price,source:"seed",event_at:new Date(day).toISOString(),recorded_at:new Date(day).toISOString()});
      event(anchor.getTime()-76*86400000,160,"opening","opening");
      for (let day=75;day>=1;day--) {
        const timestamp=anchor.getTime()-day*86400000;
        const weekday=new Date(timestamp).getUTCDay();
        const sold=1+Math.floor(random()*((weekday===0||weekday===6)?6:4));
        if (balance < 20) { event(timestamp-3600000,100,"restock",`restock:${day}`); balance+=100; }
        event(timestamp,-sold,"sale",`sale:${day}`); balance-=sold;
      }
      confirmations.push({id:stableId(`confirmation:${shopIndex}:${slot}`),batch_id:batchId,actor_id:ownerId,
        physical_count:balance,previous_estimate:balance,confirmed_at:anchor.toISOString()});
    }
  }
  return {seed,asOf,simulated:true,products,traders,shops,batches,events,confirmations,
    // Not inserted into the valid ledger: demonstrably impossible on its own opening balance.
    anomaly:{simulated:true,opening:2,sale:9,expected:"INSUFFICIENT_STOCK_RECOUNT_REQUIRED"}};
}

export async function seedDemo(db, data) {
  await db.query("BEGIN");
  try {
    const existing = await db.query("SELECT count(*)::integer AS count FROM shops");
    if (existing.rows[0].count !== 0) throw new Error("Seed requires an empty shop dataset; no existing records changed");
    await db.query(`INSERT INTO traders SELECT * FROM jsonb_to_recordset($1::jsonb)
      AS t(id uuid,display_name text,simulated boolean)`, [JSON.stringify(data.traders)]);
    await db.query(`INSERT INTO shops(id,owner_id,name,category,latitude,longitude,landmark,location_verified,simulated)
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(id uuid,owner_id uuid,name text,category text,latitude double precision,longitude double precision,landmark text,location_verified boolean,simulated boolean)`,[JSON.stringify(data.shops)]);
    await db.query(`INSERT INTO products(id,name,brand,variant,size,unit,category,perishable)
      SELECT id,name,brand,variant,size,unit,category,perishable FROM jsonb_to_recordset($1::jsonb)
      AS t(id uuid,name text,brand text,variant text,size text,unit text,category text,perishable boolean)`,[JSON.stringify(data.products)]);
    for (const product of data.products) {
      for (const alias of product.aliases) await db.query("INSERT INTO product_aliases VALUES($1,$2)",[product.id,alias]);
    }
    await db.query(`INSERT INTO stock_batches(id,shop_id,product_id,expiry_date,created_at)
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(id uuid,shop_id uuid,product_id uuid,expiry_date date,created_at timestamptz)`,[JSON.stringify(data.batches)]);
    await db.query(`INSERT INTO stock_events(id,shop_id,product_id,batch_id,actor_id,qty_delta,event_type,unit_price_kobo,source,event_at,recorded_at)
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(id uuid,shop_id uuid,product_id uuid,batch_id uuid,actor_id uuid,qty_delta integer,event_type text,unit_price_kobo bigint,source text,event_at timestamptz,recorded_at timestamptz)`,[JSON.stringify(data.events)]);
    await db.query(`INSERT INTO stock_confirmations(id,batch_id,actor_id,physical_count,previous_estimate,confirmed_at)
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(id uuid,batch_id uuid,actor_id uuid,physical_count integer,previous_estimate integer,confirmed_at timestamptz)`,[JSON.stringify(data.confirmations)]);
    await db.query("COMMIT");
  } catch(error) { await db.query("ROLLBACK"); throw error; }
}
