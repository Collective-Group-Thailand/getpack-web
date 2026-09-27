import { num } from "../params";
import { ellipse } from "../path";
import { flatDieline, FLAT_MATERIALS } from "./_flat";
import { defineStyle, t } from "./_shared";

export const flatCircle = defineStyle({
  id: "flat-circle",
  category: "flat",
  materials: FLAT_MATERIALS,
  name: t("แผ่นวงกลม", "Circle"),
  description: t("ฉลากหรือสติกเกอร์วงกลม", "A round label or sticker"),
  params: [
    {
      key: "diameter",
      kind: "length",
      group: "size",
      label: t("เส้นผ่านศูนย์กลาง", "Diameter"),
      min: 5,
      max: 600,
      step: 0.5,
      legacyKey: "w",
    },
  ],
  defaults: { diameter: 50 },
  presets: [
    { id: "d30", label: t("⌀ 30", "⌀ 30"), values: { diameter: 30 } },
    { id: "d50", label: t("⌀ 50", "⌀ 50"), values: { diameter: 50 } },
    { id: "d80", label: t("⌀ 80", "⌀ 80"), values: { diameter: 80 } },
  ],
  make: (v) => {
    const r = num(v, "diameter", 50) / 2;
    return flatDieline("flat-circle", ellipse(r, r, r, r));
  },
  legacy: { patternKeys: ["mapping:24", "circle"] },
});
