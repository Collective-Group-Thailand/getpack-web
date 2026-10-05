import { t, windowHole, windowIssues } from "../../styles/_shared";
import type { FeatureModule } from "../types";

/*
 * Features the style library's second wave adds (U3.4 wave 2).
 */

/**
 * A window in a tray (the master `window` axis on trays): `windowPanel` = `wall-front` cuts it in
 * the front wall; `lid` is cut by the hinged lid itself (`hingedLid`). Patched with film like a
 * carton window.
 */
export const trayWindow: FeatureModule = {
  id: "trayWindow",
  slot: "feature",
  status: "implemented",
  fits: ["tray"],
  label: t("หน้าต่างบนถาด", "Tray window"),
  params: ["window", "windowPanel", "windowWidth", "windowHeight", "windowOffsetX", "windowOffsetY", "windowRadius"],
  processes: ["window_patching"],
  contributes: { kinds: [], roles: ["cut"] },
  trayHoles: (ctx, _cfg, f) => ({
    // The front wall in the tray frame: x ∈ [h, h + length], y ∈ [h + width, 2h + width].
    "wall-front": windowHole(
      ctx.v,
      "wall-front",
      f.height,
      f.height + f.length,
      f.height + f.width,
      2 * f.height + f.width,
    ),
  }),
  check: (ctx, _cfg, built) => windowIssues(ctx.v, built),
};
