import { GLUE_AREA_INSET_MM } from "../constants";
import { num } from "../params";
import { polygon, rectangle } from "../path";
import { flatDieline } from "./_flat";
import { defineStyle, t } from "./_shared";

/** A paper band (legacy "สายคาด", strap): a strip wrapped round a product, glued on its overlap. */
export const band = defineStyle({
  id: "band",
  category: "flat",
  materials: ["paperboard", "label"],
  name: t("สายคาด", "Band (strap)"),
  description: t(
    "แถบกระดาษคาดรอบสินค้า ทับกาวที่ปลาย ความยาวคือรอบวงรวมระยะทับ",
    "A paper strip round a product, glued where it overlaps; the length includes the overlap",
  ),
  params: [
    {
      key: "length",
      kind: "length",
      group: "size",
      label: t("ความยาวรวม", "Total length"),
      min: 50,
      max: 1200,
      step: 0.5,
      legacyKey: "l",
    },
    {
      key: "width",
      kind: "length",
      group: "size",
      label: t("ความกว้างแถบ", "Band width"),
      min: 10,
      max: 300,
      step: 0.5,
      legacyKey: "w",
    },
    {
      key: "overlap",
      kind: "length",
      group: "construction",
      label: t("ระยะทับกาว", "Glue overlap"),
      min: 5,
      max: 50,
      step: 0.5,
    },
  ],
  defaults: { length: 400, width: 50, overlap: 15 },
  presets: [
    { id: "box", label: t("คาดกล่อง 400 × 50", "Box band 400 × 50"), values: { length: 400, width: 50 } },
    { id: "jar", label: t("คาดขวดโหล 280 × 40", "Jar band 280 × 40"), values: { length: 280, width: 40 } },
  ],
  make: (v) => {
    const l = num(v, "length", 400);
    const w = num(v, "width", 50);
    const o = num(v, "overlap", 15);
    const i = Math.min(GLUE_AREA_INSET_MM, o / 4, w / 4);
    return flatDieline("band", rectangle(0, 0, l, w), "band", {
      marks: polygon(
        [
          [l - o + i, i],
          [l - i, i],
          [l - i, w - i],
          [l - o + i, w - i],
        ],
        "glue_area",
      ),
    });
  },
  legacy: { patternKeys: ["mapping:66", "strap"] },
});
