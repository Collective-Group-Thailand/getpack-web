import { assemble, face, piece } from "../../faces";
import type { FaceLabel } from "../../labels";
import { bool, num, str } from "../../params";
import { ellipse, line, polygon, rectangle, roundedRectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour, Edge, Face, ParamValues } from "../../types";
import type { BodyModule } from "../types";

type PouchType = "three_side" | "four_side" | "center_seal" | "center_seal_gusset" | "standing" | "flat_bottom";

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
    case "flat_bottom":
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
  // A spout fitment sealed into the top seal's centre (PK-PB-08): its boat seal zone, 24 × 14 mm. ⚠
  if (bool(v, "spout", false)) {
    const a = y(0.5);
    const b = y(14);
    marks.push(
      ...polygon(
        [
          [across / 2 - 12, Math.min(a, b)],
          [across / 2 + 12, Math.min(a, b)],
          [across / 2 + 12, Math.max(a, b)],
          [across / 2 - 12, Math.max(a, b)],
        ],
        "glue_area",
      ),
    );
  }
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

/**
 * The pouch features on a web laid side by side (centre seal, gusseted, flat bottom; U3.4 wave 2),
 * whose top seal runs along y = 0 across every panel: a `zipper` band under it across the front and
 * back, and on the front a `hang_hole`, a `window`, and the `tear_notch` as the punch marks (V
 * shapes) at its folded sides — a side edge that is a fold is notched after forming.
 * ⚠ Positions to be confirmed by Prepress.
 */
function sideFeatures(v: ParamValues, id: string, x0: number, size: number, across: number) {
  const f = featuresOf(v);
  const seal = num(v, "sealWidth", 8);
  const marks: Edge[] = [];
  const holes: Contour[] = [];
  if (id.startsWith("fin")) return { marks, holes };
  if (f.has("zipper"))
    marks.push(
      ...polygon(
        [
          [x0 + 0.5, seal + 8],
          [x0 + size - 0.5, seal + 8],
          [x0 + size - 0.5, seal + 14],
          [x0 + 0.5, seal + 14],
        ],
        "glue_area",
      ),
    );
  if (id !== "front") return { marks, holes };
  if (f.has("hang_hole")) holes.push(ellipse(x0 + size / 2, seal / 2, 3, 3));
  if (f.has("window")) {
    const ww = num(v, "windowWidth", size * 0.4);
    const wh = num(v, "windowHeight", across * 0.3);
    holes.push(roundedRectangle(x0 + size / 2 - ww / 2, across * 0.55 - wh / 2, ww, wh, Math.min(6, wh / 4)));
  }
  if (f.has("tear_notch"))
    for (const [x, d] of [
      [x0, 1],
      [x0 + size, -1],
    ] as const)
      marks.push(line([x, seal + 2], [x + 3 * d, seal + 4], "cut"), line([x + 3 * d, seal + 4], [x, seal + 6], "cut"));
  return { marks, holes };
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
    const side = vertical ? undefined : sideFeatures(v, p.id, at, p.size, across);
    const outline = vertical
      ? panelOutline(across, at, p.size, first, last, open?.notchAt)
      : rectangle(at, 0, p.size, across, {
          left: first ? "cut" : "crease",
          right: last ? "cut" : "crease",
          // A flat-bottom pouch's box bottom hangs on the front panel.
          ...(type === "flat_bottom" && p.id === "front" ? { bottom: "crease" as const } : {}),
        });
    // Seal bands: along the open edges (top and bottom, or both sides) and the whole of a fin.
    const marks: Edge[] = [...(open?.marks ?? []), ...(side?.marks ?? [])];
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
    faces.push(
      face(p.id, p.label, "flat", outline, { marks, holes: [...(open?.holes ?? []), ...(side?.holes ?? [])] }),
    );
    if (type === "flat_bottom" && p.id === "front") {
      // The box bottom: the front's width by the gusset, sealed round its three free edges.
      const g = num(v, "gusset", 40);
      const bottomMarks: Edge[] = polygon(
        [
          [at + 0.5, across + g - seal - 0.5],
          [at + p.size - 0.5, across + g - seal - 0.5],
          [at + p.size - 0.5, across + g - 0.5],
          [at + 0.5, across + g - 0.5],
        ],
        "glue_area",
      );
      faces.push(
        face("bottom", "bottom", "flat", rectangle(at, across, p.size, g, { top: "crease" }), { marks: bottomMarks }),
      );
    }
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
