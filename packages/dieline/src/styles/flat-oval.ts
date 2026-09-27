import { num } from "../params";
import { ellipse } from "../path";
import { flatDieline, FLAT_MATERIALS } from "./_flat";
import { defineStyle, sizeParams, t } from "./_shared";

const flatSize = sizeParams({ length: [5, 1000], width: [5, 1000] });

export const flatOval = defineStyle({
  id: "flat-oval",
  category: "flat",
  materials: FLAT_MATERIALS,
  name: t("แผ่นวงรี", "Oval"),
  description: t("ฉลากหรือสติกเกอร์วงรี", "An oval label or sticker"),
  params: flatSize,
  defaults: { length: 80, width: 50 },
  presets: [
    { id: "a", label: t("60 × 40", "60 × 40"), values: { length: 60, width: 40 } },
    { id: "b", label: t("100 × 60", "100 × 60"), values: { length: 100, width: 60 } },
  ],
  make: (v) => {
    const rx = num(v, "length", 80) / 2;
    const ry = num(v, "width", 50) / 2;
    return flatDieline("flat-oval", ellipse(rx, ry, rx, ry));
  },
  legacy: { patternKeys: [] },
});
