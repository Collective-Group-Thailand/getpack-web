import { getStyle, type MaterialSpec } from "@packio/dieline";

import type { BoxDims, BoxStyleId, PatternSettings } from "./types";

/**
 * Placeholder boards until the designer reads materials from the catalogue API (F4 Part C
 * deletes this list). Board colours are literal on purpose: they describe how real kraft and art
 * card look, so they must not follow the app theme or the brand. Paper is paper.
 */
export interface Paper {
  id: string;
  name: string;
  color: string;
  material: MaterialSpec;
  printable: boolean;
}

export const PAPERS: Paper[] = [
  {
    id: "ivory-350",
    name: "Art Card ขาว 350 แกรม",
    color: "#fbfaf6",
    material: { caliperMm: 0.45, kind: "paperboard" },
    printable: true,
  },
  {
    id: "kraft-350",
    name: "กระดาษคราฟท์ 350 แกรม",
    color: "#c8a47e",
    material: { caliperMm: 0.5, kind: "paperboard" },
    printable: true,
  },
  {
    id: "e-white",
    name: "ลูกฟูก E-flute ผิวขาว",
    color: "#f4f2ec",
    material: { caliperMm: 1.6, kind: "corrugated", flute: "E" },
    printable: true,
  },
  {
    id: "e-kraft",
    name: "ลูกฟูก E-flute ผิวน้ำตาล",
    color: "#b98f62",
    material: { caliperMm: 1.6, kind: "corrugated", flute: "E" },
    printable: true,
  },
  {
    id: "b-kraft",
    name: "ลูกฟูก B-flute ผิวน้ำตาล",
    color: "#a97f53",
    material: { caliperMm: 3, kind: "corrugated", flute: "B" },
    printable: true,
  },
  {
    id: "bc-kraft",
    name: "ลูกฟูก BC 2 ชั้น ผิวน้ำตาล",
    color: "#9c7349",
    material: { caliperMm: 6.5, kind: "corrugated", flute: "BC" },
    printable: false,
  },
];

/** Board colour by material kind, for a design whose material is not in the list above. */
const KIND_COLOUR: Record<MaterialSpec["kind"], string> = {
  paperboard: "#fbfaf6",
  corrugated: "#c9a57a",
  rigid: "#f4f2ec",
  label: "#ffffff",
  flexible: "#f2f4f6",
};

export const getPaper = (id: string | null | undefined) => PAPERS.find((p) => p.id === id);

/** Boards a style is made from. */
export function papersFor(style: BoxStyleId): Paper[] {
  const kinds = getStyle(style).materials;
  const fits = PAPERS.filter((p) => kinds.includes(p.material.kind));
  return fits.length ? fits : PAPERS;
}

/** The board colour to draw a design on. */
export function boardColour(spec: { materialId?: string | null; material: MaterialSpec }): string {
  return getPaper(spec.materialId)?.color ?? KIND_COLOUR[spec.material.kind];
}

/** Clearance added on each side when sizing a box from product dimensions. */
export const PRODUCT_CLEARANCE_MM = 1.5;

/**
 * Inside size for a product: its size plus clearance on each side. The board's thickness is the
 * engine's business — it scores every panel from the inside size (caliper compensation).
 */
export function dimsFromProduct(product: BoxDims): BoxDims {
  const add = PRODUCT_CLEARANCE_MM * 2;
  const r = (n: number) => Math.round((n + add) * 10) / 10;
  return { length: r(product.length), width: r(product.width), height: r(product.height) };
}

export const DEFAULT_PATTERN: PatternSettings = {
  kind: "none",
  color: "#1f6f78",
  background: "#ffffff",
  size: 12,
};

export const FONT_FAMILIES = ["Noto Sans Thai", "Sarabun", "Prompt", "Kanit", "Arial", "Georgia", "Courier New"];
