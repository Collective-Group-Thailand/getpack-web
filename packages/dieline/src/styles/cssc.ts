import { makeSlotted, slottedChecks, slottedCommon } from "./rsc";
import { defineStyle, t } from "./_shared";

export const cssc = defineStyle({
  ...slottedCommon,
  id: "cssc",
  codes: { fefco: "0204" },
  name: t("กล่องลูกฟูกฝาชนกลางทุกด้าน (CSSC)", "Centre special slotted container (CSSC)"),
  description: t(
    "ฝาในและฝานอกยาวมาชนกันกลางกล่องทั้งสองแนว ปิดด้านบนเต็มสองชั้น",
    "Inner and outer flaps all meet at the centre — a full double layer top and bottom",
  ),
  make: (v, m) => makeSlotted("cssc", v, m),
  check: slottedChecks,
  legacy: { patternKeys: [] },
});
