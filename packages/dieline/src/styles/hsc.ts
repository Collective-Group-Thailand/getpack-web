import { makeSlotted, slottedChecks, slottedCommon } from "./rsc";
import { defineStyle, t } from "./_shared";

export const hsc = defineStyle({
  ...slottedCommon,
  id: "hsc",
  codes: { fefco: "0200" },
  name: t("กล่องลูกฟูกฝาเดียว (HSC)", "Half slotted container (HSC)"),
  description: t(
    "เหมือนกล่องฝาชนแต่ไม่มีฝาบน ใช้คู่กับฝาครอบหรือเป็นถาดลึก",
    "An RSC without top flaps — used with a separate lid or as a deep tray",
  ),
  make: (v, m) => makeSlotted("hsc", v, m),
  check: slottedChecks,
  legacy: { patternKeys: [] },
});
