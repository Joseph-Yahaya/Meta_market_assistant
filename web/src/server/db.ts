import "server-only";
import { Pool } from "pg";
import { localDemoPool } from "./local-db";

const globalDb = globalThis as typeof globalThis & { marketPool?: Pool };
export function database() {
  if (process.env.NODE_ENV!=="production" && process.env.LOCAL_DEMO_DATABASE==="true") return localDemoPool();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!globalDb.marketPool) {
    globalDb.marketPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5,
      connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000,
      options: "-c statement_timeout=10000 -c timezone=Africa/Lagos" });
    globalDb.marketPool.on("error", () => { console.error("Database connection interrupted; no connection details logged."); });
  }
  return globalDb.marketPool;
}
