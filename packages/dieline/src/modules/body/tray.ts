import { buildTray } from "../../construct/tray";
import { assemble, piece } from "../../faces";
import type { PieceLabel } from "../../labels";
import { grainOn, t } from "../../styles/_shared";
import type { Face } from "../../types";
import type { BodyModule, TrayExtras, TrayFrame, TrayWall } from "../types";

/**
 * A cross-shaped tray — a base, four walls and corner glue flaps — the body of trays, six-corner
 * boxes, double-wall trays and roll-end mailers. Sizes are expressions (`length`, `width`,
 * `height`, `cornerFlap`, usually through the recipe's `dims`); a lid closure and wall features
 * hang their faces on the walls' free edges.
 */

const WALLS: TrayWall[] = ["wall-back", "wall-front", "wall-left", "wall-right"];

export const tray: BodyModule = {
  id: "tray",
  slot: "body",
  kind: "tray",
  status: "implemented",
  folds: true,
  label: t("ถาด (ฐาน + ผนัง 4 ด้าน, ปีกกาวมุม)", "Tray (base, four walls, glued corners)"),
  params: ["grain"],
  processes: ["die_cut", "folder_gluer_corner"],
  contributes: { kinds: ["base", "wall", "flap"], roles: ["cut", "crease"] },
  presets: {
    /** Inside L × W × H: base + t each way, walls + t (one closure layer, the base). */
    glued: {
      dims: {
        trayLength: "length + a.panel",
        trayWidth: "width + a.panel",
        trayHeight: "height + a.trayDepth",
        cornerFlap: "cornerFlap ?? min(trayHeight * C.TRAY_CORNER_FLAP_SHARE, C.TRAY_CORNER_FLAP_MAX_MM)",
      },
      length: "trayLength",
      width: "trayWidth",
      height: "trayHeight",
      cornerFlap: "cornerFlap",
      grain: "base",
    },
  },
  build(ctx, cfg, parts) {
    const frame: TrayFrame = {
      length: ctx.num(cfg.length as string),
      width: ctx.num(cfg.width as string),
      height: ctx.num(cfg.height as string),
    };
    const extras: TrayExtras[] = [];
    if (parts.top?.def.slot === "closure" && parts.top.def.tray)
      extras.push(parts.top.def.tray(ctx, parts.top.cfg, frame));
    for (const f of parts.features)
      if (f.def.slot === "feature" && f.def.tray) extras.push(f.def.tray(ctx, f.cfg, frame));
    const wallExtras: Partial<Record<TrayWall, () => Face[]>> = {};
    for (const w of WALLS) {
      const faces = extras.flatMap((e) => e[w] ?? []);
      if (faces.length) wallExtras[w] = () => faces;
    }
    const faces = buildTray({ ...frame, cornerFlap: ctx.num(cfg.cornerFlap as string), wallExtras });
    const p = (cfg.piece ?? { id: "blank", label: "blank" }) as { id: string; label: PieceLabel };
    return assemble(ctx.styleId, [piece(p.id, p.label, faces, grainOn(ctx.v, faces, cfg.grain as string))]);
  },
  hinges: () => ({ roots: { blank: "base" }, upright: "base" }),
};
