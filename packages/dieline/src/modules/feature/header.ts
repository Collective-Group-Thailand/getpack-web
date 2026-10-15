import { face } from "../../faces";
import { issue, num, str } from "../../params";
import { bezier, flattenContour, line, mapEdge } from "../../path";
import { t } from "../../styles/_shared";
import { parseSvgPath } from "../../svgpath";
import type { Contour, Edge, ParamValues, Pt } from "../../types";
import type { FeatureModule } from "../types";

/**
 * A shaped display header (`headerShape`): the back panel carried up above the top as a decorative
 * card whose top edge follows a profile — an arch, a peak, a wave, scallops, a cloud, a flower, or
 * the customer's own (`headerPath`). It stands in line with the back, `headerShapeHeight` tall at its
 * highest; the profile is drawn in a 100 × 100 box (0 at the top, 100 at the crease) and stretched
 * to the panel's width and the header's height. A header takes the back panel's edge, so it goes
 * with a top hinged elsewhere (reverse or airplane tuck, a seal under it) and not with a hang tab.
 * ⚠ Minimum neck and profile margins to be confirmed by Prepress.
 */

/** The lowest a profile may come: a strip this deep (box units) stays above the crease. */
const PROFILE_FLOOR = 85;

/** `n` bumps between `from` and `to` across the box, each `heights[i]` high above the baseline `base`. */
function bumps(base: number, heights: number[]): Edge[] {
  const w = 100 / heights.length;
  return heights.map((h, i) => {
    const a = i * w;
    const b = a + w;
    // A cubic's peak is ¾ of its control points' lift.
    const lift = base - (h * 4) / 3;
    return bezier([a, base], [a, lift], [b, lift], [b, base]);
  });
}

/** The preset profiles, left to right across the box. */
export const HEADER_PROFILES: Record<string, () => Edge[]> = {
  arch: () => [bezier([0, 45], [0, -15], [100, -15], [100, 45])],
  peak: () => [line([0, 60], [50, 0]), line([50, 0], [100, 60])],
  wave: () => [bezier([0, 40], [17, 0], [33, 80], [50, 40]), bezier([50, 40], [67, 0], [83, 80], [100, 40])],
  scallop: () => bumps(45, [30, 30, 30, 30, 30]),
  cloud: () => bumps(55, [25, 40, 25]),
  flower: () => bumps(50, [15, 25, 35, 25, 15]),
};

/**
 * The customer's profile: an SVG path in the 100 × 100 box from the left edge (x = 0) to the right
 * (x = 100), never lower than the floor. A path closed back to its start is read without that
 * closing edge. `null` when it is not one.
 */
export function customProfile(d: string): Edge[] | null {
  let contours: Contour[];
  try {
    contours = parseSvgPath(d);
  } catch {
    return null;
  }
  const [first] = contours;
  if (!first || first.length < 2) return null;
  const open = first.slice(0, -1);
  const pts = flattenContour(open, 0.5);
  const start = open[0]!.from;
  const end = open[open.length - 1]!.to;
  const inside = pts.every(([x, y]) => x >= -0.5 && x <= 100.5 && y >= -0.5 && y <= PROFILE_FLOOR);
  return inside && Math.abs(start[0]) <= 1 && Math.abs(end[0] - 100) <= 1 ? open : null;
}

function profileOf(v: ParamValues): Edge[] | null {
  const shape = str(v, "headerShape", "none");
  if (shape === "none") return null;
  if (shape === "custom") return customProfile(str(v, "headerPath", ""));
  return HEADER_PROFILES[shape]?.() ?? null;
}

export const shapedHeader: FeatureModule = {
  id: "shapedHeader",
  slot: "feature",
  status: "implemented",
  fits: ["tube"],
  label: t("หัวโชว์ตัดตามรูปทรง", "Shaped display header"),
  params: ["headerShape", "headerShapeHeight", "headerPath"],
  processes: ["die_cut"],
  contributes: { kinds: ["hanger"], roles: ["cut", "crease"] },
  check(ctx) {
    const shape = str(ctx.v, "headerShape", "none");
    if (shape === "none") return [];
    if (str(ctx.v, "hangHole", "none") !== "none")
      return [
        issue(
          "header.with_hang",
          t("หัวโชว์กับหูแขวนใช้ขอบแผงหลังเดียวกัน เลือกอย่างใดอย่างหนึ่ง", "A header and a hang tab both stand on the back panel — choose one"),
          "headerShape",
        ),
      ];
    if (!profileOf(ctx.v))
      return [
        issue(
          "header.path_invalid",
          t(
            "เส้นหัวโชว์ต้องเริ่มที่ขอบซ้าย (x = 0) จบที่ขอบขวา (x = 100) และอยู่ในกรอบ 100 × 100 สูงกว่าแนวพับ",
            "The header outline must run from the left edge (x = 0) to the right (x = 100) inside the 100 × 100 box, clear of the crease",
          ),
          "headerPath",
        ),
      ];
    return [];
  },
  // Set on the top end (`end`: `top` in the recipe), like a hang tab.
  wrapClosure: (ctx, _cfg, _end, inner) => (c) => {
    const base = inner(c);
    const profile = profileOf(ctx.v);
    if (!profile) return base;
    const back = c.panels[2];
    const h = num(ctx.v, "headerShapeHeight", 50);
    const w = back.x1 - back.x0;
    const at = ([u, v]: Pt): Pt => [back.x0 + (u * w) / 100, -h + (v * h) / 100];
    const top = profile.map((e) => mapEdge(e, at));
    const start = top[0]!.from;
    const finish = top[top.length - 1]!.to;
    const header = face(`header-${c.end}`, "header", "hanger", [
      line([back.x0, 0], start, "cut"),
      ...top.map((e) => ({ ...e, role: "cut" as const })),
      line(finish, [back.x1, 0], "cut"),
      line([back.x1, 0], [back.x0, 0], "crease"),
    ]);
    return { ...base, attachments: [...base.attachments, { face: header, span: [back.x0, back.x1] }] };
  },
  hinges: (ctx, cfg) => (profileOf(ctx.v) ? { angles: { [`header-${cfg.end as string}`]: 0 } } : {}),
};
