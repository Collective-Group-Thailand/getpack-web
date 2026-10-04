import { glueWidthFor } from "../../constants";
import { buildTube, type Closure } from "../../construct/tube";
import { assemble, face, piece } from "../../faces";
import { num, str } from "../../params";
import { ellipse, polygon, rectangle, roundedRectangle } from "../../path";
import { grainOn, t } from "../../styles/_shared";
import type { Contour, Edge } from "../../types";
import type { BodyModule } from "../types";

/** The top turned over inside a paper bag, and how far its handles sit below the top. ⚠ */
const TURN_OVER_MM = 50;

/**
 * A paper carrier bag (PK-PG-01) laid flat: a glue flap, front, gusset, back, gusset (each gusset
 * in two halves creased down its middle) — or front and back alone when `bagGusset` = `flat` — a
 * top turned over inside and bottom flaps glued shut. `bagHandle`: `twisted_paper` / `flat_paper`
 * glue patches on the turn-over for the handles, `rope` two punched holes through the panel and its
 * turn-over each side, `die_cut` a hand hole through both, `none`. 2D only (D-152). ⚠ Turn-over,
 * bottom and handle positions to be confirmed by Prepress.
 */
export const paperBag: BodyModule = {
  id: "paperBag",
  slot: "body",
  kind: "flat",
  status: "implemented",
  folds: false,
  label: t("ถุงกระดาษ (พับขอบบน ก้นกาว หูหิ้ว)", "Paper carrier bag (turn-over top, glued bottom, handles)"),
  params: ["width", "gusset", "height", "bagGusset", "bagHandle", "glueWidth", "grain"],
  processes: ["die_cut", "hand_assembly"],
  contributes: { kinds: ["panel", "glue_flap", "flap"], roles: ["cut", "crease", "glue_area"] },
  constraints: [
    {
      id: "paperBag.die_cut_handle",
      code: "handle.too_small",
      severity: "error",
      param: "bagHandle",
      require: "not (bagHandle == 'die_cut' and width < 130)",
      message: t("ถุงแคบเกินกว่าจะเจาะหูหิ้ว", "The bag is too narrow for a die-cut handle"),
    },
  ],
  build(ctx) {
    const { v, m } = ctx;
    const w = num(v, "width", 250);
    const h = num(v, "height", 300);
    const gusseted = str(v, "bagGusset", "gusseted") === "gusseted";
    const g = gusseted ? num(v, "gusset", 100) : 0;
    const handle = str(v, "bagHandle", "twisted_paper");
    const panels = gusseted
      ? [
          { id: "front", label: "front" as const, width: w },
          { id: "gusset-right-a", label: "side" as const, width: g / 2 },
          { id: "gusset-right-b", label: "side" as const, width: g / 2 },
          { id: "back", label: "back" as const, width: w },
          { id: "gusset-left-a", label: "side" as const, width: g / 2 },
          { id: "gusset-left-b", label: "side" as const, width: g / 2 },
        ]
      : [
          { id: "front", label: "front" as const, width: w },
          { id: "back", label: "back" as const, width: w },
        ];
    const bottomDepth = gusseted ? g / 2 + 15 : 30;
    const isMain = (id: string) => id === "front" || id === "back";
    // Handle cut-outs in a main panel (top at y = 0) and, mirrored over the crease, its turn-over.
    const cutouts = (x0: number, x1: number, y: (d: number) => number): Contour[] => {
      const cx = (x0 + x1) / 2;
      if (handle === "rope") return [-1, 1].map((k) => ellipse(cx + k * w * 0.2, y(25), 2.5, 2.5));
      if (handle === "die_cut") {
        const a = y(15);
        const b = y(45);
        return [roundedRectangle(cx - 45, Math.min(a, b), 90, 30, 15)];
      }
      return [];
    };
    const patch = (x0: number, x1: number): Edge[] =>
      handle === "twisted_paper" || handle === "flat_paper"
        ? polygon(
            [
              [(x0 + x1) / 2 - 50, -TURN_OVER_MM + 5],
              [(x0 + x1) / 2 + 50, -TURN_OVER_MM + 5],
              [(x0 + x1) / 2 + 50, -5],
              [(x0 + x1) / 2 - 50, -5],
            ],
            "glue_area",
          )
        : [];
    // The turn-over and the bottom run on across the panel creases; cut only at the two ends.
    const sides = (i: number, n: number) =>
      ({ bottom: "crease", left: i > 0 ? "crease" : "cut", right: i < n - 1 ? "crease" : "cut" }) as const;
    const top: Closure = ({ panels: spans }) => ({
      attachments: spans.map((s) => ({
        span: [s.x0, s.x1] as [number, number],
        face: face(
          `turn-${s.id}`,
          "inner_flap",
          "flap",
          rectangle(s.x0, -TURN_OVER_MM, s.x1 - s.x0, TURN_OVER_MM, sides(s.index, spans.length)),
          {
            holes: isMain(s.id) ? cutouts(s.x0, s.x1, (d) => -d) : [],
            marks: isMain(s.id) ? patch(s.x0, s.x1) : [],
          },
        ),
      })),
    });
    const bottom: Closure = ({ panels: spans }) => ({
      attachments: spans.map((s) => ({
        span: [s.x0, s.x1] as [number, number],
        face: face(
          `bottom-${s.id}`,
          "bottom_flap",
          "flap",
          rectangle(s.x0, -bottomDepth, s.x1 - s.x0, bottomDepth, sides(s.index, spans.length)),
        ),
      })),
    });
    const faces = buildTube({
      panels,
      depth: h,
      glue: num(v, "glueWidth", glueWidthFor(w, m)),
      top,
      bottom,
      holes: (p) => (isMain(p.id) ? cutouts(p.x0, p.x1, (d) => p.y0 + d) : []),
    });
    return assemble(ctx.styleId, [piece("blank", "blank", faces, grainOn(v, faces, "front"))]);
  },
};
