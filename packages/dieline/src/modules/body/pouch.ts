import { assemble, face, piece } from "../../faces";
import type { FaceLabel } from "../../labels";
import { bool, num, str } from "../../params";
import { ellipse, line, polygon, rectangle, roundedRectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour, Edge, Face, ParamValues } from "../../types";
import type { BodyModule } from "../types";

type PouchType = "three_side" | "four_side" | "center_seal" | "center_seal_gusset" | "standing";

/**
 * Pouch print templates — legacy PouchCalculator blank formulas (without the factory's print
 * tolerance `t`): 3-side seal `2l × w`; centre seal `2w + 2cs` × l; centre seal with gusset
 * `2w + 2s + 2cs` × l; 4-side seal `2w + 2s` × l; stand-up `l + b + l` × w. Folds are creases,
 * seal areas are marked on the GLUE layer. D-152: pouches get a 2D mockup, no 3D fold.
 */
function panelsOf(type: PouchType, v: ParamValues): { id: string; label: FaceLabel; size: number }[] {
  const w = num(v, "width", 120);
  const l = num(v, "length", 180);
  const s = num(v, "gusset", 40);
  const b = num(v, "bottom", 40);
  const cs = num(v, "centerSeal", 10);
  switch (type) {
    case "three_side":
      return [
        { id: "front", label: "front", size: l },
        { id: "back", label: "back", size: l },
      ];
    case "standing":
      return [
        { id: "front", label: "front", size: l },
        { id: "bottom-a", label: "bottom", size: b / 2 },
        { id: "bottom-b", label: "bottom", size: b / 2 },
        { id: "back", label: "back", size: l },
      ];
    case "four_side":
      return [
        { id: "front", label: "front", size: w },
        { id: "gusset-right", label: "side", size: s },
        { id: "back", label: "back", size: w },
        { id: "gusset-left", label: "side", size: s },
      ];
    case "center_seal":
      return [
        { id: "fin-left", label: "glue_flap", size: cs },
        { id: "back-left", label: "back", size: w / 2 },
        { id: "front", label: "front", size: w },
        { id: "back-right", label: "back", size: w / 2 },
        { id: "fin-right", label: "glue_flap", size: cs },
      ];
    case "center_seal_gusset":
      return [
        { id: "fin-left", label: "glue_flap", size: cs },
        { id: "back-left", label: "back", size: w / 2 },
        { id: "gusset-left", label: "side", size: s },
        { id: "front", label: "front", size: w },
        { id: "gusset-right", label: "side", size: s },
        { id: "back-right", label: "back", size: w / 2 },
        { id: "fin-right", label: "glue_flap", size: cs },
      ];
  }
}

/** The set of pouch features (`pouchFeatures`, a `+`-joined set, `none` for none). */
const featuresOf = (v: ParamValues) => new Set(str(v, "pouchFeatures", "none").split("+"));

/**
 * The pouch features of PK-PB-01 / PB-02 on a panel whose open (top) edge is at `top` (`dir` = 1
 * when the panel runs down from it): a `zipper` sealed in 8 mm under the top seal, a `tear_notch`
 * V-notch in both side edges 4 mm under the top seal (drawn in the outline), a `hang_hole` Ø 6 mm
 * centred in the top seal, a `window` cut-out (film patched, as on a carton) in the front.
 * ⚠ Positions to be confirmed by Prepress.
 */
function topFeatures(v: ParamValues, id: string, across: number, top: number, dir: 1 | -1, size: number) {
  const f = featuresOf(v);
  const seal = num(v, "sealWidth", 8);
  const y = (d: number) => top + dir * d;
  const marks: Edge[] = [];
  const holes: Contour[] = [];
  if (f.has("zipper")) {
    const a = y(seal + 8);
    const b = y(seal + 14);
    marks.push(
      ...polygon(
        [
          [0.5, Math.min(a, b)],
          [across - 0.5, Math.min(a, b)],
          [across - 0.5, Math.max(a, b)],
          [0.5, Math.max(a, b)],
        ],
        "glue_area",
      ),
    );
  }
  if (f.has("hang_hole")) holes.push(ellipse(across / 2, y(seal / 2), 3, 3));
  if (f.has("window") && id === "front") {
    const ww = num(v, "windowWidth", across * 0.4);
    const wh = num(v, "windowHeight", size * 0.3);
    holes.push(roundedRectangle(across / 2 - ww / 2, top + dir * size * 0.55 - wh / 2, ww, wh, Math.min(6, wh / 4)));
  }
  return { marks, holes, notchAt: f.has("tear_notch") ? y(seal + 4) : undefined };
}

/** A panel's outline (vertical layout), with a tear V-notch 3 mm deep in each side edge at `notchAt`. */
function panelOutline(
  across: number,
  y0: number,
  size: number,
  first: boolean,
  last: boolean,
  notchAt?: number,
): Contour {
  if (notchAt === undefined)
    return rectangle(0, y0, across, size, { top: first ? "cut" : "crease", bottom: last ? "cut" : "crease" });
  const n = notchAt;
  return [
    line([0, y0], [across, y0], first ? "cut" : "crease"),
    line([across, y0], [across, n - 2], "cut"),
    line([across, n - 2], [across - 3, n], "cut"),
    line([across - 3, n], [across, n + 2], "cut"),
    line([across, n + 2], [across, y0 + size], "cut"),
    line([across, y0 + size], [0, y0 + size], last ? "cut" : "crease"),
    line([0, y0 + size], [0, n + 2], "cut"),
    line([0, n + 2], [3, n], "cut"),
    line([3, n], [0, n - 2], "cut"),
    line([0, n - 2], [0, y0], "cut"),
  ];
}

function build(styleId: string, v: ParamValues) {
  const type = str(v, "pouchType", "three_side") as PouchType;
  const panels = panelsOf(type, v);
  const seal = num(v, "sealWidth", 8);
  // 3-side and stand-up pouches stack their panels down the sheet; the others side by side.
  const vertical = type === "three_side" || type === "standing";
  const across = vertical ? num(v, "width", 120) : num(v, "length", 180);
  const faces: Face[] = [];
  let at = 0;
  panels.forEach((p, i) => {
    const first = i === 0;
    const last = i === panels.length - 1;
    // A vertical pouch's open edges: the first panel's top and the last panel's bottom.
    const open =
      vertical && (first || last)
        ? topFeatures(v, p.id, across, first ? at : at + p.size, first ? 1 : -1, p.size)
        : undefined;
    const outline = vertical
      ? panelOutline(across, at, p.size, first, last, open?.notchAt)
      : rectangle(at, 0, p.size, across, { left: first ? "cut" : "crease", right: last ? "cut" : "crease" });
    // Seal bands: along the open edges (top and bottom, or both sides) and the whole of a fin.
    const marks: Edge[] = [...(open?.marks ?? [])];
    const band = (x: number, y: number, w: number, h: number) => {
      if (w > 1 && h > 1)
        marks.push(
          ...polygon(
            [
              [x, y],
              [x + w, y],
              [x + w, y + h],
              [x, y + h],
            ],
            "glue_area",
          ),
        );
    };
    if (p.id.startsWith("fin")) band(at + 0.5, 0.5, p.size - 1, across - 1);
    else if (vertical) {
      band(0.5, at + 0.5, seal, p.size - 1);
      band(across - seal - 0.5, at + 0.5, seal, p.size - 1);
      if (first) band(seal + 0.5, at + 0.5, across - 2 * seal - 1, seal);
      if (last) band(seal + 0.5, at + p.size - seal - 0.5, across - 2 * seal - 1, seal);
    } else {
      band(at + 0.5, 0.5, p.size - 1, seal);
      band(at + 0.5, across - seal - 0.5, p.size - 1, seal);
    }
    faces.push(face(p.id, p.label, "flat", outline, { marks, holes: open?.holes ?? [] }));
    at += p.size;
  });
  return assemble(styleId, [piece("blank", "blank", faces)]);
}

/** The web of a pouch laid flat for printing: panels, gussets, fins and seal bands. */
export const pouchWeb: BodyModule = {
  id: "pouchWeb",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("แผ่นฟิล์มซอง (แผง ข้างซอง ซีล)", "Pouch web (panels, gussets, seals)"),
  params: ["pouchType", "width", "length", "gusset", "bottom", "centerSeal", "sealWidth", "pouchFeatures"],
  processes: ["pouch_making"],
  contributes: { kinds: ["flat"], roles: ["cut", "crease", "glue_area"] },
  constraints: [
    {
      id: "pouchWeb.seal_width",
      code: "seal.too_wide",
      severity: "error",
      param: "sealWidth",
      require: "sealWidth * 2 < min(width, length)",
      message: t("รอยซีลกว้างเกินขนาดซอง", "The seals are wider than the pouch"),
    },
    {
      id: "pouchWeb.seal_range",
      code: "mfg.seal_width",
      severity: "error",
      param: "sealWidth",
      require: "rule.seal.max == 0 or (sealWidth >= rule.seal.min and sealWidth <= rule.seal.max)",
      message: t("ความกว้างรอยซีลอยู่นอกช่วงที่เครื่องทำได้", "The seal width is outside what a pouch line makes"),
      stage: "manufacturing",
    },
  ],
  build: (ctx) => build(ctx.styleId, ctx.v),
};

/**
 * A courier poly mailer (PK-PB-06) laid flat: a closing flap, the back and the front, folded at
 * the bottom and sealed down both sides. `adhesive` = `single` puts a peel-and-seal strip on the
 * flap; `dual` a second one below it to send the parcel back; `tearStrip` a pair of perforations
 * 8 mm apart across the back under the flap to open it. 2D only (D-152). ⚠ Strip positions to be
 * confirmed by Prepress.
 */
export const polyMailer: BodyModule = {
  id: "polyMailer",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("ซองไปรษณีย์พลาสติก (ฝาปิด + ซีลข้าง)", "Courier poly mailer (flap, side seals)"),
  params: ["width", "length", "flapDepth", "sealWidth", "adhesive", "tearStrip"],
  processes: ["pouch_making", "adhesive_strip_applicator"],
  contributes: { kinds: ["flat"], roles: ["cut", "crease", "glue_area", "perforation"] },
  constraints: [
    {
      id: "polyMailer.flap",
      code: "flap.too_deep",
      severity: "error",
      param: "flapDepth",
      require: "flapDepth < length / 2",
      message: t("ฝาปิดลึกเกินครึ่งความยาวซอง", "The flap is deeper than half the mailer"),
    },
  ],
  build(ctx) {
    const { v } = ctx;
    const w = num(v, "width", 250);
    const l = num(v, "length", 350);
    const f = num(v, "flapDepth", 50);
    const seal = num(v, "sealWidth", 8);
    const strip = (y: number) =>
      polygon(
        [
          [10, y],
          [w - 10, y],
          [w - 10, y + 8],
          [10, y + 8],
        ],
        "glue_area",
      );
    const adhesive = str(v, "adhesive", "single");
    const flapMarks = [
      ...(adhesive !== "none" ? strip(f * 0.3 - 4) : []),
      ...(adhesive === "dual" ? strip(f * 0.7 - 4) : []),
    ];
    const sides = (y0: number, h: number): Edge[] => [
      ...polygon(
        [
          [0.5, y0 + 0.5],
          [seal, y0 + 0.5],
          [seal, y0 + h - 0.5],
          [0.5, y0 + h - 0.5],
        ],
        "glue_area",
      ),
      ...polygon(
        [
          [w - seal, y0 + 0.5],
          [w - 0.5, y0 + 0.5],
          [w - 0.5, y0 + h - 0.5],
          [w - seal, y0 + h - 0.5],
        ],
        "glue_area",
      ),
    ];
    const tear = bool(v, "tearStrip", false) ? [f + 12, f + 20].map((y) => line([0, y], [w, y], "perforation")) : [];
    const faces = [
      face("flap", "outer_flap", "flat", rectangle(0, 0, w, f, { bottom: "crease" }), { marks: flapMarks }),
      face("back", "back", "flat", rectangle(0, f, w, l, { top: "crease", bottom: "crease" }), {
        marks: [...sides(f, l), ...tear],
      }),
      face("front", "front", "flat", rectangle(0, f + l, w, l, { top: "crease" }), { marks: sides(f + l, l) }),
    ];
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
};
