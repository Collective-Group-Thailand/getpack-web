import { assemble, face, piece } from "../faces";
import type { FaceLabel } from "../labels";
import { issue, num, str } from "../params";
import { polygon, rectangle } from "../path";
import type { Edge, Face, ParamValues } from "../types";
import { defineStyle, t } from "./_shared";

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

function make(v: ParamValues) {
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
  return assemble("pouch", [piece("blank", "blank", faces)]);
}

const typeIs = (...types: PouchType[]) => ({ key: "pouchType", in: types });

export const pouch = defineStyle({
  id: "pouch",
  category: "flat",
  materials: ["flexible"],
  name: t("ซองบรรจุภัณฑ์ (แบบพิมพ์)", "Pouch print template"),
  description: t(
    "แบบคลี่สำหรับพิมพ์ซอง: ซีล 3 ด้าน, ซีล 4 ด้าน, ซีลกลาง, ซีลกลางมีข้าง และซองตั้งได้",
    "Flat print layouts for 3-side seal, 4-side seal, centre seal, centre seal with gussets and stand-up pouches",
  ),
  params: [
    {
      key: "pouchType",
      kind: "enum",
      group: "construction",
      label: t("ชนิดซอง", "Pouch type"),
      options: [
        { value: "three_side", label: t("ซีล 3 ด้าน", "3-side seal") },
        { value: "four_side", label: t("ซีล 4 ด้าน", "4-side seal") },
        { value: "center_seal", label: t("ซีลกลาง (หมอน)", "Centre seal (pillow)") },
        { value: "center_seal_gusset", label: t("ซีลกลางมีข้าง", "Centre seal with gussets") },
        { value: "standing", label: t("ซองตั้งได้", "Stand-up pouch") },
      ],
    },
    {
      key: "width",
      kind: "length",
      group: "size",
      label: t("ความกว้างรวมรอยซีล", "Width incl. seals"),
      min: 30,
      max: 600,
      step: 0.5,
      legacyKey: "w",
    },
    {
      key: "length",
      kind: "length",
      group: "size",
      label: t("ความสูงรวมรอยซีล", "Height incl. seals"),
      min: 30,
      max: 800,
      step: 0.5,
      legacyKey: "l",
    },
    {
      key: "gusset",
      kind: "length",
      group: "size",
      label: t("ขนาดข้างซองรวมรอยซีล", "Side gusset incl. seals"),
      min: 10,
      max: 200,
      step: 0.5,
      legacyKey: "s",
      when: typeIs("four_side", "center_seal_gusset"),
    },
    {
      key: "bottom",
      kind: "length",
      group: "size",
      label: t("ขนาดก้นซองรวมรอยซีล", "Bottom gusset incl. seals"),
      min: 10,
      max: 200,
      step: 0.5,
      legacyKey: "b",
      when: typeIs("standing"),
    },
    {
      key: "centerSeal",
      kind: "length",
      group: "construction",
      label: t("ขนาดซีลกลาง", "Centre seal"),
      min: 5,
      max: 30,
      step: 0.5,
      legacyKey: "cs",
      when: typeIs("center_seal", "center_seal_gusset"),
    },
    {
      key: "sealWidth",
      kind: "length",
      group: "construction",
      label: t("ความกว้างรอยซีล", "Seal width"),
      min: 3,
      max: 25,
      step: 0.5,
    },
  ],
  defaults: { pouchType: "three_side", width: 120, length: 180, gusset: 40, bottom: 40, centerSeal: 10, sealWidth: 8 },
  presets: [
    {
      id: "three-side",
      label: t("ซีล 3 ด้าน 120 × 180", "3-side seal 120 × 180"),
      values: { pouchType: "three_side", width: 120, length: 180 },
    },
    {
      id: "standing",
      label: t("ซองตั้ง 140 × 200 ก้น 40", "Stand-up 140 × 200, 40 base"),
      values: { pouchType: "standing", width: 140, length: 200, bottom: 40 },
    },
    {
      id: "pillow",
      label: t("ซีลกลาง 100 × 160", "Centre seal 100 × 160"),
      values: { pouchType: "center_seal", width: 100, length: 160 },
    },
    {
      id: "gusset",
      label: t("ซีลกลางมีข้าง 100 × 200 ข้าง 40", "Centre seal gusset 100 × 200, 40 side"),
      values: { pouchType: "center_seal_gusset", width: 100, length: 200, gusset: 40 },
    },
    {
      id: "four-side",
      label: t("ซีล 4 ด้าน 100 × 180 ข้าง 40", "4-side seal 100 × 180, 40 side"),
      values: { pouchType: "four_side", width: 100, length: 180, gusset: 40 },
    },
  ],
  make: (v) => make(v),
  check: (v) =>
    num(v, "sealWidth", 8) * 2 >= Math.min(num(v, "width", 120), num(v, "length", 180))
      ? [issue("seal.too_wide", t("รอยซีลกว้างเกินขนาดซอง", "The seals are wider than the pouch"), "sealWidth")]
      : [],
  legacy: {
    patternKeys: [
      "pid:40",
      "pid:41",
      "pid:42",
      "pid:43",
      "pid:44",
      "mapping:76",
      "mapping:77",
      "mapping:78",
      "mapping:79",
      "mapping:80",
      "pouch-3-seal",
      "pouch-center-seal",
      "pouch-center-seal-gusset",
      "pouch-4-seal",
      "pouch-standing",
    ],
  },
});
