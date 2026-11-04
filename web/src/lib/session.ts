import { createHmac, timingSafeEqual } from "node:crypto";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}
export function equalSecret(left: string, right: string) {
  // Hash first so timingSafeEqual operates on equal-length values.
  const digest = (value: string) => createHmac("sha256", "market-assistant-comparison").update(value).digest();
  return timingSafeEqual(digest(left), digest(right));
}
export function signSession(actorId: string, secret: string, now = Date.now()) {
  if (!isUuid(actorId) || secret.length < 32) throw new Error("Invalid session configuration");
  const payload = Buffer.from(JSON.stringify({ actorId, expires: now + 8 * 3600000 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function verifySession(token: string, secret: string, now = Date.now()): string | null {
  if (secret.length < 32 || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret).update(parts[0]).digest("base64url");
  if (!equalSecret(parts[1], expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!isUuid(payload.actorId) || !Number.isSafeInteger(payload.expires) || payload.expires <= now || payload.expires > now + 8 * 3600000) return null;
    return payload.actorId;
  } catch { return null; }
}
