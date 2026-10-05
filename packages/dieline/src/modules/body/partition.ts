import { assemble, face, piece } from "../../faces";
import { num, str } from "../../params";
import { polygon } from "../../path";
import { t } from "../../styles/_shared";
import type { Pt } from "../../types";
import type { BodyModule } from "../types";

/** Evenly spaced divider positions for `n` cells over `total`. */
export const dividers = (n: number, total: number) => Array.from({ length: n - 1 }, (_x, i) => ((i + 1) * total) / n);

/**
 * The strips of a rows × cols partition grid inside L × W, `H` tall, with slots `s` wide: one long
 * strip per row divider slotted from the top, one cross strip per column divider slotted from the
 * bottom. Piece and face ids carry `prefix` (a grid inside a box: `cells-`).
 */
export function partitionStrips(L: number, W: number, H: number, s: number, rows: number, cols: number, prefix = "") {
  const strip = (len: number, slots: number[], fromTop: boolean): Pt[] => {
    // Walked clockwise from the top-left corner; each slot a notch half the height deep.
    const pts: Pt[] = [[0, 0]];
    if (fromTop)
      for (const x of slots) pts.push([x - s / 2, 0], [x - s / 2, H / 2], [x + s / 2, H / 2], [x + s / 2, 0]);
    pts.push([len, 0], [len, H]);
    if (!fromTop)
      for (const x of [...slots].reverse())
        pts.push([x + s / 2, H], [x + s / 2, H / 2], [x - s / 2, H / 2], [x - s / 2, H]);
    pts.push([0, H]);
    return pts;
  };
  return [
    ...dividers(rows, W).map((_y, i) =>
      piece(`${prefix}long-${i + 1}`, "blank", [
        face(`${prefix}long-${i + 1}`, "partition", "flat", polygon(strip(L, dividers(cols, L), true))),
      ]),
    ),
    ...dividers(cols, L).map((_x, i) =>
      piece(`${prefix}cross-${i + 1}`, "blank", [
        face(`${prefix}cross-${i + 1}`, "partition", "flat", polygon(strip(W, dividers(rows, W), false))),
      ]),
    ),
  ];
}

/**
 * A cross partition set (PK-CI-01): for `partition` = rows × columns cells inside L × W, strips
 * along the length (one per row divider) slotted from the top at each column divider, and strips
 * across (one per column divider) slotted from the bottom at each row divider, `height` tall; the
 * slots are half the height and a caliper + 1 mm wide. Assembled by hand, not folded: 2D only
 * (D-152). ⚠ Slot clearance to be confirmed by Prepress.
 */
export const partitionSet: BodyModule = {
  id: "partitionSet",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("ช่องกั้นตาราง (แผ่นสอดขัดกัน)", "Partition grid (slotted strips)"),
  params: ["partition"],
  processes: ["die_cut", "slotter", "hand_assembly"],
  contributes: { kinds: ["flat"], roles: ["cut"] },
  constraints: [
    {
      id: "partitionSet.cell",
      code: "partition.cell_too_small",
      severity: "error",
      param: "partition",
      require: "length / gridCount(partition, 1) >= 25 and width / gridCount(partition, 0) >= 25",
      message: t("ช่องเล็กเกินไป (อย่างน้อย 25 มม.)", "The cells are too small (25 mm at least)"),
    },
  ],
  build(ctx) {
    const { v, m } = ctx;
    const [rows, cols] = str(v, "partition", "2x2").split("x").map(Number);
    const pieces = partitionStrips(
      num(v, "length", 300),
      num(v, "width", 200),
      num(v, "height", 100),
      m.caliperMm + 1,
      rows,
      cols,
    );
    return assemble(ctx.styleId, pieces);
  },
};
