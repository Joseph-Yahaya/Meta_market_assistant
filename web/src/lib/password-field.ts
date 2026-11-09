// Password-field helpers shared by the trader and operator pages.
// Self-contained (no lib imports) so node tests can load it directly.

// A revealed password returns to hidden only after the page has been out
// of focus for more than the limit (default one minute). Boundary is strict:
// exactly 60 seconds away does not hide.
export function shouldHideAfterBlur(awayStartMs: number | null, nowMs: number, limitMs = 60000): boolean {
  return awayStartMs !== null && nowMs - awayStartMs > limitMs;
}
