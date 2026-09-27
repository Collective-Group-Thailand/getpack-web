import { snapLockTongueFor } from "../constants";
import { gableClosure, snapLockClosure } from "../construct/closures";
import { issue, num } from "../params";
import type { MaterialSpec, ParamValues } from "../types";
import { CARTON_DEFAULTS, CARTON_MATERIALS, cartonCheck, cartonParams, makeCarton, tubeDims } from "./_carton";
import { defineStyle, t } from "./_shared";

/** 45° roof: the gable ends rise W/2 and each roof panel is (W/2)·√2 long. */
function roofOf(v: ParamValues, m: MaterialSpec) {
  const side = tubeDims(v, m).side;
  return { apex: side / 2, roof: (side / 2) * Math.SQRT2, handle: num(v, "handleHeight", 40) };
}

export const gable = defineStyle({
  id: "gable",
  category: "folding_carton",
  materials: CARTON_MATERIALS,
  name: t("กล่องทรงบ้าน มีหูหิ้ว", "Gable box with handle"),
  description: t(
    "หลังคาทรงจั่วต่อเป็นหูหิ้วมีช่องมือจับ ก้นล็อก 1-2-3 เหมาะกับขนม เบเกอรี่ ของฝาก",
    "A gable roof rising into a carry handle with a hand hole, snap-lock bottom — bakery and gifts",
  ),
  params: cartonParams([
    {
      key: "handleHeight",
      kind: "length",
      group: "options",
      label: t("ความสูงหูหิ้ว", "Handle height"),
      min: 25,
      max: 120,
      step: 0.5,
    },
  ]),
  defaults: { ...CARTON_DEFAULTS, length: 150, width: 80, height: 100, handleHeight: 40 },
  presets: [
    {
      id: "cake",
      label: t("ขนม 150 × 80 × 100", "Cakes 150 × 80 × 100"),
      values: { length: 150, width: 80, height: 100 },
    },
    {
      id: "gift",
      label: t("ของฝาก 200 × 100 × 120", "Gifts 200 × 100 × 120"),
      values: { length: 200, width: 100, height: 120 },
    },
  ],
  faces3d: {
    roots: { blank: "front" },
    angles: { "roof-front-top": 45, "roof-back-top": 45, "handle-front-top": -45, "handle-back-top": -45 },
  },
  closedSize: (v, m) => ({
    length: num(v, "length", 150),
    width: num(v, "width", 80),
    height: num(v, "height", 100) + roofOf(v, m).apex,
  }),
  make: (v, m) => {
    const r = roofOf(v, m);
    return makeCarton("gable", v, m, {
      top: gableClosure({ ...r, hole: { width: 90, height: 24 } }),
      bottom: snapLockClosure({
        tongue: snapLockTongueFor(num(v, "width", 80)),
        clearance: Math.max(0.5, m.caliperMm),
      }),
    });
  },
  check: cartonCheck((v: ParamValues, m: MaterialSpec) =>
    tubeDims(v, m).front < 60
      ? [
          issue(
            "handle.too_narrow",
            t("กล่องแคบเกินกว่าจะทำหูหิ้ว (ต้องยาวอย่างน้อย 60 มม.)", "Too narrow for a handle (at least 60 mm long)"),
            "length",
          ),
        ]
      : [],
  ),
  legacy: {
    patternKeys: [
      "pid:9",
      "pid:27",
      "pid:28",
      "mapping:51",
      "mapping:52",
      "corrugate-handle-box-no-rim",
      "corrugate-handle-box-with-rim",
    ],
  },
});
