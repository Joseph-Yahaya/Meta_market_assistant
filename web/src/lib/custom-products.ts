// Trader-added product rules (Feature N). Pure checks shared by the app
// and the creation route; the server always re-checks before inserting.
// Self-contained (no lib imports) so node tests can load it directly.

export const CUSTOM_CATEGORIES = ["provisions", "household", "personal care"];
export const CUSTOM_PRODUCT_LIMIT_PER_DAY = 10;
const REGULATED_WORDS = [
  "medicine", "medicines", "drug", "drugs", "pharmaceutical", "pharmaceuticals",
  "pharmacy", "antibiotic", "antibiotics", "vaccine", "vaccines", "insulin",
  "paracetamol", "ibuprofen", "aspirin", "antimalarial",
];
const REGULATED_CATEGORIES = ["medicines", "pharmaceuticals", "drugs", "pharmacy"];

export function normalizeProductText(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function isRegulatedProduct(input: { name: string; brand: string; category: string }): boolean {
  const category = normalizeProductText(input.category);
  if (REGULATED_CATEGORIES.includes(category)) return true;
  const words = new Set(`${normalizeProductText(input.name)} ${normalizeProductText(input.brand)}`.split(" ").filter(Boolean));
  return REGULATED_WORDS.some((word) => words.has(word));
}

export type CustomProductInput = { name: string; brand: string; size: string; unit: string; category: string; variant?: string };
export type CustomProduct = { name: string; brand: string; variant: string; size: string; unit: "piece" | "pack" | "carton" | "bottle"; category: string };
// Length, unit and regulated-goods rules. Throws a stable error code.
export function validateCustomProduct(input: CustomProductInput): CustomProduct {
  const name = input.name.trim(), brand = input.brand.trim(), size = input.size.trim(), category = normalizeProductText(input.category);
  const variant = (input.variant ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("INVALID_PRODUCT_NAME");
  if (brand.length > 80) throw new Error("INVALID_PRODUCT_BRAND");
  if (variant.length > 40) throw new Error("INVALID_PRODUCT_VARIANT");
  if (size.length < 1 || size.length > 40) throw new Error("INVALID_PRODUCT_SIZE");
  if (!["piece", "pack", "carton", "bottle"].includes(input.unit)) throw new Error("INVALID_PRODUCT_UNIT");
  if (category.length < 1 || category.length > 40) throw new Error("INVALID_PRODUCT_CATEGORY");
  if (isRegulatedProduct({ name, brand, category })) throw new Error("REGULATED_PRODUCT");
  return { name, brand: brand || "Unbranded", variant: variant || "Standard", size, unit: input.unit as CustomProduct["unit"], category };
}

export type CatalogRow = { name: string; brand: string; size: string; variant?: string };
function tokenSet(value: string): Set<string> {
  return new Set(normalizeProductText(value).split(" ").filter(Boolean));
}
function similarity(a: string, b: string): number {
  const left = tokenSet(a), right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return (2 * shared) / (left.size + right.size);
}
// Exact matches must reuse the existing product; near matches and
// out-of-scope categories go to owner review instead of going live.
export function checkCustomFlags(
  product: CustomProduct,
  catalog: CatalogRow[],
): { duplicate: boolean; flags: string[] } {
  const key = `${normalizeProductText(product.name)}|${normalizeProductText(product.brand)}|${normalizeProductText(product.variant ?? "standard")}|${normalizeProductText(product.size)}`;
  const flags: string[] = [];
  let duplicate = false;
  let best = 0;
  for (const row of catalog) {
    const rowKey = `${normalizeProductText(row.name)}|${normalizeProductText(row.brand)}|${normalizeProductText(row.variant ?? "standard")}|${normalizeProductText(row.size)}`;
    if (rowKey === key) {
      duplicate = true;
      break;
    }
    best = Math.max(best, similarity(`${product.name} ${product.brand} ${product.size}`, `${row.name} ${row.brand} ${row.size}`));
  }
  if (!duplicate && best >= 0.8) flags.push("possible-duplicate");
  if (!CUSTOM_CATEGORIES.includes(product.category)) flags.push("category-review");
  return { duplicate, flags };
}

// Fill proposal gaps from a second photo (usually the back label).
// The primary photo always wins conflicts.
export type ProposalLike = {
  name: string | null; brand: string | null; size: string | null;
  unit: string | null; category: string | null; notes: string | null;
};
export function mergeProposals<P extends ProposalLike>(primary: P, secondary: P): P {
  const out = { ...primary };
  (["name", "brand", "size", "unit", "category", "notes"] as const).forEach((key) => {
    if (out[key] == null) out[key] = secondary[key] as P[typeof key];
  });
  return out;
}

// Closest existing products for the "Is it one of these?" step.
// Takes pre-tokenized query words (see catalogWords) to stay self-contained.
export function findClosestProducts<P extends CatalogRow>(words: string[], catalog: P[], limit = 3): P[] {
  if (!words.length) return [];
  return catalog
    .map((row) => {
      const haystack = `${row.brand} ${row.name} ${row.size}`.toLowerCase();
      const score = words.filter((word) => haystack.includes(word)).length / words.length;
      return { row, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || `${a.row.brand} ${a.row.name}`.localeCompare(`${b.row.brand} ${b.row.name}`))
    .slice(0, limit)
    .map((entry) => entry.row);
}
