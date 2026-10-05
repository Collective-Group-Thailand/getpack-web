import { assemble, face, piece } from "../../faces";
import { num, str } from "../../params";
import { mapEdge, rectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour, Pt } from "../../types";
import { hangHoleShape } from "../feature/features";
import type { BodyModule } from "../types";

/*
 * Bodies the style library's second wave adds (U3.4 wave 2).
 */

const mirrorAcross = (c: Contour, y: number): Contour =>
  c.map((e) => mapEdge(e, (p: Pt): Pt => [p[0], 2 * y - p[1]], true));

/**
 * Two leaves joined by one crease, folded to `angle` (degrees; 180 folds one onto the other):
 * a bag header card (PK-TG-04: `length` across × `height` per leaf, folded over the bag's top and
 * stapled, with a hang hole through both leaves `hangFromFold` mm below the fold), or a V-board edge
 * protector (PK-CI-03: legs `width` wide along `length`, folded to 90°). ⚠ Hole position to be
 * confirmed by Prepress.
 */
export const foldedCard: BodyModule = {
  id: "foldedCard",
  slot: "body",
  kind: "special",
  status: "implemented",
  folds: true,
  label: t("แผ่นพับสองทบ", "Two leaves on one crease"),
  params: ["length", "width", "height", "hangHole"],
  processes: ["die_cut"],
  contributes: { kinds: ["panel"], roles: ["cut", "crease"] },
  build(ctx, cfg) {
    const { v } = ctx;
    const across = ctx.num((cfg.across as string) ?? "length");
    const leaf = ctx.num((cfg.leaf as string) ?? "height");
    const kind = str(v, "hangHole", "none");
    const d = num(v, "hangFromFold", 14);
    const holeA = kind === "none" ? [] : hangHoleShape(kind, across / 2, leaf - d);
    const holeB = holeA.map((c) => mirrorAcross(c, leaf));
    const faces = [
      face("leaf-a", "front", "panel", rectangle(0, 0, across, leaf, { bottom: "crease" }), { holes: holeA }),
      face("leaf-b", "back", "panel", rectangle(0, leaf, across, leaf, { top: "crease" }), { holes: holeB }),
    ];
    return assemble(ctx.styleId, [piece("blank", "blank", faces)]);
  },
  hinges: (_ctx, cfg) => ({
    roots: { blank: "leaf-a" },
    angles: { "leaf-b": (cfg.angle as number | undefined) ?? 180 },
  }),
};
