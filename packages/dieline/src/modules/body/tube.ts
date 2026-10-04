import { buildTube, type Closure, type PanelSpan } from "../../construct/tube";
import { assemble, piece } from "../../faces";
import type { FaceLabel, PieceLabel } from "../../labels";
import { str } from "../../params";
import { grainOn, t } from "../../styles/_shared";
import type { BodyModule, BuildContext, ModuleConfig, Parts } from "../types";

/**
 * A tube of panels with a glue flap, closed (or not) at each end — the body of tuck ends, lock
 * bottoms, seal ends, slotted containers, wrap-arounds, sleeves and n-sided prisms. Every size is
 * an expression in the recipe, so compensation is reviewable data:
 *
 *   panels  [{ id, label, width }]   score widths, e.g. "length + a.panel"
 *   depth   score depth between the end creases
 *   glue    glue flap width (0 for none); glueRight: expression, mirrors the blank
 *   piece   { id, label }; grain: the face the grain arrow sits on; root: the face that stays put
 *   turn    fold angle between panels when it is not 90° (a hexagon's 60°)
 */

interface PanelCfg {
  id: string;
  label: FaceLabel;
  width: string;
}

const closureFor = (ctx: BuildContext, parts: Parts, end: "top" | "bottom"): Closure | undefined => {
  const use = parts[end];
  let closure = use?.def.slot === "closure" ? use.def.tube?.(ctx, use.cfg, end, parts) : undefined;
  for (const f of parts.features) {
    if (f.def.slot === "feature" && f.def.wrapClosure && f.cfg.end === end && closure) {
      closure = f.def.wrapClosure(ctx, f.cfg, end, closure);
    }
  }
  return closure;
};

/** The separate pieces features cut with the body (a die-cut insert). */
export const extraPieces = (ctx: BuildContext, parts: Parts) =>
  parts.features.flatMap((f) => (f.def.slot === "feature" ? (f.def.pieces?.(ctx, f.cfg) ?? []) : []));

const pieceOf = (cfg: ModuleConfig) =>
  (cfg.piece ?? { id: "blank", label: "blank" }) as { id: string; label: PieceLabel };

export const tube: BodyModule = {
  id: "tube",
  slot: "body",
  kind: "tube",
  status: "implemented",
  folds: true,
  label: t("ตัวกล่องทรงท่อ (แผงต่อกัน + ปีกกาว)", "Tube of panels with a glue flap"),
  params: ["glueWidth", "glueSide", "grain"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["panel", "glue_flap"], roles: ["cut", "crease", "glue_area"] },
  presets: {
    /** Four panels closed at both ends (ADR-0008 compensation: panel + t, depth + 2t, glue side − t). */
    carton: {
      dims: {
        front: "length + a.panel",
        side: "width + a.panel",
        closingSide: "side - a.gluePanel",
        depth: "height + a.depth",
        glue: "glueWidth ?? glueWidthFor(width)",
      },
      panels: [
        { id: "front", label: "front", width: "front" },
        { id: "right", label: "right", width: "side" },
        { id: "back", label: "back", width: "front" },
        { id: "left", label: "left", width: "closingSide" },
      ],
      depth: "depth",
      glue: "glue",
      glueRight: "glueSide == 'right'",
      grain: "front",
      root: "front",
    },
  },
  build(ctx, cfg, parts) {
    const panels = (cfg.panels as unknown as PanelCfg[]).map((p) => ({
      id: p.id,
      label: p.label,
      width: ctx.num(p.width),
    }));
    const features = parts.features.filter((f) => f.def.slot === "feature" && f.def.tubeHoles);
    const faces = buildTube({
      panels,
      depth: ctx.num(cfg.depth as string),
      glue: ctx.num((cfg.glue ?? 0) as string),
      glueId: cfg.glueId as string | undefined,
      // The joint (`joint`): glued, stitched (no glue area) or taped (no flap, `glue` gives 0).
      glueMarks: str(ctx.v, "joint", "glue") !== "stitch",
      glueRight: cfg.glueRight === undefined ? undefined : ctx.test(cfg.glueRight as string),
      top: closureFor(ctx, parts, "top"),
      bottom: closureFor(ctx, parts, "bottom"),
      ...(features.length
        ? {
            holes: (p: PanelSpan & { y0: number; y1: number }) =>
              features.flatMap((f) => (f.def.slot === "feature" ? (f.def.tubeHoles?.(ctx, f.cfg, p) ?? []) : [])),
          }
        : {}),
    });
    const p = pieceOf(cfg);
    return assemble(ctx.styleId, [
      piece(p.id, p.label, faces, grainOn(ctx.v, faces, cfg.grain as string)),
      ...extraPieces(ctx, parts),
    ]);
  },
  hinges(_ctx, cfg) {
    const p = pieceOf(cfg);
    const turn = cfg.turn as number | undefined;
    const ids = (cfg.panels as unknown as PanelCfg[]).slice(1).map((x) => x.id);
    return {
      roots: { [p.id]: cfg.root as string },
      ...(turn
        ? { angles: Object.fromEntries([...ids, (cfg.glueId as string) ?? "glue"].map((id) => [id, turn])) }
        : {}),
    };
  },
};
