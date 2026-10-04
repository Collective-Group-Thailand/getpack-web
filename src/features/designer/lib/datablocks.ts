import type { NewElement } from "../types";

/**
 * Structured text blocks (U4.4 "data blocks"): ingredients, nutrition and the manufacturer's
 * details typed into forms and set as text — a bold title and its lines, grouped — so the
 * customer fills facts in, not layout. Thai has no spaces between words, so lines are broken at
 * word boundaries (`Intl.Segmenter`) and measured, never in the middle of a word or between a
 * consonant and its vowel or tone mark.
 */

export type Measure = (text: string, fontSizeMm: number) => number;

/** Lines of `text` no wider than `widthMm`, broken between words (Thai segmented, Latin at spaces). */
export function wrapText(text: string, widthMm: number, fontSizeMm: number, measure: Measure, locale = "th"): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words =
      typeof Intl !== "undefined" && "Segmenter" in Intl
        ? [...new Intl.Segmenter(locale, { granularity: "word" }).segment(paragraph)].map((s) => s.segment)
        : paragraph.split(/(\s+)/);
    let line = "";
    for (const word of words) {
      const next = line + word;
      if (line && measure(next.trimEnd(), fontSizeMm) > widthMm) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export interface NutritionFacts {
  serving: string;
  energyKcal: string;
  fatG: string;
  sugarG: string;
  sodiumMg: string;
}

export interface Manufacturer {
  name: string;
  address: string;
  phone: string;
  /** Thai FDA food serial number (เลขสารบบอาหาร), as the customer has it. */
  fdaNumber: string;
}

export type DataBlock =
  | { kind: "ingredients"; text: string }
  | { kind: "nutrition"; facts: NutritionFacts }
  | { kind: "manufacturer"; details: Manufacturer };

export interface BlockWords {
  title: Record<DataBlock["kind"], string>;
  serving: string;
  energy: string;
  fat: string;
  sugar: string;
  sodium: string;
  phone: string;
  fda: string;
}

/** The block's title and lines, in the customer's language. */
export function blockLines(block: DataBlock, words: BlockWords): { title: string; body: string } {
  const title = words.title[block.kind];
  if (block.kind === "ingredients") return { title, body: block.text.trim() };
  if (block.kind === "nutrition") {
    const f = block.facts;
    return {
      title,
      body: [
        `${words.serving} ${f.serving}`,
        `${words.energy} ${f.energyKcal}`,
        `${words.fat} ${f.fatG}`,
        `${words.sugar} ${f.sugarG}`,
        `${words.sodium} ${f.sodiumMg}`,
      ].join("\n"),
    };
  }
  const m = block.details;
  return {
    title,
    body: [m.name, m.address, m.phone ? `${words.phone} ${m.phone}` : "", m.fdaNumber ? `${words.fda} ${m.fdaNumber}` : ""]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * The block as two grouped text elements — the bold title, then its wrapped lines — at `at`,
 * `widthMm` wide, in `fontFamily` (`fontSizeMm` for the lines, a little larger for the title).
 */
export function blockElements(
  block: DataBlock,
  words: BlockWords,
  at: { x: number; y: number },
  options: { widthMm: number; fontSizeMm: number; fontFamily: string; fill: string; groupId: string; measure: Measure },
): NewElement[] {
  const { title, body } = blockLines(block, words);
  const titleSize = options.fontSizeMm * 1.25;
  const base = { rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, groupId: options.groupId, align: "left" as const };
  const lines = wrapText(body, options.widthMm, options.fontSizeMm, options.measure);
  return [
    { ...base, type: "text", x: at.x, y: at.y, text: title, fontSize: titleSize, fontFamily: options.fontFamily, fontStyle: "bold", fill: options.fill, name: title },
    {
      ...base,
      type: "text",
      x: at.x,
      y: at.y + titleSize * 1.4,
      text: lines.join("\n"),
      fontSize: options.fontSizeMm,
      fontFamily: options.fontFamily,
      fontStyle: "normal",
      fill: options.fill,
    },
  ] as NewElement[];
}
