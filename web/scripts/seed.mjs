import pg from "pg";
import { generateDemo, seedDemo } from "./demo-data.mjs";
if (!process.env.DATABASE_URL || process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("Set DATABASE_URL and ALLOW_DEMO_SEED=true locally for an empty demo database. No records changed.");
  process.exit(1);
}
const db = new pg.Client({connectionString:process.env.DATABASE_URL});
try {
  await db.connect();
  const date = process.env.DEMO_AS_OF || new Date().toISOString().slice(0,10);
  const data = generateDemo(20261103,date);
  await seedDemo(db,data);
  console.log(`Seeded ${data.shops.length} fictional shops, ${data.products.length} products and ${data.events.length} simulated events as of ${date}.`);
} catch { console.error("Demo seed failed. Check connection, migrations and that the dataset is empty. No credentials logged."); process.exitCode=1; }
finally { await db.end(); }
