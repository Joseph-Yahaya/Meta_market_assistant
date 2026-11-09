import { readFile, unlink } from "node:fs/promises";
import { database } from "@/server/db";
import { ApiError, bodyObject, failure, json, requireSameOrigin } from "@/server/http";
import { limitAuth } from "@/server/accounts";
import { verifyOperatorCode } from "@/lib/operator";
import { isUuid } from "@/lib/session";
import { demandPhotoPath } from "@/server/demand-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!process.env.DEMO_ACCESS_CODE?.trim()) throw new ApiError(503, "OPERATOR_DISABLED");
    const body = await bodyObject(request);
    await limitAuth("operator", "global", 30);
    if (!verifyOperatorCode(body.accessCode)) throw new ApiError(401, "INVALID_OPERATOR_CODE");
    if (!isUuid(body.photoId) || (body.action !== "view" && body.action !== "delete")) {
      throw new ApiError(400, "INVALID_REVIEW");
    }
    const found = (await database().query("SELECT path FROM demand_photos WHERE id=$1", [body.photoId])).rows[0];
    if (!found) throw new ApiError(404, "PHOTO_MISSING");
    if (body.action === "delete") {
      await database().query("DELETE FROM demand_photos WHERE id=$1", [body.photoId]);
      await unlink(demandPhotoPath(found.path)).catch(() => {});
      return json({ deleted: true });
    }
    const bytes = await readFile(demandPhotoPath(found.path)).catch(() => null);
    if (!bytes) throw new ApiError(404, "PHOTO_MISSING");
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
