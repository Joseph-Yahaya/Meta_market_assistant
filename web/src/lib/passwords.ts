import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt=promisify(scryptCallback);
export function normalizeEmail(value: unknown): string {
  if (typeof value!=="string") throw new Error("INVALID_EMAIL");
  const email=value.trim().toLowerCase();
  if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  return email;
}
export function validPassword(value: unknown): value is string {
  return typeof value==="string" && value.length>=10 && value.length<=128;
}
export async function hashPassword(password: string) {
  if (!validPassword(password)) throw new Error("INVALID_PASSWORD");
  const salt=randomBytes(16).toString("hex");
  const hash=await scrypt(password,salt,64) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}
export async function checkPassword(password: string, stored: string) {
  if (!validPassword(password)) return false;
  const [algorithm,salt,hex]=stored.split(":");
  if (algorithm!=="scrypt" || !/^[a-f0-9]{32}$/.test(salt||"") || !/^[a-f0-9]{128}$/.test(hex||"")) return false;
  const candidate=await scrypt(password,salt,64) as Buffer;
  return timingSafeEqual(candidate,Buffer.from(hex,"hex"));
}
