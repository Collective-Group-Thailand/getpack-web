import { WINDOW_MIN_MARGIN_MM } from "../constants";
import { faceBounds, findFace } from "../faces";
import { polygonInsideWithMargin } from "../geom";
import { issue, schemaIssues, withDefaults, num, str } from "../params";
import { ellipse, flattenContour, rectangle, roundedRectangle } from "../path";
import type {
  Annotation,
  BoxStyleDef,
  Contour,
  Dieline,
  Face,
  Issue,
  Localized,
  MaterialSpec,
  ParamSchema,
  ParamValues,
} from "../types";

export const t = (th: string, en: string): Localized => ({ th, en });

/** Inside length/width/height, the parameters every box shares. */
export function sizeParams(limits: {
  length: [number, number];
  width: [number, number];
  height?: [number, number];
}): ParamSchema[] {
  const out: ParamSchema[] = [
    {
      key: "length",
      kind: "length",
      group: "size",
      label: t("ความยาว (ด้านใน)", "Inside length"),
      min: limits.length[0],
      max: limits.length[1],
      step: 0.5,
      legacyKey: "l",
    },
    {
      key: "width",
      kind: "length",
      group: "size",
      label: t("ความกว้าง (ด้านใน)", "Inside width"),
      min: limits.width[0],
      max: limits.width[1],
      step: 0.5,
      legacyKey: "w",
    },
  ];
  if (limits.height) {
    out.push({
      key: "height",
      kind: "length",
      group: "size",
      label: t("ความสูง (ด้านใน)", "Inside height"),
      min: limits.height[0],
      max: limits.height[1],
      step: 0.5,
      legacyKey: "h",
    });
  }
  return out;
}

export const glueSideParam: ParamSchema = {
  key: "glueSide",
  kind: "enum",
  group: "construction",
  label: t("ด้านปีกกาว", "Glue flap side"),
  options: [
    { value: "left", label: t("ซ้าย", "Left") },
    { value: "right", label: t("ขวา", "Right") },
  ],
};

export const glueWidthParam: ParamSchema = {
  key: "glueWidth",
  kind: "length",
  group: "construction",
  label: t("ความกว้างปีกกาว", "Glue flap width"),
  help: t("เว้นว่างเพื่อใช้ค่าแนะนำตามขนาดกล่อง", "Leave empty for the recommended width for this size"),
  min: 8,
  max: 60,
  step: 0.5,
  legacyKey: "g",
};

export const grainParam: ParamSchema = {
  key: "grain",
  kind: "enum",
  group: "options",
  label: t("แนวเสี้ยนกระดาษ", "Grain direction"),
  help: t(
    "ลูกศรบอกแนวเสี้ยนบนแบบคลี่ สำหรับโรงงาน",
    "An arrow on the drawing telling the factory which way the grain runs",
  ),
  options: [
    { value: "across", label: t("ขวางรอยพับหลัก", "Across the main creases") },
    { value: "along", label: t("ตามรอยพับหลัก", "Along the main creases") },
  ],
};

/** The grain arrow, drawn in a panel's middle. */
export function grainArrow(v: ParamValues, x0: number, x1: number, y0: number, y1: number): Annotation[] {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const len = Math.min(x1 - x0, y1 - y0) * 0.4;
  return str(v, "grain", "across") === "along"
    ? [{ kind: "grain", from: [cx, cy + len / 2], to: [cx, cy - len / 2] }]
    : [{ kind: "grain", from: [cx - len / 2, cy], to: [cx + len / 2, cy] }];
}

/** The grain arrow in the middle of the named face. */
export function grainOn(v: ParamValues, faces: Face[], faceId: string): Annotation[] {
  const f = faces.find((x) => x.id === faceId) ?? faces[0];
  if (!f) return [];
  const b = faceBounds(f);
  return grainArrow(v, b.x, b.x + b.width, b.y, b.y + b.height);
}

export function windowParams(panels: { value: string; label: Localized }[]): ParamSchema[] {
  const shaped = { key: "window", in: ["rect", "rounded", "ellipse"] };
  return [
    {
      key: "window",
      kind: "enum",
      group: "window",
      label: t("หน้าต่าง", "Window"),
      options: [
        { value: "none", label: t("ไม่มี", "None") },
        { value: "rect", label: t("สี่เหลี่ยม", "Rectangle") },
        { value: "rounded", label: t("สี่เหลี่ยมมุมมน", "Rounded rectangle") },
        { value: "ellipse", label: t("วงรี", "Ellipse") },
      ],
    },
    {
      key: "windowPanel",
      kind: "enum",
      group: "window",
      label: t("หน้าต่างอยู่ที่ด้าน", "Window on"),
      options: panels,
      when: shaped,
    },
    {
      key: "windowWidth",
      kind: "length",
      group: "window",
      label: t("ความกว้างหน้าต่าง", "Window width"),
      min: 10,
      max: 600,
      step: 0.5,
      when: shaped,
    },
    {
      key: "windowHeight",
      kind: "length",
      group: "window",
      label: t("ความสูงหน้าต่าง", "Window height"),
      min: 10,
      max: 600,
      step: 0.5,
      when: shaped,
    },
    {
      key: "windowOffsetX",
      kind: "length",
      group: "window",
      label: t("เลื่อนหน้าต่างแนวนอน", "Window offset, horizontal"),
      min: -300,
      max: 300,
      step: 0.5,
      when: shaped,
    },
    {
      key: "windowOffsetY",
      kind: "length",
      group: "window",
      label: t("เลื่อนหน้าต่างแนวตั้ง", "Window offset, vertical"),
      min: -300,
      max: 300,
      step: 0.5,
      when: shaped,
    },
    {
      key: "windowRadius",
      kind: "length",
      group: "window",
      label: t("รัศมีมุมหน้าต่าง", "Window corner radius"),
      min: 0,
      max: 100,
      step: 0.5,
      when: { key: "window", in: ["rounded"] },
    },
  ];
}

export const WINDOW_DEFAULTS: ParamValues = {
  window: "none",
  windowWidth: 40,
  windowHeight: 30,
  windowOffsetX: 0,
  windowOffsetY: 0,
  windowRadius: 6,
};

/** The window cut-out for a panel with the given frame, or none. */
export function windowHole(v: ParamValues, panelId: string, x0: number, x1: number, y0: number, y1: number): Contour[] {
  const kind = str(v, "window", "none");
  if (kind === "none" || str(v, "windowPanel", "front") !== panelId) return [];
  const w = num(v, "windowWidth", 40);
  const h = num(v, "windowHeight", 30);
  const cx = (x0 + x1) / 2 + num(v, "windowOffsetX", 0);
  const cy = (y0 + y1) / 2 + num(v, "windowOffsetY", 0);
  if (kind === "ellipse") return [ellipse(cx, cy, w / 2, h / 2)];
  if (kind === "rounded") return [roundedRectangle(cx - w / 2, cy - h / 2, w, h, num(v, "windowRadius", 6))];
  return [rectangle(cx - w / 2, cy - h / 2, w, h)];
}

/** A window must sit inside its panel with `WINDOW_MIN_MARGIN_MM` of board all round. */
export function windowIssues(v: ParamValues, d: Dieline): Issue[] {
  const kind = str(v, "window", "none");
  if (kind === "none") return [];
  const panelId = str(v, "windowPanel", "front");
  const panel = findFace(d, panelId);
  const hole = panel?.holes[0];
  if (!panel || !hole)
    return [
      issue("window.no_panel", t("เลือกด้านที่จะเจาะหน้าต่าง", "Choose the panel for the window"), "windowPanel"),
    ];
  if (!polygonInsideWithMargin(flattenContour(panel.outline), flattenContour(hole), WINDOW_MIN_MARGIN_MM)) {
    return [
      issue(
        "window.outside_panel",
        t(
          `หน้าต่างต้องอยู่ในด้านที่เลือก ห่างขอบและรอยพับอย่างน้อย ${WINDOW_MIN_MARGIN_MM} มม.`,
          `The window must sit inside its panel, at least ${WINDOW_MIN_MARGIN_MM} mm from every edge and crease`,
        ),
        "windowWidth",
      ),
    ];
  }
  return [];
}

export function materialIssues(style: Pick<BoxStyleDef, "materials">, m: MaterialSpec, v: ParamValues): Issue[] {
  const out: Issue[] = [];
  if (!style.materials.includes(m.kind)) {
    out.push(
      issue(
        "material.unsupported",
        t("วัสดุนี้ไม่เหมาะกับรูปแบบกล่องนี้", "This material is not made into this box style"),
        undefined,
        "warning",
      ),
    );
  }
  const smallest = Math.min(...["length", "width", "height"].map((k) => num(v, k, Infinity)));
  if (Number.isFinite(smallest) && m.caliperMm * 4 > smallest) {
    out.push(
      issue(
        "material.too_thick",
        t("วัสดุหนาเกินไปสำหรับขนาดนี้", "The board is too thick for a box this small"),
        undefined,
        "error",
      ),
    );
  }
  return out;
}

type StyleInput = Omit<BoxStyleDef, "validate" | "build"> & {
  /** Rules beyond the schema, on values with defaults applied. */
  check?: (v: ParamValues, m: MaterialSpec, built: Dieline) => Issue[];
  make: (v: ParamValues, m: MaterialSpec) => Dieline;
};

/** A style whose `validate` runs the schema, the material and its own rules, and whose `build` fills defaults. */
export function defineStyle(input: StyleInput): BoxStyleDef {
  const { check, make, ...def } = input;
  return {
    ...def,
    build: (v, m) => make(withDefaults(def.defaults, v), m),
    validate: (v, m) => {
      const values = withDefaults(def.defaults, v);
      const schema = schemaIssues(def.params, values);
      if (schema.some((i) => i.severity === "error")) return schema;
      const own = [...materialIssues(def, m, values), ...schema];
      if (own.some((i) => i.severity === "error")) return own;
      return [...own, ...(check ? check(values, m, make(values, m)) : [])];
    },
  };
}
