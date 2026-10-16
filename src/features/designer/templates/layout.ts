import { allFaces, faceBounds, type Dieline, type Face } from "@getpack/dieline";

import type { DesignContent, DesignElement, NewElement, PatternSettings } from "../types";

/**
 * getpack's studio templates (U4.4, D-216, D-282): a **constraint layout** the web owns
 * (`StudioTemplateDto.layout`, stored by getpack-api as given, `layoutSchemaVersion` 1). A layout
 * says *where on which face* each piece goes — never millimetres — so it re-flows onto any size of
 * any style: a slot names a face by its role (front, back, the sides, the top, or the main face of
 * a flat piece) and a box as fractions of that face's safe area; text is sized as a share of its
 * box, kept between a minimum and a maximum point size. Colours and fonts are roles too, so a
 * brand kit restyles a template in one click (`applyBrand`). Authoring guide:
 * `docs/design-tool/template-authoring.md`.
 */
export const LAYOUT_SCHEMA_VERSION = 1;

export type ColourRole = "primary" | "accent" | "ink" | "paper";
export type FontRole = "heading" | "body";
export type FaceRole = "front" | "back" | "left" | "right" | "top" | "bottom" | "main";

export interface Slot {
  id: string;
  /** What the slot is for — a logo slot takes the brand kit's logo. */
  role: "logo" | "headline" | "subhead" | "body" | "info" | "band" | "badge";
  kind: "text" | "rect" | "circle";
  face: FaceRole;
  /** Fractions (0–1) of the face's safe area, in the face's upright frame. */
  box: { x: number; y: number; w: number; h: number };
  colour: ColourRole;
  text?: { th: string; en: string };
  font?: FontRole;
  /** Text: its size as a share of the box height, clamped to `minPt`–`maxPt`. */
  size?: number;
  minPt?: number;
  maxPt?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  /** Shapes: corner rounding as a share of the shorter side. */
  round?: number;
  /** Left out when its face is missing or smaller than this (mm on the shorter side). */
  minFaceMm?: number;
}

export interface TemplateLayout {
  palette: Record<ColourRole, string>;
  fonts: Record<FontRole, string>;
  background?: { colour?: ColourRole; pattern?: Omit<PatternSettings, "color" | "background"> & { colour: ColourRole; on: ColourRole } };
  slots: Slot[];
}

/** What a template element remembers of its slot, so a brand kit can restyle it later. */
export type TemplateRole = NonNullable<DesignElement["templateRole"]>;

export interface ReflowOptions {
  locale: "th" | "en";
  /** The safe margin inside each face (mm, artwork rules). */
  safeMm: number;
  /** Each face's upright turn (degrees, `uprightAngles`): text on a lid reads the right way once folded. */
  upright?: Record<string, number>;
  /** The width of a line of text (mm) at a size (mm); the editor measures, tests estimate. */
  measure?: (text: string, fontSizeMm: number, fontFamily: string, bold: boolean) => number;
}

const PT_MM = 25.4 / 72;

const estimate = (text: string, size: number) => text.length * size * 0.55;

/** The face playing each role on this dieline (front, back …), or the largest face for `main`. */
export function faceForRole(d: Dieline, role: FaceRole): Face | null {
  const faces = allFaces(d);
  const area = (f: Face) => {
    const b = faceBounds(f);
    return b.width * b.height;
  };
  const largest = (fs: Face[]) => [...fs].sort((a, b) => area(b) - area(a))[0] ?? null;
  const labelled = (...labels: string[]) => faces.filter((f) => labels.includes(f.label));
  const panels = faces.filter((f) => f.kind === "panel");
  switch (role) {
    case "front":
      return largest(labelled("front", "wall_front")) ?? largest(panels) ?? largest(faces);
    case "back": {
      const back = largest(labelled("back", "wall_back"));
      if (back) return back;
      const front = faceForRole(d, "front");
      return largest(panels.filter((f) => f !== front));
    }
    case "left":
      return largest(labelled("left", "wall_left", "side"));
    case "right":
      return largest(labelled("right", "wall_right"));
    case "top": {
      const tops = [...labelled("lid", "top"), ...faces.filter((f) => f.kind === "lid")];
      return tops.sort((a, b) => faceBounds(a).y - faceBounds(b).y)[0] ?? null;
    }
    case "bottom":
      return largest(labelled("base", "bottom"));
    case "main":
      return largest(faces);
  }
}

/** A box of `w` × `h` centred at `c`, turned `deg`, as the element's top-left origin (Konva rotates about it). */
function originFor(c: { x: number; y: number }, w: number, h: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  return {
    x: c.x - ((w / 2) * Math.cos(r) - (h / 2) * Math.sin(r)),
    y: c.y - ((w / 2) * Math.sin(r) + (h / 2) * Math.cos(r)),
  };
}

/**
 * The layout on this dieline: one element per slot whose face exists and is big enough, placed in
 * that face's safe area as the face reads upright, each remembering its slot (`templateRole`), and
 * the background. Pure (the measure is a parameter), so it is unit-tested on every core style.
 */
export function reflow(
  layout: TemplateLayout,
  d: Dieline,
  options: ReflowOptions,
): { elements: NewElement[]; pattern: PatternSettings } {
  const measure = options.measure ?? ((text: string, size: number) => estimate(text, size));
  const elements: NewElement[] = [];
  for (const slot of layout.slots) {
    const face = faceForRole(d, slot.face);
    if (!face) continue;
    const b = faceBounds(face);
    const turn = ((options.upright?.[face.id] ?? 0) % 360 + 360) % 360;
    const sideways = turn === 90 || turn === 270;
    // The face's safe area in its upright frame.
    const fw = (sideways ? b.height : b.width) - 2 * options.safeMm;
    const fh = (sideways ? b.width : b.height) - 2 * options.safeMm;
    if (fw <= 0 || fh <= 0 || Math.min(fw, fh) < (slot.minFaceMm ?? 0)) continue;
    const w = slot.box.w * fw;
    const h = slot.box.h * fh;
    // The box's centre, from the face's upright top-left, turned back onto the sheet.
    const lx = -fw / 2 + (slot.box.x + slot.box.w / 2) * fw;
    const ly = -fh / 2 + (slot.box.y + slot.box.h / 2) * fh;
    const r = (turn * Math.PI) / 180;
    const centre = {
      x: b.x + b.width / 2 + lx * Math.cos(r) - ly * Math.sin(r),
      y: b.y + b.height / 2 + lx * Math.sin(r) + ly * Math.cos(r),
    };
    const templateRole: TemplateRole = { slot: slot.id, role: slot.role, colour: slot.colour, ...(slot.font ? { font: slot.font } : {}) };
    const common = { rotation: turn, scaleX: 1, scaleY: 1, opacity: 1, clipFaceId: face.id, name: slot.id, templateRole };
    const fill = layout.palette[slot.colour];

    if (slot.kind === "text") {
      const text = slot.text?.[options.locale] ?? "";
      const fontFamily = layout.fonts[slot.font ?? "body"];
      const bold = slot.bold ?? slot.font === "heading";
      // As big as the box allows (height share, then the width), within the slot's point range.
      let size = (slot.size ?? 0.6) * h;
      const fits = measure(text, size, fontFamily, bold);
      if (fits > w) size *= w / fits;
      const [min, max] = [(slot.minPt ?? 6) * PT_MM, (slot.maxPt ?? 96) * PT_MM];
      size = Math.max(min, Math.min(max, Math.round(size * 100) / 100));
      const tw = Math.min(w, measure(text, size, fontFamily, bold));
      const th = size * 1.2;
      const shift = slot.align === "left" ? -(w - tw) / 2 : slot.align === "right" ? (w - tw) / 2 : 0;
      const at = { x: centre.x + shift * Math.cos(r), y: centre.y + shift * Math.sin(r) };
      elements.push({
        ...common,
        ...originFor(at, tw, th, turn),
        type: "text",
        text,
        fontSize: size,
        fontFamily,
        fontStyle: bold ? "bold" : "normal",
        fill,
        align: slot.align ?? "center",
      } as NewElement);
    } else {
      const side = slot.kind === "circle" ? Math.min(w, h) : 0;
      const ew = slot.kind === "circle" ? side : w;
      const eh = slot.kind === "circle" ? side : h;
      elements.push({
        ...common,
        ...originFor(centre, ew, eh, turn),
        type: slot.kind,
        width: ew,
        height: eh,
        fill,
        stroke: fill,
        strokeWidth: 0,
        cornerRadius: (slot.round ?? 0) * Math.min(ew, eh),
      } as NewElement);
    }
  }

  const bg = layout.background;
  const pattern: PatternSettings = bg?.pattern
    ? { ...bg.pattern, color: layout.palette[bg.pattern.colour], background: layout.palette[bg.pattern.on] }
    : bg?.colour
      ? { kind: "solid", color: layout.palette[bg.colour], background: "#ffffff", size: 12 }
      : { kind: "none", color: "#000000", background: "#ffffff", size: 12 };
  return { elements, pattern };
}

export interface BrandStyle {
  palette: Partial<Record<ColourRole, string>>;
  fonts: Partial<Record<FontRole, string>>;
  /** The kit's primary logo, placed into every logo slot. */
  logo?: { src: string; assetId?: string; naturalWidth?: number; naturalHeight?: number } | null;
}

/**
 * "ใช้แบรนด์ของฉัน" (U4.4): every element that came from a template takes the brand's colour and font
 * for its role, and each logo slot becomes the brand's logo, fitted into the slot's box. Elements
 * the customer added themselves are left alone. Pure.
 */
export function applyBrand(content: DesignContent, brand: BrandStyle): DesignContent {
  const elements = content.elements.map((el): DesignElement => {
    const role = el.templateRole;
    if (!role) return el;
    const colour = brand.palette[role.colour];
    if (role.role === "logo" && brand.logo && (el.type === "rect" || el.type === "circle" || el.type === "image")) {
      const ratio = brand.logo.naturalWidth && brand.logo.naturalHeight ? brand.logo.naturalWidth / brand.logo.naturalHeight : 1;
      const width = Math.min(el.width, el.height * ratio);
      const height = width / ratio;
      return {
        ...el,
        type: "image",
        src: brand.logo.src,
        ...(brand.logo.assetId ? { assetId: brand.logo.assetId } : {}),
        ...(brand.logo.naturalWidth ? { naturalWidth: brand.logo.naturalWidth, naturalHeight: brand.logo.naturalHeight } : {}),
        x: el.x + (el.width - width) / 2,
        y: el.y + (el.height - height) / 2,
        width,
        height,
      } as DesignElement;
    }
    if (el.type === "text")
      return {
        ...el,
        ...(colour ? { fill: colour } : {}),
        ...(role.font && brand.fonts[role.font] ? { fontFamily: brand.fonts[role.font]! } : {}),
      };
    if ((el.type === "rect" || el.type === "circle" || el.type === "shape") && colour)
      return { ...el, fill: colour, stroke: colour };
    return el;
  });
  return { ...content, elements };
}

/** A layout as getpack-api returns it, or `null` when it is not one this build reads. */
export function readLayout(schemaVersion: number, layout: unknown): TemplateLayout | null {
  if (schemaVersion !== LAYOUT_SCHEMA_VERSION || !layout || typeof layout !== "object") return null;
  const l = layout as Partial<TemplateLayout>;
  return Array.isArray(l.slots) && l.palette && l.fonts ? (l as TemplateLayout) : null;
}
