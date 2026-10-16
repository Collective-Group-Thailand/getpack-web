import { bool, num, str } from "../../params";
import { ellipse, roundedRectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour } from "../../types";
import type { FeatureModule } from "../types";

/* Features only the style library's recipes use (U3.4), registered by `@getpack/dieline/library`. */

/**
 * Vent holes (`vents`): `round` Ø 12 mm or `oblong` 30 × 10 mm, two in each end panel (tube) or
 * each long wall (tray), at mid height, a third of the way in from each side. ⚠ Size and spacing
 * to be confirmed by Prepress.
 */
export const vents: FeatureModule = {
  id: "vents",
  slot: "feature",
  status: "implemented",
  fits: ["tube", "tray"],
  label: t("รูระบายอากาศ", "Vent holes"),
  params: ["vents"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
  tubeHoles(ctx, _cfg, panel) {
    const kind = str(ctx.v, "vents", "none");
    if (kind === "none" || (panel.id !== "right" && panel.id !== "left")) return [];
    return ventPair(kind, panel.x0, panel.x1, (panel.y0 + panel.y1) / 2);
  },
  trayHoles(ctx, _cfg, f) {
    const kind = str(ctx.v, "vents", "none");
    if (kind === "none") return {};
    const { length: L, width: W, height: H } = f;
    return {
      "wall-back": ventPair(kind, H, H + L, H / 2),
      "wall-front": ventPair(kind, H, H + L, H + W + H / 2),
    };
  },
};

function ventPair(kind: string, x0: number, x1: number, cy: number): Contour[] {
  return [1 / 3, 2 / 3].map((k) => {
    const cx = x0 + (x1 - x0) * k;
    return kind === "oblong" ? roundedRectangle(cx - 15, cy - 5, 30, 10, 5) : ellipse(cx, cy, 6, 6);
  });
}

/**
 * A finger notch in a flat pad (PK-CI-02 `thumb`): a stadium 30 × 12 mm centred 10 mm in from the
 * top edge, to lift the pad out. ⚠
 */
export const fingerNotch: FeatureModule = {
  id: "fingerNotch",
  slot: "feature",
  status: "implemented",
  fits: ["flat"],
  label: t("ช่องนิ้วดึง", "Finger notch"),
  params: ["fingerHole"],
  processes: ["die_cut"],
  contributes: { kinds: [], roles: ["cut"] },
  flatHoles(ctx) {
    if (!bool(ctx.v, "fingerHole", false)) return [];
    const l = num(ctx.v, "length", 100);
    return [roundedRectangle(l / 2 - 15, 4, 30, 12, 6)];
  },
};
