export type ModelScope = "interpret" | "transcribe" | "buyer-voice";
export const DAILY_CAP_DEFAULTS: Record<ModelScope | "global", number> = {
  interpret: 100,
  transcribe: 50,
  "buyer-voice": 20,
  global: 500,
};
const ENV_KEYS: Record<ModelScope | "global", string> = {
  interpret: "MODEL_DAILY_CAP_INTERPRET",
  transcribe: "MODEL_DAILY_CAP_TRANSCRIBE",
  "buyer-voice": "MODEL_DAILY_CAP_BUYER_VOICE",
  global: "MODEL_DAILY_CAP_GLOBAL",
};
function parseCap(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value < 1 || value > 100000) return fallback;
  return value;
}
export function dailyCapFor(scope: ModelScope | "global", env: NodeJS.ProcessEnv = process.env): number {
  return parseCap(env[ENV_KEYS[scope]], DAILY_CAP_DEFAULTS[scope]);
}
export function dailyDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
export function dailyLimitReached(attempts: number, limit: number): boolean {
  return attempts > limit;
}
