import { TRAY_CORNER_FLAP_MAX_MM, TRAY_CORNER_FLAP_SHARE } from "../../constants";
import { face } from "../../faces";
import { num, str } from "../../params";
import { rectangle } from "../../path";
import { t } from "../../styles/_shared";
import type { Contour } from "../../types";
import type { FeatureModule, TrayFrame } from "../types";

/* Tray features of style-library wave 1 (U3.4). */

/** The corner flap reach a tray body draws (`tray` preset `glued`). */
export const cornerFlapOf = (height: number) =>
  Math.min(height * TRAY_CORNER_FLAP_SHARE, TRAY_CORNER_FLAP_MAX_MM, height - 0.5);

/**
 * Lock-corner slits: where each corner flap's tip lands on the front and back walls, a slit
 * 1.5 mm wide over the middle 40 % of the wall that the flap's tip is pushed through — the corners
 * hold without glue. Drawn only where the flap reaches 8 mm or more. ⚠ Slit width and position to
 * be confirmed by Prepress (a lock tab on the flap is not drawn).
 */
export function lockCornerHoles(f: TrayFrame, cornerFlap = cornerFlapOf(f.height)): Record<string, Contour[]> {
  const { length: L, width: W, height: H } = f;
  const cf = Math.min(cornerFlap, (L - 1) / 2, (W - 1) / 2);
  if (cf < 8) return {};
  const slit = (x: number, y: number) => rectangle(x - 0.75, y, 1.5, H * 0.4);
  const xs = [H + cf - 3, H + L - cf + 3];
  return {
    "wall-back": xs.map((x) => slit(x, H * 0.3)),
    "wall-front": xs.map((x) => slit(x, H + W + H * 0.3)),
  };
}

export const lockCorners: FeatureModule = {
  id: "lockCorners",
  slot: "feature",
  status: "implemented",
  fits: ["tray"],
  label: t("มุมล็อก (ไม่ใช้กาว)", "Lock corners (no glue)"),
  params: ["cornerLock"],
  processes: ["die_cut", "hand_assembly"],
  contributes: { kinds: [], roles: ["cut"] },
  trayHoles: (ctx, _cfg, frame) => (str(ctx.v, "cornerLock", "glued") === "lock" ? lockCornerHoles(frame) : {}),
};

/**
 * A header card standing up from a display tray's back wall (PK-DS-01): the back wall carries on
 * `headerHeight` above the rim, with a crease at the rim so it ships flat.
 */
export const displayHeader: FeatureModule = {
  id: "displayHeader",
  slot: "feature",
  status: "implemented",
  fits: ["tray"],
  label: t("แผ่นหัวโชว์", "Display header card"),
  params: ["headerHeight"],
  processes: ["die_cut"],
  contributes: { kinds: ["hanger"], roles: ["cut", "crease"] },
  tray: (ctx, _cfg, f) => {
    const h = num(ctx.v, "headerHeight", 120);
    return {
      "wall-back": [face("header", "header", "hanger", rectangle(f.height, -h, f.length, h, { bottom: "crease" }))],
    };
  },
  hinges: () => ({ angles: { header: 0 } }),
};
