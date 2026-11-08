import { timingSafeEqual } from "node:crypto";

// Interim operator gate for the custom-product review list: the demo access
// code, compared in constant time. Disabled when unset.
export function verifyOperatorCode(provided: unknown): boolean {
  const expected = process.env.DEMO_ACCESS_CODE;
  if (typeof provided !== "string" || !expected?.trim()) return false;
  const a = Buffer.from(provided), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
