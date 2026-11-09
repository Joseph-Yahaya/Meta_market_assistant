import "server-only";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { DEMAND_SETTINGS } from "@/lib/demand";
import {
  DEMAND_DAILY_SQL,
  DEMAND_EXPIRE_PHOTOS_SQL,
  DEMAND_GROUP_SQL,
  DEMAND_PURGE_PHOTOS_SQL,
  DEMAND_PURGE_SIGNALS_SQL,
  DEMAND_SIGNAL_SQL,
} from "@/lib/demand-sql";

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

const DEMAND_UPLOAD_DIR = path.join(process.cwd(), ".local-uploads");

// Demand photos live in the same ignored local folder as trader photos,
// with a distinct prefix. Never served without an active alert.
export function demandPhotoPath(filename: unknown): string {
  if (typeof filename !== "string" || !/^demand-[0-9a-f-]{36}\.jpg$/.test(filename)) {
    throw new Error("PHOTO_MISSING");
  }
  return path.join(DEMAND_UPLOAD_DIR, filename);
}

async function removeFile(filename: string): Promise<void> {
  try {
    await unlink(demandPhotoPath(filename));
  } catch {
    /* Already gone; the row delete is what matters. */
  }
}

export async function saveDemandPhoto(bytes: Uint8Array): Promise<string> {
  const filename = `demand-${randomUUID()}.jpg`;
  await mkdir(DEMAND_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(DEMAND_UPLOAD_DIR, filename), bytes);
  return filename;
}

// One visitor counts once per key per cell per day (primary key); the daily
// row counts every attempt as a signal but distinct visitors only once.
export async function recordDemandSignal(
  db: Queryable,
  input: { kind: "product" | "idea"; key: string; cell: string; visitor: string },
): Promise<{ counted: boolean }> {
  const inserted = await db.query(DEMAND_SIGNAL_SQL, [input.kind, input.key, input.cell, input.visitor]);
  const counted = inserted.rows.length > 0;
  await db.query(DEMAND_DAILY_SQL, [input.kind, input.key, input.cell, counted ? 1 : 0]);
  if (counted) await promoteDemandPhoto(db, input.kind, input.key, input.cell);
  return { counted };
}

// When a group reaches the threshold, its oldest pending photo becomes the
// single representative alert photo; the rest are deleted, never shown.
export async function promoteDemandPhoto(
  db: Queryable,
  kind: string,
  key: string,
  cell: string,
): Promise<string | null> {
  const groups = await db.query(DEMAND_GROUP_SQL, [[cell], DEMAND_SETTINGS.visitorThreshold]);
  if (!groups.rows.some((row) => row.kind === kind && row.demand_key === key)) return null;
  const active = await db.query(
    "SELECT id FROM demand_photos WHERE demand_kind=$1 AND demand_key=$2 AND cell_id=$3 AND status='active' LIMIT 1",
    [kind, key, cell],
  );
  if (active.rows.length) return active.rows[0].id as string;
  const pending = await db.query(
    "SELECT id FROM demand_photos WHERE demand_kind=$1 AND demand_key=$2 AND cell_id=$3 AND status='pending' ORDER BY created_at LIMIT 1",
    [kind, key, cell],
  );
  if (!pending.rows.length) return null;
  try {
    await db.query("UPDATE demand_photos SET status='active', expires_at=created_at+($1||' days')::interval WHERE id=$2", [
      String(DEMAND_SETTINGS.photoRetentionDays),
      pending.rows[0].id,
    ]);
  } catch (error) {
    if ((error as { code?: string }).code !== "23505") throw error;
    const raced = await db.query(
      "SELECT id FROM demand_photos WHERE demand_kind=$1 AND demand_key=$2 AND cell_id=$3 AND status='active' LIMIT 1",
      [kind, key, cell],
    );
    return (raced.rows[0]?.id as string) ?? null;
  }
  const dropped = await db.query(
    "DELETE FROM demand_photos WHERE demand_kind=$1 AND demand_key=$2 AND cell_id=$3 AND status='pending' AND id<>$4 RETURNING path",
    [kind, key, cell, pending.rows[0].id],
  );
  for (const row of dropped.rows) await removeFile(row.path as string);
  return pending.rows[0].id as string;
}

export async function demandGroupVisitors(
  db: Queryable,
  kind: string,
  key: string,
  cell: string,
): Promise<number> {
  const groups = await db.query(DEMAND_GROUP_SQL, [[cell], 1]);
  const found = groups.rows.find((row) => row.kind === kind && row.demand_key === key);
  return (found?.visitors as number) ?? 0;
}

// Lazy expiry, run on demand reads: old rows, stale pendings, and active
// photos whose alert dropped below the threshold. Files go with the rows.
export async function purgeDemandPhotos(db: Queryable): Promise<{ purged: number; expired: number }> {
  const gone = await db.query(DEMAND_PURGE_PHOTOS_SQL);
  for (const row of gone.rows) await removeFile(row.path as string);
  const stale = await db.query(DEMAND_EXPIRE_PHOTOS_SQL, [DEMAND_SETTINGS.visitorThreshold]);
  for (const row of stale.rows) await removeFile(row.path as string);
  return { purged: gone.rows.length, expired: stale.rows.length };
}

export async function purgeDemandSignals(db: Queryable): Promise<void> {
  await db.query(DEMAND_PURGE_SIGNALS_SQL);
}
