import { num } from "../params";
import { rectangle } from "../path";
import { flatDieline, FLAT_MATERIALS, LABEL_PRESETS } from "./_flat";
import { defineStyle, sizeParams, t } from "./_shared";

const flatSize = sizeParams({ length: [5, 1000], width: [5, 1000] });

export const flatRect = defineStyle({
  id: "flat-rect",
  category: "flat",
  materials: FLAT_MATERIALS,
  name: t("แผ่นสี่เหลี่ยม (ฉลาก/สติกเกอร์/แผ่นพิมพ์)", "Rectangle (label, sticker, flat print)"),
  description: t("ชิ้นงานแบนสี่เหลี่ยม ตัดตรงทุกด้าน", "A flat rectangle, straight cuts all round"),
  params: flatSize,
  defaults: { length: 100, width: 60 },
  presets: LABEL_PRESETS,
  make: (v) => flatDieline("flat-rect", rectangle(0, 0, num(v, "length", 100), num(v, "width", 60))),
  legacy: { patternKeys: ["pid:14", "pid:15", "pid:18", "pid:24", "pid:35", "mapping:25", "mapping:59", "square"] },
});
