// 20 natural buyer phrases for Feature O accuracy checks, mixing plain
// English, misspellings, Pidgin and local names. Written once against the
// demo catalog and never tuned to force a pass.
// expect: keywords that must all appear in one chosen product's brand+name.
// none: the catalog genuinely has no match (garri, medicines).
export const BUYER_AI_PHRASES = [
  { q: "indomie", expect: ["indomie"] },
  { q: "indomie chiken 70g", expect: ["indomie"] },
  { q: "I wan buy garri", none: true },
  { q: "peak milk", expect: ["peak"] },
  { q: "milo", expect: ["milo"] },
  { q: "lipton tea", expect: ["lipton"] },
  { q: "gino tomatoes", expect: ["gino"] },
  { q: "kings oil", expect: ["kings"] },
  { q: "mcvities biscuits", expect: ["mcvitie"] },
  { q: "nasco cornflakes", expect: ["nasco"] },
  { q: "quaker oat", expect: ["quaker"] },
  { q: "coke", expect: ["coca-cola"] },
  { q: "cadbury chocolate", expect: ["cadbury"] },
  { q: "groundnut", expect: ["peanuts"] },
  { q: "Abeg where I fit see rice?", expect: ["rice"] },
  { q: "sugar dangote", expect: ["dangote", "sugar"] },
  { q: "tuwo", none: true },
  { q: "custard vanilla", expect: ["custard"] },
  { q: "cheese balls", expect: ["cheese"] },
  { q: "paracetamol", none: true },
];
