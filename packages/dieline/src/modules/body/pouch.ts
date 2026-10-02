import { assemble, face, piece } from "../../faces";
import type { FaceLabel } from "../../labels";
import { num, str } from "../../params";
import { polygon, rectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Edge, Face, ParamValues } from "../../types";
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
    const outline = vertical
      ? rectangle(0, at, across, p.size, { top: first ? "cut" : "crease", bottom: last ? "cut" : "crease" })
      : rectangle(at, 0, p.size, across, { left: first ? "cut" : "crease", right: last ? "cut" : "crease" });
    // Seal bands: along the open edges (top and bottom, or both sides) and the whole of a fin.
    const marks: Edge[] = [];
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
    faces.push(face(p.id, p.label, "flat", outline, { marks }));
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
  params: ["pouchType", "width", "length", "gusset", "bottom", "centerSeal", "sealWidth"],
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
