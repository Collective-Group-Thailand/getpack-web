import { LAYOUT_SCHEMA_VERSION, type ColourRole, type Slot, type TemplateLayout } from "./layout";

/**
 * Packio's own first template set (D-216: 20 templates across the studio spec's 7 use cases, made
 * in house; Marketing approves each before it is published — maker-checker, D-282). Three
 * archetypes — **classic** (logo, headline, band), **band** (a colour band carrying the name) and
 * **pattern** (a patterned wrap with a label panel) — each dressed per use case with its own
 * palette and copy. Every line, colour and arrangement here is Packio's; nothing is taken from
 * another product. The layouts are imported into packio-api as `studio_templates` (admin) and
 * served back by `store.studio.listTemplates`; the mock serves them as they are.
 */

export type UseCase = "coffee" | "cosmetics" | "snacks" | "e_commerce" | "gift" | "electronics" | "pharmacy";

interface Dress {
  palette: Record<ColourRole, string>;
  name: { th: string; en: string };
  headline: { th: string; en: string };
  subhead: { th: string; en: string };
  info: { th: string; en: string };
  pattern: "stripes" | "dots" | "grid" | "checker";
}

const DRESS: Record<UseCase, Dress> = {
  coffee: {
    palette: { primary: "#5b3a29", accent: "#c8a165", ink: "#2b1d14", paper: "#f6efe6" },
    name: { th: "กาแฟ", en: "Coffee" },
    headline: { th: "คั่วสดทุกสัปดาห์", en: "Roasted fresh every week" },
    subhead: { th: "เมล็ดคัดพิเศษ 250 กรัม", en: "Selected beans · 250 g" },
    info: { th: "เก็บในที่แห้งและเย็น", en: "Keep cool and dry" },
    pattern: "dots",
  },
  cosmetics: {
    palette: { primary: "#8e5a7a", accent: "#e8c7d4", ink: "#3a2433", paper: "#fbf6f8" },
    name: { th: "เครื่องสำอาง", en: "Cosmetics" },
    headline: { th: "อ่อนโยนต่อผิว", en: "Gentle on your skin" },
    subhead: { th: "เซรั่มบำรุง 30 มล.", en: "Nourishing serum · 30 ml" },
    info: { th: "ทดสอบกับผิวก่อนใช้", en: "Patch test before use" },
    pattern: "stripes",
  },
  snacks: {
    palette: { primary: "#d1452f", accent: "#f2b33d", ink: "#3b1f12", paper: "#fff8ec" },
    name: { th: "ขนม", en: "Snacks" },
    headline: { th: "กรอบอร่อยทุกคำ", en: "Crunchy in every bite" },
    subhead: { th: "อบใหม่ ไม่ทอด", en: "Freshly baked, never fried" },
    info: { th: "ดูวันหมดอายุที่ก้นกล่อง", en: "Best before: see the base" },
    pattern: "checker",
  },
  e_commerce: {
    palette: { primary: "#1f6f78", accent: "#f2c14e", ink: "#1b2a2f", paper: "#ffffff" },
    name: { th: "ร้านออนไลน์", en: "Online shop" },
    headline: { th: "ขอบคุณที่สั่งซื้อ", en: "Thank you for your order" },
    subhead: { th: "แกะกล่องได้เลย", en: "Go ahead, open it" },
    info: { th: "ติดต่อร้านได้ทุกวัน", en: "We are here every day" },
    pattern: "grid",
  },
  gift: {
    palette: { primary: "#b23a48", accent: "#e9c46a", ink: "#2d1e2f", paper: "#fffaf3" },
    name: { th: "ของขวัญ", en: "Gift" },
    headline: { th: "ของขวัญสำหรับคุณ", en: "A gift for you" },
    subhead: { th: "ด้วยความปรารถนาดี", en: "With warm wishes" },
    info: { th: "ห่อด้วยใจ", en: "Wrapped with care" },
    pattern: "dots",
  },
  electronics: {
    palette: { primary: "#2d3a4a", accent: "#4cc9f0", ink: "#0f172a", paper: "#f5f7fa" },
    name: { th: "อิเล็กทรอนิกส์", en: "Electronics" },
    headline: { th: "พร้อมใช้งานทันที", en: "Ready out of the box" },
    subhead: { th: "รับประกัน 1 ปี", en: "1-year warranty" },
    info: { th: "อ่านคู่มือก่อนใช้งาน", en: "Read the guide before use" },
    pattern: "grid",
  },
  pharmacy: {
    palette: { primary: "#2a7d5f", accent: "#9ad1b5", ink: "#12332a", paper: "#ffffff" },
    name: { th: "ร้านยาและสุขภาพ", en: "Pharmacy & health" },
    headline: { th: "ใช้ตามคำแนะนำ", en: "Use as directed" },
    subhead: { th: "30 แคปซูล", en: "30 capsules" },
    info: { th: "เก็บให้พ้นมือเด็ก", en: "Keep out of reach of children" },
    pattern: "stripes",
  },
};

const FONTS = { heading: "Prompt", body: "Sarabun" };

const text = (
  id: string,
  role: Slot["role"],
  face: Slot["face"],
  box: Slot["box"],
  copy: { th: string; en: string },
  colour: ColourRole,
  font: "heading" | "body",
  extra: Partial<Slot> = {},
): Slot => ({ id, role, kind: "text", face, box, text: copy, colour, font, ...extra });

function classic(d: Dress): TemplateLayout {
  return {
    palette: d.palette,
    fonts: FONTS,
    background: { colour: "paper" },
    slots: [
      { id: "logo", role: "logo", kind: "circle", face: "front", box: { x: 0.35, y: 0.06, w: 0.3, h: 0.2 }, colour: "accent" },
      text("headline", "headline", "front", { x: 0.06, y: 0.34, w: 0.88, h: 0.16 }, d.headline, "primary", "heading", { size: 0.7, minPt: 10, maxPt: 60 }),
      text("subhead", "subhead", "front", { x: 0.1, y: 0.52, w: 0.8, h: 0.08 }, d.subhead, "ink", "body", { size: 0.7, minPt: 7, maxPt: 24 }),
      { id: "band", role: "band", kind: "rect", face: "front", box: { x: 0, y: 0.84, w: 1, h: 0.1 }, colour: "primary", round: 0.2 },
      text("info", "info", "back", { x: 0.08, y: 0.08, w: 0.84, h: 0.08 }, d.info, "ink", "body", { size: 0.7, minPt: 6, maxPt: 16, align: "left" }),
      { id: "top-logo", role: "logo", kind: "circle", face: "top", box: { x: 0.3, y: 0.15, w: 0.4, h: 0.7 }, colour: "accent", minFaceMm: 20 },
    ],
  };
}

function band(d: Dress): TemplateLayout {
  return {
    palette: d.palette,
    fonts: FONTS,
    background: { colour: "paper" },
    slots: [
      { id: "band", role: "band", kind: "rect", face: "front", box: { x: 0, y: 0.32, w: 1, h: 0.3 }, colour: "primary" },
      text("headline", "headline", "front", { x: 0.08, y: 0.36, w: 0.84, h: 0.14 }, d.headline, "paper", "heading", { size: 0.75, minPt: 10, maxPt: 56 }),
      text("subhead", "subhead", "front", { x: 0.12, y: 0.51, w: 0.76, h: 0.07 }, d.subhead, "accent", "body", { size: 0.7, minPt: 7, maxPt: 22 }),
      { id: "logo", role: "logo", kind: "rect", face: "front", box: { x: 0.36, y: 0.08, w: 0.28, h: 0.16 }, colour: "accent", round: 0.15 },
      { id: "side-left", role: "band", kind: "rect", face: "left", box: { x: 0, y: 0.32, w: 1, h: 0.3 }, colour: "accent", minFaceMm: 15 },
      { id: "side-right", role: "band", kind: "rect", face: "right", box: { x: 0, y: 0.32, w: 1, h: 0.3 }, colour: "accent", minFaceMm: 15 },
      text("info", "info", "back", { x: 0.08, y: 0.1, w: 0.84, h: 0.08 }, d.info, "ink", "body", { size: 0.7, minPt: 6, maxPt: 16, align: "left" }),
    ],
  };
}

function pattern(d: Dress): TemplateLayout {
  return {
    palette: d.palette,
    fonts: FONTS,
    background: { pattern: { kind: d.pattern, size: 10, colour: "accent", on: "paper" } },
    slots: [
      { id: "panel", role: "badge", kind: "rect", face: "front", box: { x: 0.1, y: 0.28, w: 0.8, h: 0.4 }, colour: "paper", round: 0.08 },
      text("headline", "headline", "front", { x: 0.16, y: 0.36, w: 0.68, h: 0.12 }, d.headline, "primary", "heading", { size: 0.75, minPt: 9, maxPt: 48 }),
      text("subhead", "subhead", "front", { x: 0.18, y: 0.5, w: 0.64, h: 0.07 }, d.subhead, "ink", "body", { size: 0.7, minPt: 7, maxPt: 20 }),
      { id: "logo", role: "logo", kind: "circle", face: "front", box: { x: 0.4, y: 0.74, w: 0.2, h: 0.16 }, colour: "primary" },
      { id: "back-panel", role: "badge", kind: "rect", face: "back", box: { x: 0.06, y: 0.06, w: 0.88, h: 0.22 }, colour: "paper", round: 0.08 },
      text("info", "info", "back", { x: 0.1, y: 0.1, w: 0.8, h: 0.08 }, d.info, "ink", "body", { size: 0.7, minPt: 6, maxPt: 16, align: "left" }),
    ],
  };
}

const ARCHETYPES = { classic, band, pattern } as const;
const ARCHETYPE_NAMES = {
  classic: { th: "คลาสสิก", en: "Classic" },
  band: { th: "แถบสี", en: "Colour band" },
  pattern: { th: "ลวดลาย", en: "Pattern" },
};

export interface LibraryTemplate {
  code: string;
  nameTh: string;
  nameEn: string;
  useCases: UseCase[];
  styleFamilies: string[];
  layoutSchemaVersion: number;
  layout: TemplateLayout;
}

export const TEMPLATE_LIBRARY: LibraryTemplate[] = (Object.keys(DRESS) as UseCase[]).flatMap((useCase) =>
  (Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[]).map((archetype) => {
    const dress = DRESS[useCase];
    return {
      code: `PK-TPL-${useCase.toUpperCase().replace("_", "")}-${archetype.toUpperCase()}`,
      nameTh: `${dress.name.th} · ${ARCHETYPE_NAMES[archetype].th}`,
      nameEn: `${dress.name.en} · ${ARCHETYPE_NAMES[archetype].en}`,
      useCases: [useCase],
      styleFamilies: ["folding_carton", "corrugated"],
      layoutSchemaVersion: LAYOUT_SCHEMA_VERSION,
      layout: ARCHETYPES[archetype](dress),
    };
  }),
);
