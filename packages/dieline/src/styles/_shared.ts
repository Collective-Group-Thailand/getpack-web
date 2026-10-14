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
  ParamValues,
} from "../types";

export const t = (th: string, en: string): Localized => ({ th, en });

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
  // A top window sits in the top lid (a tuck end's lid, a seal end's outer flap, a tray's hinged lid).
  const panel =
    panelId === "lid"
      ? (findFace(d, "lid-top") ?? findFace(d, "flap-back-top") ?? findFace(d, "lid") ?? findFace(d, "flap-front-top"))
      : findFace(d, panelId);
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
