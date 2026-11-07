// Group per-variant buyer result rows by shop for multi-variant display.
// Shops stay nearest-first; variants keep their search order.
export type ShopRow = { shop_id: string; distance_km: number | string };
export function groupShopsByShop<R extends ShopRow>(rows: R[]): { shopId: string; distanceKm: number; variants: R[] }[] {
  const groups = new Map<string, { shopId: string; distanceKm: number; variants: R[] }>();
  for (const row of rows) {
    const known = groups.get(row.shop_id);
    if (known) known.variants.push(row);
    else groups.set(row.shop_id, { shopId: row.shop_id, distanceKm: Number(row.distance_km), variants: [row] });
  }
  return [...groups.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}
