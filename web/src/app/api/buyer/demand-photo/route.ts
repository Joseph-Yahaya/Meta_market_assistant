import { buyerIdentity } from "@/server/buyer-service";
import { limitAuth, limitDaily } from "@/server/accounts";
import { dailyCapFor } from "@/lib/model-limits";
import { metaClient } from "@/server/meta";
import { database } from "@/server/db";
import { ApiError, failure, json, requireSameOrigin } from "@/server/http";
import { buyerUuid, readBuyer } from "@/lib/buyer";
import { isRegulatedProduct, validateDemandIdea } from "@/lib/custom-products";
import { DEMAND_SETTINGS, demandCellId } from "@/lib/demand";
import { MAX_IMAGE_BYTES, stripImageMetadata, validateImageBytes } from "@/lib/image";
import {
  demandGroupVisitors,
  demandPhotoPath,
  purgeDemandPhotos,
  recordDemandSignal,
  saveDemandPhoto,
} from "@/server/demand-service";
import { unlink } from "node:fs/promises";
export const runtime = "nodejs";
// Optional buyer photo after a failed search. Same checks as the trader
// image pipeline (type, size, metadata strip, product and regulated-goods
// screening); the photo is shown to traders only after the demand group
// reaches the threshold, and only one representative photo per group.
export async function POST(request: Request) {
  let saved: string | null = null;
  try {
    requireSameOrigin(request);
    const { secret, visitor } = await buyerIdentity();
    const form = await request.formData().catch(() => null);
    if (!form) throw new ApiError(400, "INVALID_DEMAND_PHOTO");
    if (form.get("consent") !== "true") throw new ApiError(400, "DEMAND_CONSENT_REQUIRED");
    const latitude = Number(form.get("latitude")), longitude = Number(form.get("longitude"));
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
      throw new ApiError(400, "INVALID_SEARCH");
    }
    const db = database();
    let kind: "product" | "idea", key: string;
    if (form.get("ideaToken")) {
      try {
        const token = readBuyer("buyer-idea", form.get("ideaToken"), secret);
        if (token.visitor !== visitor || typeof token.idea !== "string") throw new Error("INVALID_DEMAND_IDEA");
        key = validateDemandIdea(token.idea);
      } catch (error) {
        const code = (error as Error).message;
        throw new ApiError(400, code === "REGULATED_PRODUCT" ? "REGULATED_PRODUCT" : "INVALID_DEMAND_IDEA");
      }
      kind = "idea";
    } else if (form.get("searchToken")) {
      let token;
      try {
        token = readBuyer("buyer-search", form.get("searchToken"), secret);
      } catch { throw new ApiError(400, "INVALID_DEMAND_PHOTO"); }
      const found = await db.query(
        "SELECT product_id FROM searches WHERE id=$1 AND visitor_hash=$2 AND simulated AND found_results=false AND at>now()-interval '24 hours'",
        [token.searchId, visitor],
      );
      const productId = found.rows[0]?.product_id;
      if (token.visitor !== visitor || !buyerUuid(token.searchId) || !buyerUuid(productId)) {
        throw new ApiError(400, "INVALID_DEMAND_PHOTO");
      }
      kind = "product";
      key = productId;
    } else {
      throw new ApiError(400, "INVALID_DEMAND_PHOTO");
    }
    await limitAuth("buyer-demand-photo", visitor, 10);
    await limitDaily("buyer-demand-photo", visitor, DEMAND_SETTINGS.photosPerVisitorPerDay);
    await limitDaily("model-global", "all", dailyCapFor("global"));
    const photo = form.get("photo");
    if (!photo || typeof photo !== "object" || typeof (photo as File).arrayBuffer !== "function") {
      throw new ApiError(400, "PHOTO_REQUIRED");
    }
    const bytes = new Uint8Array(await (photo as File).arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new ApiError(413, "IMAGE_TOO_LARGE");
    let photoType;
    try { photoType = validateImageBytes(bytes).type; }
    catch (error) { const code = (error as Error).message; throw new ApiError(code === "IMAGE_TOO_LARGE" ? 413 : 400, code); }
    let clean: Uint8Array;
    try { clean = stripImageMetadata(bytes, photoType); }
    catch (error) { throw new ApiError(400, (error as Error).message); }
    const mime = photoType === "jpeg" ? "image/jpeg" : photoType === "png" ? "image/png" : "image/webp";
    const proposal = await metaClient().analyzeImage(clean, mime);
    if (!proposal.isProduct) throw new ApiError(400, "NOT_A_PRODUCT");
    if (isRegulatedProduct({ name: proposal.name || "", brand: proposal.brand || "", category: proposal.category || "" })) {
      throw new ApiError(400, "REGULATED_PRODUCT");
    }
    const cell = demandCellId(latitude, longitude);
    await purgeDemandPhotos(db);
    await recordDemandSignal(db, { kind, key, cell, visitor });
    const visitors = await demandGroupVisitors(db, kind, key, cell);
    saved = await saveDemandPhoto(clean);
    if (visitors >= DEMAND_SETTINGS.visitorThreshold) {
      const taken = await db.query(
        "SELECT id FROM demand_photos WHERE demand_kind=$1 AND demand_key=$2 AND cell_id=$3 AND status='active' LIMIT 1",
        [kind, key, cell],
      );
      if (taken.rows.length) throw new ApiError(409, "PHOTO_ALREADY_ATTACHED");
      try {
        const inserted = await db.query(
          "INSERT INTO demand_photos(demand_kind,demand_key,cell_id,path,status,expires_at) VALUES($1,$2,$3,$4,'active',$5) RETURNING id",
          [kind, key, cell, saved, new Date(Date.now() + DEMAND_SETTINGS.photoRetentionDays * 86400000)],
        );
        const dropped = await db.query(
          "DELETE FROM demand_photos WHERE demand_kind=$1 AND demand_key=$2 AND cell_id=$3 AND status='pending' RETURNING path",
          [kind, key, cell],
        );
        for (const row of dropped.rows) await unlink(demandPhotoPath(row.path)).catch(() => {});
        return json({ photoId: inserted.rows[0].id, status: "active" });
      } catch (error) {
        if ((error as { code?: string }).code === "23505") throw new ApiError(409, "PHOTO_ALREADY_ATTACHED");
        throw error;
      }
    }
    const inserted = await db.query(
      "INSERT INTO demand_photos(demand_kind,demand_key,cell_id,path,status,expires_at) VALUES($1,$2,$3,$4,'pending',$5) RETURNING id",
      [kind, key, cell, saved, new Date(Date.now() + 86400000)],
    );
    return json({ photoId: inserted.rows[0].id, status: "pending" });
  } catch (error) {
    if (saved) await unlink(demandPhotoPath(saved)).catch(() => {});
    return failure(error);
  }
}
