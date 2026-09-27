import { issue, num, str } from "../params";
import { ellipse, line, polygon, roundedRectangle } from "../path";
import type { Contour, ParamValues } from "../types";
import { flatDieline } from "./_flat";
import { defineStyle, t } from "./_shared";

/**
 * Hang tag — legacy "Tag ตัดมุม" (corners cut at 45°) and "Tag มุมมน" (rounded corners), with a
 * punched hole (legacy `dim`: 3 or 6 mm) centred near the top; `cornerSize` is legacy `r` (5).
 */
function outline(v: ParamValues): Contour {
  const w = num(v, "width", 40);
  const h = num(v, "length", 60);
  const r = Math.min(num(v, "cornerSize", 5), w / 3, h / 3);
  const corners = str(v, "corners", "chamfer");
  if (corners === "rounded") return roundedRectangle(0, 0, w, h, r);
  if (corners === "square" || r <= 0)
    return polygon([
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ]);
  // Chamfer the two top corners.
  return [
    line([r, 0], [w - r, 0]),
    line([w - r, 0], [w, r]),
    line([w, r], [w, h]),
    line([w, h], [0, h]),
    line([0, h], [0, r]),
    line([0, r], [r, 0]),
  ];
}

const holeOf = (v: ParamValues): Contour[] => {
  const d = Number(str(v, "hole", "6"));
  if (!(d > 0)) return [];
  const w = num(v, "width", 40);
  const cy = num(v, "holeOffset", Math.max(8, d * 1.5));
  return [ellipse(w / 2, cy, d / 2, d / 2)];
};

export const hangTag = defineStyle({
  id: "hang-tag",
  category: "flat",
  materials: ["paperboard"],
  name: t("ป้ายแท็ก (ตัดมุม / มุมมน)", "Hang tag (cut or rounded corners)"),
  description: t(
    "ป้ายห้อยสินค้า เจาะรูร้อยเชือก มุมตัดหรือมุมมน",
    "A swing tag with a string hole, corners cut or rounded",
  ),
  params: [
    {
      key: "width",
      kind: "length",
      group: "size",
      label: t("ความกว้าง", "Width"),
      min: 20,
      max: 200,
      step: 0.5,
      legacyKey: "w",
    },
    {
      key: "length",
      kind: "length",
      group: "size",
      label: t("ความสูง", "Height"),
      min: 30,
      max: 300,
      step: 0.5,
      legacyKey: "l",
    },
    {
      key: "corners",
      kind: "enum",
      group: "options",
      label: t("มุม", "Corners"),
      options: [
        { value: "chamfer", label: t("ตัดมุม", "Cut corners") },
        { value: "rounded", label: t("มุมมน", "Rounded") },
        { value: "square", label: t("มุมฉาก", "Square") },
      ],
    },
    {
      key: "cornerSize",
      kind: "length",
      group: "options",
      label: t("ขนาดมุม", "Corner size"),
      min: 1,
      max: 30,
      step: 0.5,
      legacyKey: "r",
    },
    {
      key: "hole",
      kind: "enum",
      group: "options",
      label: t("รูร้อยเชือก", "String hole"),
      options: [
        { value: "6", label: t("6 มม.", "6 mm") },
        { value: "3", label: t("3 มม.", "3 mm") },
        { value: "0", label: t("ไม่เจาะ", "None") },
      ],
      legacyKey: "dim",
    },
    {
      key: "holeOffset",
      kind: "length",
      group: "options",
      label: t("ระยะรูจากขอบบน", "Hole from top edge"),
      min: 4,
      max: 60,
      step: 0.5,
    },
  ],
  defaults: { width: 40, length: 60, corners: "chamfer", cornerSize: 5, hole: "6" },
  // Legacy tag-sleeve.csv sizes (cm): S 4×6, M 4×8, L 5×10, XL 6×12.
  presets: [
    { id: "s", label: t("S 40 × 60", "S 40 × 60"), values: { width: 40, length: 60 } },
    { id: "m", label: t("M 40 × 80", "M 40 × 80"), values: { width: 40, length: 80 } },
    { id: "l", label: t("L 50 × 100", "L 50 × 100"), values: { width: 50, length: 100 } },
    { id: "xl", label: t("XL 60 × 120", "XL 60 × 120"), values: { width: 60, length: 120 } },
  ],
  make: (v) => flatDieline("hang-tag", outline(v), "tag", { holes: holeOf(v) }),
  check: (v) => {
    const d = Number(str(v, "hole", "6"));
    const y = num(v, "holeOffset", Math.max(8, d * 1.5));
    return d > 0 && y - d / 2 < 3
      ? [
          issue(
            "hole.too_close",
            t("รูใกล้ขอบเกินไป (ต้องห่างอย่างน้อย 3 มม.)", "The hole is too close to the edge (at least 3 mm)"),
            "holeOffset",
          ),
        ]
      : [];
  },
  legacy: { patternKeys: ["pid:33", "pid:34", "mapping:57", "mapping:58", "tag-cut", "tag-curve"] },
});
