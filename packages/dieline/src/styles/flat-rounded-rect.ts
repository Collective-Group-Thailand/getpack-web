import { issue, num } from "../params";
import { roundedRectangle } from "../path";
import { flatDieline, FLAT_MATERIALS, LABEL_PRESETS } from "./_flat";
import { defineStyle, sizeParams, t } from "./_shared";

const flatSize = sizeParams({ length: [5, 1000], width: [5, 1000] });

export const flatRoundedRect = defineStyle({
  id: "flat-rounded-rect",
  category: "flat",
  materials: FLAT_MATERIALS,
  name: t("แผ่นสี่เหลี่ยมมุมมน", "Rounded rectangle"),
  description: t("ชิ้นงานแบนสี่เหลี่ยมมุมมน รัศมีมุมกำหนดได้", "A flat rectangle with rounded corners"),
  params: [
    ...flatSize,
    {
      key: "cornerRadius",
      kind: "length",
      group: "size",
      label: t("รัศมีมุม", "Corner radius"),
      min: 1,
      max: 200,
      step: 0.5,
      legacyKey: "r",
    },
  ],
  defaults: { length: 100, width: 60, cornerRadius: 6 },
  presets: LABEL_PRESETS,
  make: (v) =>
    flatDieline(
      "flat-rounded-rect",
      roundedRectangle(0, 0, num(v, "length", 100), num(v, "width", 60), num(v, "cornerRadius", 6)),
    ),
  check: (v) =>
    num(v, "cornerRadius", 6) > Math.min(num(v, "length", 100), num(v, "width", 60)) / 2
      ? [
          issue(
            "corner.too_large",
            t("รัศมีมุมเกินครึ่งหนึ่งของด้านที่สั้นกว่า", "The corner radius is more than half the shorter side"),
            "cornerRadius",
            "warning",
          ),
        ]
      : [],
  legacy: { patternKeys: [] },
});
