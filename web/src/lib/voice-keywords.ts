// Vocabulary biasing for Muse Voice Transcribe (reference:
// https://dev.meta.ai/docs/speech-to-text, "Bias toward your own
// vocabulary", checked 7 November 2026). The reference publishes no count
// or length limit for `keywords`, so this module applies a conservative
// self-imposed cap to keep requests small.
export const VOICE_ACTION_WORDS = ["sold", "sale", "restock", "bought", "recount", "packs", "carton"];
export const VOICE_KEYWORD_LIMIT = 100;
export const VOICE_KEYWORD_CHARS = 40;
export function buildVoiceKeywords(brands: string[], names: string[], limit = VOICE_KEYWORD_LIMIT): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const raw of [...VOICE_ACTION_WORDS, ...brands, ...names]) {
    if (typeof raw !== "string") continue;
    const word = raw.trim();
    if (!word || word.length > VOICE_KEYWORD_CHARS) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}
