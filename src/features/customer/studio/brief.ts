import { getStyle, isStyleId } from "@getpack/dieline";

import { sizeOf } from "@/features/designer/document";
import type { DesignContent, DesignSpec } from "@/features/designer/types";

export interface BriefWords {
  box: string;
  size: string;
  material: string;
  print: string;
  printMethod: Record<"digital" | "offset" | "flexo" | "none", string>;
  colours: string;
  texts: string;
  images: string;
  none: string;
  mm: string;
}

const MAX_TEXTS = 8;
const MAX_COLOURS = 6;

/**
 * The brief "ให้ทีมออกแบบให้" starts from (U4.8, D-286): the box, its size and material, the print
 * method, the colours already used, every text placed (the customer's own words) and how many
 * pictures — one line each, in the customer's language, for the designer to read before opening the
 * same document. Pure.
 */
export function briefOf(spec: DesignSpec, content: DesignContent, locale: "th" | "en", w: BriefWords): string {
  const style = isStyleId(spec.styleId) ? getStyle(spec.styleId).name[locale] : spec.styleId;
  const colours = [
    ...new Set(
      content.elements
        .flatMap((el) => [
          ("fill" in el ? el.fill : undefined) as unknown,
          ("stroke" in el ? el.stroke : undefined) as unknown,
        ])
        .concat(content.pattern.kind === "none" ? [] : [content.pattern.color])
        .filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
        .map((c) => c.toLowerCase()),
    ),
  ].slice(0, MAX_COLOURS);
  const texts = content.elements
    .flatMap((el) => (el.type === "text" && el.text.trim() ? [el.text.trim().replace(/\s+/g, " ")] : []))
    .slice(0, MAX_TEXTS);
  const images = content.elements.filter((el) => el.type === "image").length;
  const method = spec.studio?.printMethod;
  return [
    `${w.box}: ${style}`,
    `${w.size}: ${sizeOf(spec).text} ${w.mm}`,
    spec.materialName ? `${w.material}: ${spec.materialName}` : null,
    method ? `${w.print}: ${w.printMethod[method]}` : null,
    `${w.colours}: ${colours.length ? colours.join(", ") : w.none}`,
    `${w.texts}: ${texts.length ? texts.map((text) => `“${text}”`).join(", ") : w.none}`,
    `${w.images}: ${images}`,
  ]
    .filter(Boolean)
    .join("\n");
}
