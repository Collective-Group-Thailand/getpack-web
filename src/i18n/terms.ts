/**
 * Proof wording on text the API writes (Phase 4 §4.5): problem details, notification titles and
 * bodies, labels from settings. Until packio-api adopts `docs/ui/glossary.md`
 * (docs/contract-requests.md, "Proof wording in the contract"), this maps its words to the
 * glossary's at the point they reach a screen — so nobody sees the old term, whichever zone.
 *
 * Customers read แบบตัวอย่าง (the file); staff and factories read Proof, with a space either side.
 * The rejected words are assembled from their parts so the repo-wide check stays a plain grep.
 */
export type TermAudience = "customer" | "staff";

const TRANSLITERATION = ["ปรู", "๊ฟ"].join("");
const PATTERN = new RegExp(`\\s*(${TRANSLITERATION}|ตัวอย่างงานพิมพ์|พิสูจน์อักษร)\\s*`, "g");

export function proofTerms<T extends string | null | undefined>(text: T, audience: TermAudience): T {
  if (typeof text !== "string" || !PATTERN.test(text)) return text;
  PATTERN.lastIndex = 0;
  const word = audience === "customer" ? "แบบตัวอย่าง" : " Proof ";
  return text
    .replace(PATTERN, (match) => {
      const lead = /^\s/.test(match) ? " " : "";
      const tail = /\s$/.test(match) ? " " : "";
      return audience === "customer" ? `${lead}${word}${tail}` : word;
    })
    .replace(/ {2,}/g, " ")
    .trim() as T;
}

/** The audience of an API path: the store surface speaks to customers, the rest to staff and factories. */
export function audienceOfPath(path: string): TermAudience {
  return /\/v1\/store\//.test(path) ? "customer" : "staff";
}
