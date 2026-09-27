import { crashLockClosure } from "../construct/closures";
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

export const crashLockBottom = defineStyle({
  id: "crash-lock-bottom",
  category: "folding_carton",
  materials: CARTON_MATERIALS,
  name: t("กล่องฝาเสียบบน ก้นล็อกอัตโนมัติ (ป๊อปอัพ)", "Tuck top, crash-lock (auto) bottom"),
  description: t(
    "ก้นทากาวมาจากโรงงาน กางกล่องแล้วก้นล็อกเป็นรูปทันที เร็วที่สุดในไลน์บรรจุ",
    "The bottom is pre-glued at the factory and snaps square as the carton is opened — fastest to pack",
  ),
  params: cartonParams(tuckParams),
  defaults: CARTON_DEFAULTS,
  presets: CARTON_PRESETS,
  faces3d: { roots: { blank: "front" } },
  make: (v, m) => makeCarton("crash-lock-bottom", v, m, { top: tuck(v, m, 2, true), bottom: crashLockClosure() }),
  check: cartonCheck((v: ParamValues, m: MaterialSpec) => tuckChecks(v, m)),
  legacy: { patternKeys: ["pid:7"] },
});
