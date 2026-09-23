import type { BoxDims, BoxStyleId, PatternSettings } from "./types";

export interface BoxStyle {
  id: BoxStyleId;
  name: string;
  description: string;
  presets: { label: string; dims: BoxDims }[];
  limits: { min: number; max: number };
}

export const BOX_STYLES: BoxStyle[] = [
  {
    id: "rsc",
    name: "กล่องฝาชน (RSC)",
    description: "กล่องลูกฟูกมาตรฐานสำหรับขนส่ง พับฝาบน-ล่างชนกันกลางกล่อง",
    limits: { min: 50, max: 800 },
    presets: [
      { label: "S — 150 × 100 × 80", dims: { length: 150, width: 100, height: 80 } },
      { label: "M — 250 × 180 × 120", dims: { length: 250, width: 180, height: 120 } },
      { label: "L — 350 × 250 × 200", dims: { length: 350, width: 250, height: 200 } },
      { label: "XL — 450 × 350 × 300", dims: { length: 450, width: 350, height: 300 } },
    ],
  },
  {
    id: "tuck-end",
    name: "กล่องฝาเสียบ (Tuck End)",
    description: "กล่องกระดาษแข็งสำหรับสินค้าขายปลีก ฝาเสียบบน-ล่าง",
    limits: { min: 20, max: 400 },
    presets: [
      { label: "ครีม/เครื่องสำอาง — 50 × 50 × 120", dims: { length: 50, width: 50, height: 120 } },
      { label: "อาหารเสริม — 70 × 40 × 150", dims: { length: 70, width: 40, height: 150 } },
      { label: "ขนม — 120 × 60 × 180", dims: { length: 120, width: 60, height: 180 } },
    ],
  },
  {
    id: "tray",
    name: "ถาดฝาเปิด (Tray)",
    description: "ถาด 4 ผนัง มีปีกกาวที่มุม เหมาะสำหรับเบเกอรี่และของขวัญ",
    limits: { min: 20, max: 600 },
    presets: [
      { label: "ถาดเล็ก — 120 × 120 × 50", dims: { length: 120, width: 120, height: 50 } },
      { label: "ถาดกลาง — 200 × 150 × 60", dims: { length: 200, width: 150, height: 60 } },
      { label: "ถาดใหญ่ — 300 × 220 × 80", dims: { length: 300, width: 220, height: 80 } },
    ],
  },
];

export interface Paper {
  id: string;
  name: string;
  color: string;
  thickness: number; // mm
  styles: BoxStyleId[];
  printable: boolean;
}

/**
 * Board colours are literal on purpose: they describe how real kraft and art card look, so
 * they must not follow the app theme or the brand. Paper is paper.
 */
export const PAPERS: Paper[] = [
  {
    id: "ivory-350",
    name: "Art Card ขาว 350 แกรม",
    color: "#fbfaf6",
    thickness: 0.45,
    styles: ["tuck-end", "tray"],
    printable: true,
  },
  {
    id: "kraft-350",
    name: "กระดาษคราฟท์ 350 แกรม",
    color: "#c8a47e",
    thickness: 0.5,
    styles: ["tuck-end", "tray"],
    printable: true,
  },
  {
    id: "e-white",
    name: "ลูกฟูก E-flute ผิวขาว",
    color: "#f4f2ec",
    thickness: 1.6,
    styles: ["rsc", "tray", "tuck-end"],
    printable: true,
  },
  {
    id: "e-kraft",
    name: "ลูกฟูก E-flute ผิวน้ำตาล",
    color: "#b98f62",
    thickness: 1.6,
    styles: ["rsc", "tray", "tuck-end"],
    printable: true,
  },
  { id: "b-kraft", name: "ลูกฟูก B-flute ผิวน้ำตาล", color: "#a97f53", thickness: 3, styles: ["rsc"], printable: true },
  {
    id: "bc-kraft",
    name: "ลูกฟูก BC 2 ชั้น ผิวน้ำตาล",
    color: "#9c7349",
    thickness: 6.5,
    styles: ["rsc"],
    printable: false,
  },
];

export const getStyle = (id: BoxStyleId) => BOX_STYLES.find((s) => s.id === id)!;
export const getPaper = (id: string) => PAPERS.find((p) => p.id === id) ?? PAPERS[0];
export const papersFor = (style: BoxStyleId) => PAPERS.filter((p) => p.styles.includes(style));

/** Clearance added on each side when sizing a box from product dimensions. */
export const PRODUCT_CLEARANCE_MM = 1.5;

export function dimsFromProduct(product: BoxDims, thickness: number): BoxDims {
  const add = PRODUCT_CLEARANCE_MM * 2 + thickness;
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
