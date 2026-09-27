import { EURO_SLOT_HEIGHT_MM, EURO_SLOT_WIDTH_MM, HANG_HOLE_DIAMETER_MM } from "../constants";
import { face } from "../faces";
import { issue, num, str } from "../params";
import { ellipse, line, roundedRectangle } from "../path";
import type { Closure } from "../construct/tube";
import type { Contour, MaterialSpec, ParamValues } from "../types";
import {
  CARTON_DEFAULTS,
  CARTON_MATERIALS,
  CARTON_PRESETS,
  cartonCheck,
  cartonParams,
  makeCarton,
  tubeDims,
  tuck,
  tuckChecks,
  tuckParams,
} from "./_carton";
import { defineStyle, t } from "./_shared";

const hangerHeightOf = (v: ParamValues, m: MaterialSpec) =>
  num(v, "hangerHeight", Math.max(25, Math.min(45, tubeDims(v, m).side)));

/**
 * A hang tab standing up from the back panel, with a euro slot or a round hole. The crease at its
 * foot lets the tab fold flat for shipping; on the shelf it stands in line with the back.
 */
function withHanger(inner: Closure, v: ParamValues, m: MaterialSpec): Closure {
  return (ctx) => {
    const base = inner(ctx);
    const back = ctx.panels[2];
    const h = hangerHeightOf(v, m);
    const cx = (back.x0 + back.x1) / 2;
    const cy = -h * 0.55;
    const kind = str(v, "hangHole", "euro");
    const holes: Contour[] =
      kind === "euro"
        ? [
            roundedRectangle(
              cx - EURO_SLOT_WIDTH_MM / 2,
              cy - EURO_SLOT_HEIGHT_MM / 2,
              EURO_SLOT_WIDTH_MM,
              EURO_SLOT_HEIGHT_MM,
              EURO_SLOT_HEIGHT_MM / 2,
            ),
          ]
        : kind === "round"
          ? [ellipse(cx, cy, HANG_HOLE_DIAMETER_MM / 2, HANG_HOLE_DIAMETER_MM / 2)]
          : [];
    const r = Math.min(6, h / 3, (back.x1 - back.x0) / 4);
    const hanger = face(
      `hanger-${ctx.end}`,
      "hanger",
      "hanger",
      [
        line([back.x0, 0], [back.x0, -h + r], "cut"),
        ...roundedTop(back.x0, back.x1, -h, r),
        line([back.x1, -h + r], [back.x1, 0], "cut"),
        line([back.x1, 0], [back.x0, 0], "crease"),
      ],
      { holes },
    );
    return { ...base, attachments: [...base.attachments, { face: hanger, span: [back.x0, back.x1] }] };
  };
}

/** A top edge from (x0, y + r) to (x1, y + r) with rounded corners. */
function roundedTop(x0: number, x1: number, y: number, r: number) {
  const rr = roundedRectangle(x0, y, x1 - x0, 2 * r + 1, r);
  // Take the top-left arc, the top line and the top-right arc of a rounded rectangle, reordered.
  const [topLine, topRight, , , , , , topLeft] = rr;
  return r > 0.01 ? [topLeft, topLine, topRight] : [line([x0, y], [x1, y], "cut")];
}

export const hangTabTuck = defineStyle({
  id: "hang-tab-tuck",
  category: "folding_carton",
  materials: CARTON_MATERIALS,
  name: t("กล่องฝาเสียบมีหูแขวน", "Tuck end with hang tab"),
  description: t(
    "หูแขวนยื่นจากด้านหลัง เจาะรูแบบยูโรหรือรูกลม สำหรับแขวนบนราวในร้าน ฝาบนพับจากด้านหน้า",
    "A hang tab rises from the back with a euro slot or round hole for peg display; the top lid hinges from the front",
  ),
  params: cartonParams([
    ...tuckParams,
    {
      key: "hangerHeight",
      kind: "length",
      group: "options",
      label: t("ความสูงหูแขวน", "Hang tab height"),
      help: t("เว้นว่างเพื่อใช้ค่าแนะนำ", "Leave empty for the recommended height"),
      min: 15,
      max: 120,
      step: 0.5,
    },
    {
      key: "hangHole",
      kind: "enum",
      group: "options",
      label: t("รูแขวน", "Hang hole"),
      options: [
        { value: "euro", label: t("รูยูโร", "Euro slot") },
        { value: "round", label: t("รูกลม", "Round hole") },
        { value: "none", label: t("ไม่เจาะ", "None") },
      ],
    },
  ]),
  defaults: { ...CARTON_DEFAULTS, hangHole: "euro" },
  presets: CARTON_PRESETS,
  faces3d: { roots: { blank: "front" }, angles: { "hanger-top": 0 } },
  // The top lid hinges on the front so the back can carry the hang tab.
  make: (v, m) =>
    makeCarton("hang-tab-tuck", v, m, { top: withHanger(tuck(v, m, 0, false), v, m), bottom: tuck(v, m, 2, false) }),
  check: cartonCheck((v: ParamValues, m: MaterialSpec) => {
    const out = tuckChecks(v, m);
    const d = tubeDims(v, m);
    if (str(v, "hangHole", "euro") === "euro" && d.front < EURO_SLOT_WIDTH_MM + 12) {
      out.push(
        issue(
          "hanger.too_narrow",
          t(
            "กล่องแคบเกินกว่าจะเจาะรูยูโร เลือกรูกลมแทน",
            "The box is too narrow for a euro slot — choose a round hole",
          ),
          "hangHole",
        ),
      );
    }
    return out;
  }),
  legacy: { patternKeys: ["pid:6", "pid:8"] },
});
