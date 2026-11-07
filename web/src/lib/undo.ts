// Undo planning: every undo is a set of per-batch recounts restoring the
// pre-command estimates. History stays append-only; the reversal is new
// compensating events linked to the originals.
export const UNDO_WINDOW_SECONDS = 60;
export type UndoEvent = { id: string; batchId: string; delta: number };
export function planUndo(
  events: UndoEvent[],
  currentQty: Record<string, number>,
): { batchId: string; quantity: number; correctsEventId: string }[] {
  if (!events.length) throw new Error("UNDO_BLOCKED");
  return events.map((event) => {
    const current = currentQty[event.batchId];
    if (current === undefined) throw new Error("UNDO_BLOCKED");
    const target = current - event.delta;
    if (!Number.isSafeInteger(target) || target < 0 || target > 100000) throw new Error("UNDO_BLOCKED");
    return { batchId: event.batchId, quantity: target, correctsEventId: event.id };
  });
}
