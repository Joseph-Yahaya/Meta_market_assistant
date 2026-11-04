import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import path from "node:path";
import pg from "pg";

export async function migrate(db, migrationFolder) {
  // Call with one connected pg.Client, never a pool spanning multiple connections.
  await db.query("BEGIN");
  try {
    await db.query("SELECT pg_advisory_xact_lock(772013)");
    await db.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const folder = migrationFolder || pathToFileURL(path.join(process.cwd(),"db","migrations")+path.sep);
    for (const name of (await readdir(/* turbopackIgnore: true */ folder)).filter((n) => n.endsWith(".sql")).sort()) {
      const sql = await readFile(/* turbopackIgnore: true */ new URL(name, folder), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await db.query("SELECT checksum FROM schema_migrations WHERE name = $1", [name]);
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration changed after application: ${name}`);
        continue;
      }
      // pg supports multi-statement migrations without parameters; PGlite uses exec.
      if (typeof db.exec === "function") await db.exec(sql); else await db.query(sql);
      await db.query("INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)", [name,checksum]);
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) { console.error("Set DATABASE_URL locally before migrating. No database changed."); process.exit(1); }
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try { await db.connect(); await migrate(db); console.log("Database migrations applied."); }
  catch { console.error("Migration failed. Check database access and migration compatibility; credentials were not logged."); process.exitCode = 1; }
  finally { await db.end(); }
}
