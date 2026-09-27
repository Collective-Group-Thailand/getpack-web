import type { MaterialSpec, ParamValues } from "../types";
import {
  CARTON_DEFAULTS,
  CARTON_MATERIALS,
  CARTON_PRESETS,
  cartonCheck,
  cartonParams,
  makeCarton,
  tuck,
  tuckChecks,
  tuckParams,
} from "./_carton";
import { defineStyle, t } from "./_shared";

const shared = {
  category: "folding_carton" as const,
  materials: CARTON_MATERIALS,
  params: cartonParams(tuckParams),
  defaults: CARTON_DEFAULTS,
  presets: CARTON_PRESETS,
  faces3d: { roots: { blank: "front" } },
  check: cartonCheck((v: ParamValues, m: MaterialSpec) => tuckChecks(v, m)),
};

export const tuckEnd = defineStyle({
  ...shared,
  id: "tuck-end",
  name: t("กล่องฝาเสียบ (บน-ล่างทางเดียวกัน)", "Straight tuck end"),
  description: t(
    "กล่องกระดาษแข็งสำหรับสินค้าขายปลีก ลิ้นเสียบบนและล่างพับจากด้านหลังเหมือนกัน",
    "Retail carton whose top and bottom tucks both hinge from the back panel",
  ),
  // Straight tuck: both lids hinge on the back panel.
  make: (v, m) => makeCarton("tuck-end", v, m, { top: tuck(v, m, 2, true), bottom: tuck(v, m, 2, false) }),
  legacy: {
    patternKeys: [
      "pid:1",
      "mapping:1",
      "folding-truck-end-box",
      "pid:26",
      "mapping:50",
      "corrugate-truck-end-box",
      "ste",
    ],
  },
});

export const reverseTuckEnd = defineStyle({
  ...shared,
  id: "reverse-tuck-end",
  name: t("กล่องฝาเสียบสลับ (บน-ล่างสลับด้าน)", "Reverse tuck end"),
  description: t(
    "ลิ้นเสียบบนพับจากด้านหลัง ลิ้นเสียบล่างพับจากด้านหน้า ใช้กระดาษคุ้มกว่าในงานพิมพ์จำนวนมาก",
    "Top tuck hinges from the back, bottom tuck from the front — nests tighter on the press sheet",
  ),
  make: (v, m) => makeCarton("reverse-tuck-end", v, m, { top: tuck(v, m, 2, true), bottom: tuck(v, m, 0, false) }),
  legacy: { patternKeys: ["rte"] },
});
