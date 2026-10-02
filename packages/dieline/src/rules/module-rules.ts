import { WINDOW_MIN_MARGIN_MM } from "../constants";
import { namesOf } from "../expr";
import { findFace } from "../faces";
import { polygonInsideWithMargin } from "../geom";
import { FLAP_DEFAULTS } from "../modules/closure/tube-closures";
import type { BuildContext, ModuleConfig } from "../modules/types";
import { issue, str } from "../params";
import { flattenContour } from "../path";
import { t } from "../styles/_shared";
import type { Dieline, Issue } from "../types";

/**
 * Manufacturing rules that need a module's settings or the built geometry, keyed by module id.
 * They live here rather than on the modules so the storefront, which only draws and validates,
 * never loads them; `explain()` runs them with the material class's rules in `ctx.rules`.
 */
type Rule = (ctx: BuildContext, cfg: ModuleConfig, built: Dieline) => Issue[];

/** The parameter a size expression is made of, following the body's named sizes (`side` → `width`). */
function paramOf(src: unknown, ctx: BuildContext, dims: Record<string, string>): string | undefined {
  if (typeof src !== "string") return undefined;
  for (const n of namesOf(src)) {
    if (n in dims) {
      const p = paramOf(dims[n], ctx, dims);
      if (p) return p;
    } else if (n in ctx.v) return n;
  }
  return undefined;
}

const tube: Rule = (ctx, cfg) => {
  const r = ctx.rules!;
  const dims = (cfg.dims ?? {}) as Record<string, string>;
  const out: Issue[] = [];
  for (const p of cfg.panels as unknown as { id: string; width: string }[]) {
    if (ctx.num(p.width) < r.minPanel)
      out.push(
        issue(
          "mfg.panel_too_narrow",
          t(
            `แผง ${p.id} แคบกว่า ${r.minPanel} มม. ที่เครื่องพับได้`,
            `Panel ${p.id} is narrower than the ${r.minPanel} mm a machine folds`,
          ),
          paramOf(p.width, ctx, dims),
        ),
      );
  }
  if (ctx.num(cfg.depth as string) < r.minPanel)
    out.push(
      issue(
        "mfg.panel_too_narrow",
        t(`ความสูงแผงน้อยกว่า ${r.minPanel} มม.`, `Panels are shorter than ${r.minPanel} mm`),
        paramOf(cfg.depth, ctx, dims),
      ),
    );
  const glue = ctx.num((cfg.glue ?? 0) as string);
  if (glue > 0 && glue < r.minGlueFlap)
    out.push(
      issue(
        "mfg.glue_flap_too_narrow",
        t(`ปีกกาวแคบกว่า ${r.minGlueFlap} มม.`, `The glue flap is narrower than ${r.minGlueFlap} mm`),
        "glueWidth",
      ),
    );
  return out;
};

const tray: Rule = (ctx, cfg) =>
  (["length", "width", "height"] as const)
    .filter((k) => ctx.num(cfg[k] as string) < ctx.rules!.minPanel)
    .map((k) =>
      issue(
        "mfg.panel_too_narrow",
        t(`ถาดด้าน ${k} น้อยกว่า ${ctx.rules!.minPanel} มม.`, `The tray's ${k} is under ${ctx.rules!.minPanel} mm`),
        k,
      ),
    );

const slots =
  (id: string): Rule =>
  (ctx, raw) => {
    const slot = ctx.num(({ ...FLAP_DEFAULTS[id], ...raw }.slot ?? 0) as string);
    const min = ctx.rules!.minSlot;
    return slot > 0 && slot < min
      ? [issue("mfg.slot_too_narrow", t(`ร่องระหว่างปีกแคบกว่า ${min} มม.`, `Slots are narrower than ${min} mm`))]
      : [];
  };

/** A class that needs more board round a window than the storefront's 6 mm (rigid). */
const windowMargin: Rule = (ctx, _cfg, built) => {
  const margin = ctx.rules!.windowMargin;
  if (margin <= WINDOW_MIN_MARGIN_MM || str(ctx.v, "window", "none") === "none") return [];
  const panel = findFace(built, str(ctx.v, "windowPanel", "front"));
  const hole = panel?.holes[0];
  return panel && hole && !polygonInsideWithMargin(flattenContour(panel.outline), flattenContour(hole), margin)
    ? [
        issue(
          "mfg.window_margin",
          t(
            `หน้าต่างต้องห่างขอบ ${margin} มม. สำหรับวัสดุนี้`,
            `The window needs ${margin} mm of board round it in this material`,
          ),
          "windowWidth",
        ),
      ]
    : [];
};

export const MODULE_MANUFACTURING: Readonly<Record<string, Rule>> = {
  tube,
  tray,
  window: windowMargin,
  ...Object.fromEntries(Object.keys(FLAP_DEFAULTS).map((id) => [id, slots(id)])),
};
