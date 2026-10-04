import type { Pt } from "@packio/dieline";

import type { DesignContent, DesignElement } from "../types";
import { barcodeMinWidth, spotColours, type DesignIssue, type PrintRule } from "./checks";
import { outOfPrintGamut } from "./colour";
import { boxOf } from "./geometry";

/**
 * The checks' one-click fixes (U4.5): only where the fix is safe — it changes nothing the customer
 * would not have asked for to clear that finding, and leaves no violation of it behind (tested).
 * Pure: the design and the sheet's geometry in, the fixed design out.
 *
 * - move inside: the element shifted (and only if it cannot fit, shrunk) into the safe area of the
 *   face it is on;
 * - extend to bleed: an unturned shape or image stretched past every cut edge it nearly meets;
 * - text, hairline, barcode: brought up to the rule's minimum;
 * - spot colours: every colour beyond the flexo limit replaced by the nearest one kept;
 * - out-of-gamut colour: desaturated until it prints as it shows.
 */
export interface FixContext {
  cornersOf: (el: DesignElement) => Pt[];
  /** Per face: its safe zone (the outer polygon first). */
  safeZones: Pt[][][];
  /** Each piece's outer outline. */
  outlines: Pt[][];
  rules: PrintRule[];
}

const PT_PER_MM = 72 / 25.4;
const threshold = (rules: PrintRule[], id: string, key: string) => {
  const v = rules.find((r) => r.id === id)?.thresholds?.[key];
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

function patchOne(content: DesignContent, id: string, patch: Partial<DesignElement>): DesignContent {
  return {
    ...content,
    elements: content.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as DesignElement) : el)),
  };
}

export function applyFix(content: DesignContent, issue: DesignIssue, ctx: FixContext): DesignContent {
  const el = content.elements.find((e) => e.id === issue.elementId);
  switch (issue.fix) {
    case "min_text": {
      const minPt = threshold(ctx.rules, "min_text_size", "minPt");
      if (!el || el.type !== "text" || minPt === null) return content;
      return patchOne(content, el.id, { fontSize: Math.ceil((minPt / PT_PER_MM / (Math.abs(el.scaleY) || 1)) * 100) / 100 });
    }
    case "min_stroke": {
      const minPt = threshold(ctx.rules, "hairline", "minStrokePt");
      if (!el || !("strokeWidth" in el) || minPt === null) return content;
      const scale = Math.max(Math.abs(el.scaleX), Math.abs(el.scaleY)) || 1;
      return patchOne(content, el.id, { strokeWidth: Math.ceil((minPt / PT_PER_MM / scale) * 1000) / 1000 });
    }
    case "min_code": {
      if (!el || el.type !== "code") return content;
      const min = barcodeMinWidth(el.kind);
      if (min === null) return content;
      const factor = min / (el.width * Math.abs(el.scaleX));
      return patchOne(content, el.id, { width: el.width * factor + 0.01, height: el.height * factor + 0.01 });
    }
    case "move_inside": {
      if (!el) return content;
      const box = boxOf(ctx.cornersOf(el));
      const centre: Pt = [box.x + box.width / 2, box.y + box.height / 2];
      // The safe area of the face the element is mostly on: the nearest zone's bounding box.
      const zones = ctx.safeZones
        .map(([outer]) => (outer ? boxOf(outer) : null))
        .filter((b): b is NonNullable<typeof b> => b !== null && b.width > 0 && b.height > 0);
      if (zones.length === 0) return content;
      const distance = (b: (typeof zones)[number]) =>
        Math.hypot(
          Math.max(b.x - centre[0], 0, centre[0] - (b.x + b.width)),
          Math.max(b.y - centre[1], 0, centre[1] - (b.y + b.height)),
        );
      const zone = [...zones].sort((a, b) => distance(a) - distance(b))[0]!;
      const inset = 0.01;
      const shrink = Math.min(1, (zone.width - 2 * inset) / box.width, (zone.height - 2 * inset) / box.height);
      const w = box.width * shrink;
      const h = box.height * shrink;
      const left = Math.min(Math.max(box.x + (box.width - w) / 2, zone.x + inset), zone.x + zone.width - w - inset);
      const top = Math.min(Math.max(box.y + (box.height - h) / 2, zone.y + inset), zone.y + zone.height - h - inset);
      // The element's own origin moves with its box (and scales about its box's corner when shrunk).
      const dx = left - box.x;
      const dy = top - box.y;
      const patch: Partial<DesignElement> = {
        x: box.x + dx + (el.x - box.x) * shrink,
        y: box.y + dy + (el.y - box.y) * shrink,
        ...(shrink < 1 ? { scaleX: el.scaleX * shrink, scaleY: el.scaleY * shrink } : {}),
      };
      return patchOne(content, el.id, patch);
    }
    case "extend_to_bleed": {
      const bleedMm = threshold(ctx.rules, "bleed", "bleedMm");
      if (!el || bleedMm === null || el.rotation % 360 !== 0 || !("width" in el)) return content;
      const box = boxOf(ctx.cornersOf(el));
      const outline = ctx.outlines.map(boxOf).find((o) => box.x >= o.x - 1e-6 && box.x + box.width <= o.x + o.width + 1e-6);
      if (!outline) return content;
      let [x0, y0, x1, y1] = [box.x, box.y, box.x + box.width, box.y + box.height];
      const reach = bleedMm + 0.01;
      if (x0 - outline.x < reach) x0 = outline.x - reach;
      if (outline.x + outline.width - x1 < reach) x1 = outline.x + outline.width + reach;
      if (y0 - outline.y < reach) y0 = outline.y - reach;
      if (outline.y + outline.height - y1 < reach) y1 = outline.y + outline.height + reach;
      const sx = Math.abs(el.scaleX) || 1;
      const sy = Math.abs(el.scaleY) || 1;
      return patchOne(content, el.id, { x: x0, y: y0, width: (x1 - x0) / sx, height: (y1 - y0) / sy });
    }
    case "in_gamut": {
      if (!el || !("fill" in el) || typeof el.fill !== "string") return content;
      return patchOne(content, el.id, { fill: intoGamut(el.fill) });
    }
    case "nearest_spot": {
      const max = threshold(ctx.rules, "spot_colour_count", "maxColours");
      if (max === null) return content;
      return limitColours(content, max);
    }
    default:
      return content;
  }
}

const rgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = ([r, g, b]: [number, number, number]) =>
  `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;

/** The colour pulled towards its own grey until it is inside what process inks print. */
export function intoGamut(colour: string): string {
  const c = rgb(colour);
  if (!c) return colour;
  const grey = (c[0] + c[1] + c[2]) / 3;
  for (let k = 0.95; k >= 0; k -= 0.05) {
    const next = hex([grey + (c[0] - grey) * k, grey + (c[1] - grey) * k, grey + (c[2] - grey) * k]);
    if (!outOfPrintGamut(next)) return next;
  }
  return hex([grey, grey, grey]);
}

/**
 * Every colour beyond the `max` most used replaced by the nearest one kept (RGB distance), in the
 * elements' fills, strokes and backgrounds and the background pattern — the spot-colour rule's own
 * count, so the fixed design passes it.
 */
export function limitColours(content: DesignContent, max: number): DesignContent {
  const uses = new Map<string, number>();
  const count = (c: unknown) => {
    if (typeof c === "string" && c !== "" && c !== "transparent") uses.set(c.toLowerCase(), (uses.get(c.toLowerCase()) ?? 0) + 1);
  };
  for (const el of content.elements)
    for (const k of ["fill", "stroke", "background"] as const) count((el as unknown as Record<string, unknown>)[k]);
  if (content.pattern.kind !== "none") {
    count(content.pattern.color);
    count(content.pattern.background);
  }
  if (spotColours(content.elements, content.pattern).size <= max) return content;
  const kept = [...uses.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([c]) => c);
  const nearest = (c: unknown): unknown => {
    if (typeof c !== "string" || c === "" || c === "transparent" || kept.includes(c.toLowerCase())) return c;
    const from = rgb(c);
    if (!from) return kept[0] ?? c;
    return [...kept].sort((a, b) => {
      const [pa, pb] = [rgb(a)!, rgb(b)!];
      const d = (p: [number, number, number]) => (p[0] - from[0]) ** 2 + (p[1] - from[1]) ** 2 + (p[2] - from[2]) ** 2;
      return d(pa) - d(pb);
    })[0];
  };
  return {
    pattern:
      content.pattern.kind === "none"
        ? content.pattern
        : { ...content.pattern, color: String(nearest(content.pattern.color)), background: String(nearest(content.pattern.background)) },
    elements: content.elements.map((el) => {
      const patch: Record<string, unknown> = {};
      for (const k of ["fill", "stroke", "background"] as const) {
        const v = (el as unknown as Record<string, unknown>)[k];
        if (v !== undefined) patch[k] = nearest(v);
      }
      return { ...el, ...patch } as DesignElement;
    }),
  };
}
