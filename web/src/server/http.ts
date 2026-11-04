import "server-only";
import { MetaError } from "@/lib/meta-client";
export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415,"JSON_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400,"BODY_REQUIRED");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new ApiError(413,"BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400,"INVALID_JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400,"INVALID_BODY");
  return body as Record<string, unknown>;
}
export function requireSameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expected) throw new ApiError(403,"ORIGIN_NOT_ALLOWED");
}
export function json(data: unknown, status = 200) {
  return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
}
export function failure(error: unknown) {
  if (error instanceof ApiError) return json({error:{code:error.code}},error.status);
  if (error instanceof MetaError) return json({error:{code:error.code}},error.code==="META_RATE_LIMITED"?429:error.code==="META_NOT_CONFIGURED"?503:502);
  if (error && typeof error === "object" && "code" in error && ["22007","22008"].includes(String(error.code))) {
    return json({error:{code:"INVALID_DATE"}},400);
  }
  const message = error instanceof Error ? error.message : "";
  const codes: Record<string, number> = {
    FORBIDDEN:403, INVALID_KEY:400, INVALID_ENTRY:400, KEY_REUSED:409,
    UNKNOWN_PRODUCT:400, INVALID_EXPIRY:400, INVALID_BATCH:400, BATCH_REQUIRED:400, INVALID_CORRECTION:400,
    OPENING_EXISTS:409, INSUFFICIENT_STOCK_RECOUNT_REQUIRED:409,
  };
  if (codes[message]) return json({error:{code:message}},codes[message]);
  // Driver details can contain connection information or private values: never return them.
  return json({error:{code:"DATABASE_UNAVAILABLE",message:"The database is not ready. No successful stock change has been confirmed."}},503);
}
