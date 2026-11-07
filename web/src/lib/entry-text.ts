// Client-side reading help for trader entries. Nothing here applies an
// action, quantity or product silently: it only cleans text before
// interpretation or suggests a clarifying question the trader answers.
const FILLERS = ["today", "please", "abeg", "um"];
export function cleanEntryText(text: string): { text: string; saidToday: boolean } {
  const saidToday = /\btoday\b/i.test(text);
  const cleaned = text
    .split(/\s+/)
    .filter((w) => w && !FILLERS.includes(w.toLowerCase().replace(/[.,!?;:]+$/, "")))
    .join(" ");
  return { text: cleaned, saidToday };
}
// Entry dates are always the confirmation moment, so "today" needs no date
// input: stripping it keeps the model focused without changing the record.

// Small deterministic list of likely mishearings. It only triggers the
// "Did you mean ...?" question, never an automatic choice.
const MISHEARINGS: { action: "sale" | "restock"; words: string[] }[] = [
  { action: "restock", words: ["restock", "restocked", "restocking", "restop", "restack"] },
  { action: "sale", words: ["sale", "sell", "saw", "sail"] },
];
export function likelyAction(text: string): { action: "sale" | "restock"; heard: string } | null {
  const lower = ` ${text.toLowerCase()} `;
  if (lower.includes("we stock")) return { action: "restock", heard: "we stock" };
  for (const { action, words } of MISHEARINGS)
    for (const word of words) if (new RegExp(`\\b${word}\\b`).test(lower)) return { action, heard: word };
  return null;
}

export type PresetAction = "sale" | "restock" | "recount";
// Applies a trader-tapped preset to a model extraction. A conflicting model
// action is reported, never overwritten silently.
export function applyActionPreset(
  action: "sale" | "restock" | "recount" | null,
  preset: PresetAction,
): { action: PresetAction; conflict: string | null } {
  if (action && action !== preset) return { action: preset, conflict: action };
  return { action: action || preset, conflict: null };
}
