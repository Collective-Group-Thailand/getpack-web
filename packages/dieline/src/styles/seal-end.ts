import { DUST_FLAP_LENGTH_SHARE, DUST_FLAP_WIDTH_SHARE } from "../constants";
import { slottedFlaps } from "../construct/closures";
import { num } from "../params";
import type { MaterialSpec, ParamValues } from "../types";
import { CARTON_DEFAULTS, CARTON_MATERIALS, cartonCheck, cartonParams, makeCarton, tubeDims } from "./_carton";
import { defineStyle, t } from "./_shared";

/**
 * Seal end: glued flaps at both ends. The back panel's outer flap covers the whole end (W), the
 * front panel's inner flap 60 % of it, the side dust flaps reach in under both; glue on the outer.
 */
function ends(v: ParamValues, m: MaterialSpec) {
  const d = tubeDims(v, m);
  const L = num(v, "length", 70);
  const W = num(v, "width", 40);
  const dust = Math.min(L * DUST_FLAP_LENGTH_SHARE, W * DUST_FLAP_WIDTH_SHARE);
  return slottedFlaps({
    depths: [d.side * 0.6, dust, d.side, dust],
    slot: 0,
    labels: ["inner_flap", "dust_flap", "outer_flap", "dust_flap"],
    kinds: ["flap", "dust_flap", "lid", "dust_flap"],
    glue: [2],
  });
}

export const sealEnd = defineStyle({
  id: "seal-end",
  category: "folding_carton",
  materials: CARTON_MATERIALS,
  name: t("กล่องปิดทากาวหัวท้าย (Seal end)", "Seal end"),
  description: t(
    "ปิดทั้งสองด้านด้วยกาว แน่นหนา เหมาะกับสินค้าเทใส่อัตโนมัติ เช่น ซีเรียล ผงซักฟอก",
    "Both ends closed with glue — tamper-evident, for auto-filled goods like cereal or detergent",
  ),
  params: cartonParams(),
  defaults: { ...CARTON_DEFAULTS, length: 190, width: 60, height: 280 },
  presets: [
    {
      id: "cereal",
      label: t("ซีเรียล 190 × 60 × 280", "Cereal 190 × 60 × 280"),
      values: { length: 190, width: 60, height: 280 },
    },
    { id: "tea", label: t("ชา 110 × 60 × 70", "Tea 110 × 60 × 70"), values: { length: 110, width: 60, height: 70 } },
    {
      id: "powder",
      label: t("ผง 150 × 50 × 200", "Powder 150 × 50 × 200"),
      values: { length: 150, width: 50, height: 200 },
    },
  ],
  faces3d: {
    roots: { blank: "front" },
    stages: { "flap-front-top": 2, "flap-back-top": 3, "flap-front-bottom": 2, "flap-back-bottom": 3 },
  },
  make: (v, m) => makeCarton("seal-end", v, m, { top: ends(v, m), bottom: ends(v, m) }),
  check: cartonCheck(),
  legacy: { patternKeys: [] },
});
