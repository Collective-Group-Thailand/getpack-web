import { makeSlotted, slottedChecks, slottedCommon } from "./rsc";
import { defineStyle, t } from "./_shared";

export const fol = defineStyle({
  ...slottedCommon,
  id: "fol",
  codes: { fefco: "0203" },
  name: t("กล่องลูกฟูกฝาซ้อนเต็ม (FOL)", "Full overlap slotted container (FOL)"),
  description: t(
    "ฝานอกยาวเท่าความกว้าง ซ้อนกันเต็มแผ่น แข็งแรงเมื่อวางซ้อนและกันกระแทกด้านบน",
    "Outer flaps as deep as the width, overlapping fully — stronger stacking and top protection",
  ),
  make: (v, m) => makeSlotted("fol", v, m),
  check: slottedChecks,
  legacy: { patternKeys: ["pid:39", "mapping:73", "mapping:70", "corrugate-rsc-full-overlap"] },
});
