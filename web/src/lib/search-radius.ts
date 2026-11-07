// Deterministic search widening (non-AI part of Feature O).
// Every search starts at the requested radius (5 km in the UI) and widens
// through 10 and 20 km only while nothing eligible is found.
export function wideningSteps(requestedKm: number): number[] {
  return [...new Set([requestedKm, 10, 20].filter((r) => r >= requestedKm && r <= 50))];
}

// Plain words for automatic widening. Null when nothing widened.
export function widenMessage(requestedKm: number, searchedKm: number): string | null {
  if (searchedKm <= requestedKm) return null;
  const previous = searchedKm === 20 && requestedKm < 10 ? 10 : requestedKm;
  return `No shops within ${previous} km, showing the nearest within ${searchedKm} km`;
}
