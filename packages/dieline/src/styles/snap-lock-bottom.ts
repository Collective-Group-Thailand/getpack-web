import { snapLockTongueFor } from "../constants";
import { snapLockClosure } from "../construct/closures";
import { num } from "../params";
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

/** The tongue past the centre line — legacy PatternArea pid 16 `b` (3 / 5 / 10 mm by width). */
const tongueOf = (v: ParamValues) => num(v, "lockTongue", snapLockTongueFor(num(v, "width", 40)));

export const snapLockBottom = defineStyle({
  id: "snap-lock-bottom",
  category: "folding_carton",
  materials: CARTON_MATERIALS,
  name: t("กล่องฝาเสียบบน ก้นล็อก (1-2-3)", "Tuck top, snap-lock (1-2-3) bottom"),
  description: t(
    "ฝาบนเป็นลิ้นเสียบ ก้นพับล็อกกันเองโดยไม่ต้องใช้กาว รับน้ำหนักได้ดีกว่าฝาเสียบธรรมดา",
    "Tuck top; the bottom flaps interlock without glue and carry more weight than a tuck",
  ),
  params: cartonParams([
    ...tuckParams,
    {
      key: "lockTongue",
      kind: "length",
      group: "closure",
      label: t("ลิ้นล็อกก้น", "Bottom lock tongue"),
      help: t(
        "เว้นว่างเพื่อใช้ค่าแนะนำตามความกว้าง (3 / 5 / 10 มม.)",
        "Leave empty for the recommended tongue by width (3 / 5 / 10 mm)",
      ),
      min: 2,
      max: 30,
      step: 0.5,
      legacyKey: "b",
    },
  ]),
  defaults: CARTON_DEFAULTS,
  presets: CARTON_PRESETS,
  faces3d: { roots: { blank: "front" } },
  make: (v, m) =>
    makeCarton("snap-lock-bottom", v, m, {
      top: tuck(v, m, 2, true),
      bottom: snapLockClosure({ tongue: tongueOf(v), clearance: Math.max(0.5, m.caliperMm) }),
    }),
  check: cartonCheck((v: ParamValues, m: MaterialSpec) => tuckChecks(v, m)),
  legacy: { patternKeys: ["pid:16", "pid:17", "mapping:94", "folding-truck-end-snap-lock-bottom"] },
});
