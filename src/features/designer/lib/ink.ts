import type { DesignContent, DesignElement } from "../types";

/*
 * The colours a design uses, for the pro "สีในงาน" panel and the "แยกหมึก" view (C8 Phase 3). Pure helpers over
 * the document: no prices, no conversions to CMYK (a CMYK value is only ever shown where the brand kit stored one —
 * the browser has no ICC profile, GLOBAL-RULES §3).
 */

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

export function normaliseHex(colour: string): string | null {
  const m = HEX.exec(colour.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  return `#${h.toLowerCase()}`;
}

/** A near-neutral dark colour that prints with the black ink alone. */
export function isBlackInk(colour: string): boolean {
  const hex = normaliseHex(colour);
  if (!hex) return false;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(r, g, b) < 60 && Math.max(r, g, b) - Math.min(r, g, b) < 25;
}

/** The flat colours an element prints with (fills, strokes, a gradient's two ends); an image has none. */
export function coloursOfElement(el: DesignElement): string[] {
  const out: string[] = [];
  const add = (c: string | undefined) => {
    const hex = c ? normaliseHex(c) : null;
    if (hex) out.push(hex);
  };
  switch (el.type) {
    case "text":
      if (el.fillGradient) {
        add(el.fillGradient.from);
        add(el.fillGradient.to);
      } else add(el.fill);
      break;
    case "code":
      add(el.fill);
      add(el.background);
      break;
    case "image":
      break;
    default:
      if (el.fillGradient) {
        add(el.fillGradient.from);
        add(el.fillGradient.to);
      } else if (!el.open) add(el.fill);
      if (el.strokeWidth > 0) add(el.stroke);
  }
  return out;
}

/** Which ink an element belongs to in the "แยกหมึก" view: black only, colour, or both. */
export function inkOf(el: DesignElement): "black" | "colour" | "both" {
  if (el.type === "image") return el.mono ? "black" : "colour";
  const colours = coloursOfElement(el).filter((c) => c !== "#ffffff");
  if (!colours.length) return "black";
  const black = colours.filter(isBlackInk).length;
  return black === colours.length ? "black" : black === 0 ? "colour" : "both";
}

/** Every flat colour used on both sides (and the background), with how many places use it — most used first. */
export function documentColours(content: DesignContent): { colour: string; uses: number }[] {
  const counts = new Map<string, number>();
  const add = (c: string | undefined) => {
    const hex = c ? normaliseHex(c) : null;
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };
  for (const el of content.elements) if (!el.hidden) coloursOfElement(el).forEach(add);
  const p = content.pattern;
  if (p.kind === "solid") add(p.color);
  else if (p.kind !== "none" && p.kind !== "image") {
    add(p.color);
    add(p.background);
  }
  return [...counts.entries()].map(([colour, uses]) => ({ colour, uses })).sort((a, b) => b.uses - a.uses);
}

/** Replaces one colour everywhere — every element on both sides, gradients, strokes, codes and the background. */
export function recolour(content: DesignContent, from: string, to: string): DesignContent {
  const a = normaliseHex(from);
  const b = normaliseHex(to);
  if (!a || !b || a === b) return content;
  const swap = (c: string | undefined) => (c && normaliseHex(c) === a ? b : c);
  const elements = content.elements.map((el) => {
    if (el.type === "image") return el;
    const next = { ...el } as DesignElement & Record<string, unknown>;
    if ("fill" in next) next.fill = swap(next.fill as string)!;
    if ("stroke" in next) next.stroke = swap(next.stroke as string)!;
    if ("background" in next) next.background = swap(next.background as string)!;
    const gradient = (el as { fillGradient?: { from: string; to: string } }).fillGradient;
    if (gradient) next.fillGradient = { ...gradient, from: swap(gradient.from)!, to: swap(gradient.to)! };
    return next as DesignElement;
  });
  const p = content.pattern;
  return { ...content, elements, pattern: { ...p, color: swap(p.color)!, background: swap(p.background)! } };
}
