import { assemble, face, piece } from "../../faces";
import { bool, num, str } from "../../params";
import { line, polygon, rectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Edge } from "../../types";
import type { BodyModule } from "../types";

/**
 * A courier poly mailer (PK-PB-06) laid flat: a closing flap, the back and the front, folded at
 * the bottom and sealed down both sides. `adhesive` = `single` puts a peel-and-seal strip on the
 * flap; `dual` a second one below it to send the parcel back; `tearStrip` a pair of perforations
 * 8 mm apart across the back under the flap to open it. 2D only (D-152). ⚠ Strip positions to be
 * confirmed by Prepress.
 */
export const polyMailer: BodyModule = {
  id: "polyMailer",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("ซองไปรษณีย์พลาสติก (ฝาปิด + ซีลข้าง)", "Courier poly mailer (flap, side seals)"),
  params: ["width", "length", "flapDepth", "sealWidth", "adhesive", "tearStrip"],
  processes: ["pouch_making", "adhesive_strip_applicator"],
  contributes: { kinds: ["flat"], roles: ["cut", "crease", "glue_area", "perforation"] },
  constraints: [
    {
      id: "polyMailer.flap",
      code: "flap.too_deep",
      severity: "error",
      param: "flapDepth",
      require: "flapDepth < length / 2",
      message: t("ฝาปิดลึกเกินครึ่งความยาวซอง", "The flap is deeper than half the mailer"),
    },
  ],
  build(ctx) {
    const { v } = ctx;
    const w = num(v, "width", 250);
    const l = num(v, "length", 350);
    const f = num(v, "flapDepth", 50);
    const seal = num(v, "sealWidth", 8);
    const strip = (y: number) =>
      polygon(
        [
          [10, y],
          [w - 10, y],
          [w - 10, y + 8],
          [10, y + 8],
        ],
        "glue_area",
      );
    const adhesive = str(v, "adhesive", "single");
    const flapMarks = [
      ...(adhesive !== "none" ? strip(f * 0.3 - 4) : []),
      ...(adhesive === "dual" ? strip(f * 0.7 - 4) : []),
    ];
    const sides = (y0: number, h: number): Edge[] => [
      ...polygon(
        [
          [0.5, y0 + 0.5],
          [seal, y0 + 0.5],
          [seal, y0 + h - 0.5],
          [0.5, y0 + h - 0.5],
        ],
        "glue_area",
      ),
      ...polygon(
        [
          [w - seal, y0 + 0.5],
          [w - 0.5, y0 + 0.5],
          [w - 0.5, y0 + h - 0.5],
          [w - seal, y0 + h - 0.5],
        ],
        "glue_area",
      ),
    ];
    const tear = bool(v, "tearStrip", false) ? [f + 12, f + 20].map((y) => line([0, y], [w, y], "perforation")) : [];
    const faces = [
      face("flap", "outer_flap", "flat", rectangle(0, 0, w, f, { bottom: "crease" }), { marks: flapMarks }),
      face("back", "back", "flat", rectangle(0, f, w, l, { top: "crease", bottom: "crease" }), {
        marks: [...sides(f, l), ...tear],
      }),
      face("front", "front", "flat", rectangle(0, f + l, w, l, { top: "crease" }), { marks: sides(f + l, l) }),
    ];
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
};
