// Proposal polish for trader-added products. Pure normalization shared by
// the app and the creation route; the server always re-checks before inserting.
// Self-contained (no lib imports) so node tests can load it directly.

export const POLISHED_CATEGORIES = ["provisions", "household", "personal care"];
const REGULATED_CATEGORIES = ["medicines", "pharmaceuticals", "drugs", "pharmacy"];
// Household is checked before personal care so "washing soap" and "dish soap"
// win over the generic "soap". Food phrases stay specific ("palm oil", never
// bare "oil") so "engine oil" and "hair oil" do not land in provisions.
const HOUSEHOLD_WORDS = [
  "detergent", "laundry", "fabric softener", "bleach", "disinfectant",
  "cleaner", "cleaning", "dishwash", "dish soap", "washing soap", "laundry soap",
  "scouring", "toilet paper", "tissue", "mop", "broom", "bucket", "sponge",
  "insecticide", "mosquito coil", "air freshener", "trash bag", "garbage bag",
  "engine oil", "motor oil",
];
const PERSONAL_WORDS = [
  "toothpaste", "toothbrush", "mouthwash", "dental", "floss",
  "soap", "shampoo", "conditioner", "body wash", "hand sanitizer",
  "lotion", "face cream", "body cream", "hand cream", "baby cream", "skin cream",
  "deodorant", "roll-on", "sanitary", "diaper", "perfume", "body spray",
  "cosmetic", "makeup", "shaving", "sunscreen", "lip balm",
];
const PROVISION_WORDS = [
  "provisions", "food", "grocery", "groceries", "drink", "drinks",
  "beverage", "beverages", "snack", "snacks", "dairy", "bakery",
  "confectionery", "frozen", "ice cream", "milk", "yoghurt", "yogurt",
  "bread", "rice", "beans", "noodles", "pasta", "spaghetti", "biscuit",
  "chocolate", "sweets", "candy", "tea", "coffee", "juice", "soda",
  "malt", "water", "palm oil", "groundnut oil", "vegetable oil",
  "sugar", "salt", "flour", "cereal", "oats", "honey", "jam",
  "sauce", "ketchup", "mayonnaise", "tin tomato", "sardine", "mackerel",
  "egg", "seasoning", "spice",
];

function mentions(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

// Map the AI's category to the allowed ones. Regulated categories pass
// through unchanged so the refusal check still catches them; unknown
// categories pass through so the owner still reviews them.
export function mapCategory(category: string, name: string, brand: string): string {
  const raw = category.toLowerCase().trim().replace(/\s+/g, " ");
  if (REGULATED_CATEGORIES.includes(raw)) return category.trim();
  if ((POLISHED_CATEGORIES as string[]).includes(raw)) return raw;
  const combined = `${raw} ${name.toLowerCase()} ${brand.toLowerCase()}`.replace(/\s+/g, " ");
  if (mentions(combined, HOUSEHOLD_WORDS)) return "household";
  if (mentions(combined, PERSONAL_WORDS)) return "personal care";
  if (mentions(combined, PROVISION_WORDS)) return "provisions";
  if (!raw) return "";
  return category.trim();
}

function tidyNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

// Normalize a size to a compact metric form: "6.0 OZ (170 g)" becomes
// "170g". Metric units are kept and tidied; imperial units convert.
export function normalizeSize(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  const paren = text.match(/\(\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|cl)\s*\)/i);
  if (paren) {
    const unit = paren[2].toLowerCase() === "l" ? "L" : paren[2].toLowerCase();
    return `${tidyNumber(Number(paren[1]))}${unit}`;
  }
  const imperial = text.match(/(\d+(?:\.\d+)?)\s*(fl\.?\s?oz\.?|oz\.?|lbs?\.?|pints?|quarts?|gallons?)/i);
  if (imperial) {
    const amount = Number(imperial[1]), unit = imperial[2].toLowerCase();
    if (unit.startsWith("fl")) return `${Math.round(amount * 29.5735)}ml`;
    if (unit.startsWith("oz")) return `${Math.round(amount * 28.3495)}g`;
    if (unit.startsWith("lb")) return `${Math.round(amount * 453.592)}g`;
    if (unit.startsWith("pint")) return `${Math.round(amount * 473.176)}ml`;
    if (unit.startsWith("quart")) return `${Math.round(amount * 946.353)}ml`;
    return `${Math.round(amount * 3785.41)}ml`;
  }
  const compact = text.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i);
  if (compact) {
    const unit = compact[2].toLowerCase() === "l" ? "L" : compact[2].toLowerCase();
    return `${tidyNumber(Number(compact[1]))}${unit}`;
  }
  return text.slice(0, 40);
}

export type SplitName = { name: string; brand: string; variant: string; size: string };
// Split brand, short name and variant so the brand is not repeated, and move
// a size-like tail into the size when no size was given.
export function splitBrandName(name: string, brand: string, size: string): SplitName {
  const original = name.trim();
  let short = original;
  const cleanBrand = brand.trim();
  let variant = "Standard";
  if (cleanBrand && short.toLowerCase().startsWith(cleanBrand.toLowerCase())) {
    const rest = short.slice(cleanBrand.length);
    if (rest.trim() && /^[\s\-–(:]/.test(rest)) short = rest.replace(/^[\s\-–(:]+/, "").trim() || short;
  }
  const paren = short.match(/^(.*)\(\s*([^()]{1,40})\s*\)$/);
  if (paren && paren[1].trim()) {
    variant = paren[2].trim();
    short = paren[1].trim();
  } else {
    const dash = short.match(/^(.*\S)\s+-\s+([^-]{1,40})$/);
    if (dash && dash[1].trim() && dash[2].trim()) {
      variant = dash[2].trim();
      short = dash[1].trim();
    }
  }
  let cleanSize = size.trim();
  if (!cleanSize) {
    const tail = short.match(/^(.*\S)\s+(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|cl|oz|lb|fl\.?\s?oz))(?:\s*\(.*\))?$/i);
    if (tail && tail[1].trim()) {
      cleanSize = normalizeSize(tail[2]);
      short = tail[1].trim();
    }
  }
  return { name: short || original, brand: cleanBrand, variant, size: cleanSize ? normalizeSize(cleanSize) : "" };
}

export type RawProposal = {
  name: string | null; brand: string | null; size: string | null;
  unit: string | null; category: string | null;
};
export type PolishedProposal = {
  name: string; brand: string; variant: string; size: string;
  unit: string | null; category: string;
};
export function polishProposal(proposal: RawProposal): PolishedProposal {
  const category = mapCategory(proposal.category ?? "", proposal.name ?? "", proposal.brand ?? "");
  const split = splitBrandName(proposal.name ?? "", proposal.brand ?? "", proposal.size ?? "");
  return {
    name: split.name, brand: split.brand, variant: split.variant, size: split.size,
    unit: proposal.unit, category: category || "provisions",
  };
}

// All four selling units pluralize with a plain "s": 1 piece, 2 pieces.
export function pluralizeUnit(unit: string, quantity: number): string {
  return quantity === 1 ? unit : `${unit}s`;
}
