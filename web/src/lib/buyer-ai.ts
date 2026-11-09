// AI-assisted buyer search (Feature O). Local matching always runs first;
// the AI is only a fallback for no-match and ambiguous queries. Pure logic
// shared by the interpret route and the tests; the server route adds caps,
// the model call and catalog checks. No query text is stored here.
// Self-contained (no lib imports) so node tests can load it directly;
// the caller supplies tokenized words and the local matcher.

export const AI_QUERY_MAX = 120;
export const AI_CANDIDATE_LIMIT = 12;
export const AI_CHOICE_LIMIT = 8;
export const AI_IDEA_MAX = 60;

export type BuyerCatalogRow = {
  id: string; brand: string; name: string; variant: string; size: string; unit: string;
};

export function validateAiQuery(value: unknown): string {
  if (typeof value !== "string") throw new Error("INVALID_SEARCH");
  const query = value.trim();
  if (!query || query.length > AI_QUERY_MAX) throw new Error("INVALID_SEARCH");
  return query;
}

export function requireAiConsent(value: unknown): void {
  if (value !== true) throw new Error("AI_CONSENT_REQUIRED");
}

function bigrams(word: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i + 1 < word.length; i++) set.add(word.slice(i, i + 2));
  return set;
}

function dice(leftWord: string, rightWord: string): number {
  if (leftWord === rightWord) return 1;
  const left = bigrams(leftWord), right = bigrams(rightWord);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared++;
  return (2 * shared) / (left.size + right.size);
}

// Loose candidate ranking for queries with no exact match: exact word hits
// score 1, near-miss spellings score by bigram similarity. Deterministic.
// Takes pre-tokenized query words (see catalogWords) to stay self-contained.
export function rankCandidates(words: string[], catalog: BuyerCatalogRow[], limit = AI_CANDIDATE_LIMIT): BuyerCatalogRow[] {
  if (!words.length) return [];
  return catalog
    .map((row) => {
      const haystack = `${row.brand} ${row.name} ${row.variant} ${row.size}`.toLowerCase();
      const hayWords = haystack.split(/[^a-z0-9]+/).filter(Boolean);
      let score = 0;
      for (const word of words) {
        if (haystack.includes(word)) { score += 1; continue; }
        let best = 0;
        for (const hay of hayWords) best = Math.max(best, dice(word, hay));
        if (best >= 0.25) score += best;
      }
      return { row, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score
      || `${a.row.brand} ${a.row.name} ${a.row.variant} ${a.row.size} ${a.row.id}`
        .localeCompare(`${b.row.brand} ${b.row.name} ${b.row.variant} ${b.row.size} ${b.row.id}`))
    .slice(0, limit)
    .map((entry) => entry.row);
}

export type SearchPlan =
  | { action: "local"; productIds: string[] }
  | { action: "ai"; candidates: BuyerCatalogRow[]; localIds: string[] }
  | { action: "not-in-catalog" };

// Local first: exact matches within the limit need no AI. Truncated (more
// than 8) matches and zero matches with fuzzy candidates go to the AI; the
// truncated case keeps its local IDs so caps and outages fall back to them.
// The caller supplies the local matcher and the tokenizer (see catalog-match).
export function planSearch(
  query: string,
  catalog: BuyerCatalogRow[],
  match: (query: string, catalog: BuyerCatalogRow[], limit?: number) => { matched: BuyerCatalogRow[]; truncated: boolean },
  tokenize: (query: string) => string[],
): SearchPlan {
  const found = match(query, catalog);
  if (found.matched.length && !found.truncated) {
    return { action: "local", productIds: found.matched.map((row) => row.id) };
  }
  if (found.truncated) {
    return {
      action: "ai",
      candidates: match(query, catalog, AI_CANDIDATE_LIMIT).matched,
      localIds: found.matched.map((row) => row.id),
    };
  }
  const fuzzy = rankCandidates(tokenize(query), catalog);
  if (!fuzzy.length) return { action: "not-in-catalog" };
  return { action: "ai", candidates: fuzzy, localIds: [] };
}

export type AiChoice = { productIds: string[]; notInCatalog: boolean; idea: string | null };

// Validate the model's structured answer. Returned IDs must come from the
// candidate list; invented IDs are dropped, never trusted. Anything without
// a valid ID becomes "not in catalog".
export function validateAiChoice(choice: unknown, candidateIds: string[]): AiChoice {
  const value = choice as Record<string, unknown>;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_MODEL_RESPONSE");
  if (!Array.isArray(value.productIds) || !value.productIds.every((id) => typeof id === "string")) {
    throw new Error("INVALID_MODEL_RESPONSE");
  }
  if (typeof value.notInCatalog !== "boolean") throw new Error("INVALID_MODEL_RESPONSE");
  if (value.idea !== null && typeof value.idea !== "string") throw new Error("INVALID_MODEL_RESPONSE");
  const valid = [...new Set((value.productIds as string[]).filter((id) => candidateIds.includes(id)))].slice(0, AI_CHOICE_LIMIT);
  const idea = typeof value.idea === "string" ? value.idea.trim().slice(0, AI_IDEA_MAX) || null : null;
  if (!valid.length) return { productIds: [], notInCatalog: true, idea };
  return { productIds: valid, notInCatalog: false, idea: null };
}
