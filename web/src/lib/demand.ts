// Unmet-demand settings and area cells (Feature P). Threshold values were
// confirmed by the owner on 9 November 2026 and live only here.
// Self-contained (no lib imports) so node tests can load it directly.
export const DEMAND_SETTINGS = {
  cellKm: 2,
  alertRangeKm: 5, // served as the shop's own cell plus the 8 adjacent cells
  visitorThreshold: 5,
  photoRetentionDays: 7,
  photosPerVisitorPerDay: 3,
} as const;

// Grid step in degrees: 2 km is about 2/111 degrees. Near Kubwa (9N) the
// longitude step spans roughly 1.95 km. Documented approximation;
// deterministic, and only the cell ID is ever stored, never coordinates.
export const DEMAND_CELL_STEP = 2 / 111;

export function demandCellId(latitude: number, longitude: number): string {
  return `${Math.floor(latitude / DEMAND_CELL_STEP)}:${Math.floor(longitude / DEMAND_CELL_STEP)}`;
}

export function neighborCells(cellId: string): string[] {
  const [lat, lng] = cellId.split(":").map(Number);
  const cells: string[] = [];
  for (let dLat = -1; dLat <= 1; dLat++) {
    for (let dLng = -1; dLng <= 1; dLng++) cells.push(`${lat + dLat}:${lng + dLng}`);
  }
  return cells;
}

export type DemandKind = "product" | "idea";

export type DemandGroup = {
  kind: DemandKind;
  key: string;
  cell: string;
  visitors: number;
  simulated: boolean;
};

// At most one alert per demand key per day: keep the shop's own cell first,
// then the highest count. Pure so the rule stays testable.
export function dedupeAlertsByKey<T extends DemandGroup>(groups: T[], ownCell: string): T[] {
  const best = new Map<string, T>();
  for (const group of groups) {
    const prev = best.get(`${group.kind}:${group.key}`);
    if (!prev) { best.set(`${group.kind}:${group.key}`, group); continue; }
    const prevOwn = prev.cell === ownCell, nextOwn = group.cell === ownCell;
    if ((nextOwn && !prevOwn) || (nextOwn === prevOwn && group.visitors > prev.visitors)) {
      best.set(`${group.kind}:${group.key}`, group);
    }
  }
  return [...best.values()];
}

// A shop that stocks a product never gets an alert for it.
export function filterStockedAlerts<T extends DemandGroup>(groups: T[], stockedProductIds: string[]): T[] {
  const stocked = new Set(stockedProductIds);
  return groups.filter((group) => group.kind !== "product" || !stocked.has(group.key));
}
