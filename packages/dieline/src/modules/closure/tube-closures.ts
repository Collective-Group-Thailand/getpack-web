import {
  DUST_FLAP_LENGTH_SHARE,
  DUST_FLAP_WIDTH_SHARE,
  THUMB_NOTCH_RADIUS_MM,
  TUCK_CORNER_RADIUS_MM,
  tuckDepthFor,
} from "../../constants";
import {
  crashLockClosure,
  gableClosure,
  polygonLid,
  slottedFlaps,
  snapLockClosure,
  tuckClosure,
} from "../../construct/closures";
import type { FaceLabel } from "../../labels";
import { bool, num, str } from "../../params";
import { t, windowHole } from "../../styles/_shared";
import type { FaceKind, Pt } from "../../types";
import type { Closure } from "../../construct/tube";
import type { BuildContext, ClosureModule, Constraint, ModuleConfig } from "../types";

/*
 * Closures on the end of a tube. Each reads the body's named sizes (`front`, `side`, `depth`, or
 * `panel` for an n-sided tube) and draws with the `construct/closures.ts` builders.
 */

const PANEL_INDEX: Record<string, number> = { front: 0, right: 1, back: 2, left: 3 };

/** The rules every tuck shares (legacy `calculate_conditions` #1 tuck depth by length). */
export const TUCK_CONSTRAINTS: Constraint[] = [
  {
    id: "tuck.min_depth",
    code: "mfg.tuck_too_shallow",
    severity: "error",
    param: "tuckDepth",
    require: "(tuckDepth ?? tuckDepthFor(length)) >= rule.minTuck",
    message: t("ลิ้นเสียบตื้นเกินไปสำหรับวัสดุนี้", "The tuck is too shallow to hold in this material"),
    stage: "manufacturing",
  },
  {
    id: "tuck.depth_vs_height",
    code: "tuck.too_deep",
    severity: "error",
    param: "tuckDepth",
    require: "(tuckDepth ?? tuckDepthFor(length)) < depth - 5",
    message: t("ลิ้นเสียบลึกเกินความสูงกล่อง", "The tuck is deeper than the box is tall"),
  },
  {
    id: "tuck.depth_vs_lid",
    code: "tuck.deeper_than_lid",
    severity: "warning",
    param: "tuckDepth",
    require: "(tuckDepth ?? tuckDepthFor(length)) <= side * 1.5",
    message: t("ลิ้นเสียบลึกกว่าฝามาก อาจปิดไม่สนิท", "The tuck is much deeper than the lid; it may not close flat"),
  },
];

/**
 * A tuck end: a lid on one panel (`lid`: front | back), a tuck on its far edge, dust flaps on the
 * sides. A straight tuck has both lids on the same panel, a reverse tuck on opposite panels — the
 * pair is the recipe's choice, not a separate generator. The thumb notch is the `thumbNotch`
 * feature on the same end.
 */
export const tuck: ClosureModule = {
  id: "tuck",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ฝาเสียบ (ลิ้นเสียบ + ปีกกันฝุ่น)", "Tuck end (lid, tuck flap, dust flaps)"),
  params: ["tuckDepth", "tuckCorners", "dustFlapDepth"],
  constraints: TUCK_CONSTRAINTS,
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["lid", "tuck", "dust_flap"], roles: ["cut", "crease"] },
  tube(ctx, cfg, end, parts) {
    const { v, m } = ctx;
    const L = num(v, "length", 70);
    const W = num(v, "width", 40);
    const tuckDepth = num(v, "tuckDepth", tuckDepthFor(L));
    const notch = parts.features.some((f) => f.def.id === "thumbNotch" && f.cfg.end === end);
    const closure = tuckClosure({
      lidPanel: PANEL_INDEX[(cfg.lid as string) ?? "back"],
      lidDepth: ctx.dims.side,
      tuckDepth,
      tuckRadius: str(v, "tuckCorners", "rounded") === "rounded" ? Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2) : 0,
      dustPanels: [1, 3],
      dustReach: num(v, "dustFlapDepth", Math.min(L * DUST_FLAP_LENGTH_SHARE, W * DUST_FLAP_WIDTH_SHARE)),
      caliper: m.caliperMm,
      thumbNotch: notch && bool(v, "thumbNotch", false) ? THUMB_NOTCH_RADIUS_MM : 0,
    });
    return end === "top" ? withLidWindow(ctx, closure, "lid-top") : closure;
  },
};

/**
 * A window in the top lid (`windowPanel` = `lid`, the master file's `top_window`): the hole is cut
 * in the lid face the closure drew, in its local frame.
 */
export function withLidWindow(ctx: BuildContext, closure: Closure, lidId: string): Closure {
  if (str(ctx.v, "windowPanel", "front") !== "lid" || str(ctx.v, "window", "none") === "none") return closure;
  return (c) => {
    const out = closure(c);
    const lid = [...out.attachments.map((a) => a.face), ...(out.faces ?? [])].find((f) => f.id === lidId);
    if (lid) {
      const xs = lid.outline.flatMap((e) => [e.from[0], e.to[0]]);
      const ys = lid.outline.flatMap((e) => [e.from[1], e.to[1]]);
      lid.holes = [
        ...lid.holes,
        ...windowHole(ctx.v, "lid", Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)),
      ];
    }
    return out;
  };
}

/**
 * A flap on every panel, separated by slots — the closure of the slotted-container family and of
 * seal ends. `depths` are expressions per panel; `slot` the gap between flaps (`slotWidth()`:
 * two calipers on corrugated, a slit on paperboard). The named presets are the industry's flap
 * sets; `stages` orders the flaps when they lie over one another (`{ panel: stage }`).
 */
/** The default settings of each flap set, for rules that read them (`rules/module-rules.ts`). */
export const FLAP_DEFAULTS: Record<string, ModuleConfig> = {};

export function flapSet(
  id: string,
  label: ReturnType<typeof t>,
  defaults: ModuleConfig,
  processes: ClosureModule["processes"],
  constraints: Constraint[] = [],
): ClosureModule {
  FLAP_DEFAULTS[id] = defaults;
  return {
    id,
    slot: "closure",
    status: "implemented",
    fits: ["tube"],
    label,
    params: [],
    constraints,
    processes,
    contributes: { kinds: ["flap", "dust_flap", "lid"], roles: ["cut", "crease", "glue_area"] },
    tube(ctx, raw, end) {
      const cfg = { ...defaults, ...raw };
      return slottedFlaps({
        depths: (cfg.depths as string[]).map((e) => ctx.num(e)),
        slot: ctx.num(cfg.slot as string),
        ...(cfg.labels ? { labels: cfg.labels as FaceLabel[] | FaceLabel } : {}),
        ...(cfg.kinds ? { kinds: cfg.kinds as FaceKind[] } : {}),
        ...(cfg.glue ? { glue: cfg.glue as number[] } : {}),
        // A top window in the outer flap that covers the end (a seal end's `windowFlap`).
        ...(typeof cfg.windowFlap === "number" && end === "top"
          ? {
              holes: (i: number, x0: number, x1: number, d: number) =>
                i === cfg.windowFlap ? windowHole(ctx.v, "lid", x0, x1, -d, 0) : [],
            }
          : {}),
      });
    },
    hinges(_ctx, raw, end) {
      const stages = ({ ...defaults, ...raw }.stages ?? null) as Record<string, number> | null;
      return stages
        ? { stages: Object.fromEntries(Object.entries(stages).map(([p, s]) => [`flap-${p}-${end}`, s])) }
        : {};
    },
  };
}

export const MEET = "side / 2 + a.flap";

/** Legacy `l_must_more_than_w` (on by default) for the slotted family, as a warning. */
export const SLOTTED: Constraint[] = [
  {
    id: "slotted.width_vs_length",
    code: "size.width_exceeds_length",
    severity: "warning",
    param: "width",
    require: "width <= length",
    message: t("ความกว้างมากกว่าความยาว ลองสลับค่ากัน", "Width is greater than length — try swapping them"),
  },
];

/** Regular slotted container flaps: all half the width (legacy `Flap = W/2 + col_c`), outer flaps meet. */
export const rsc = flapSet(
  "rsc",
  t("ฝาชน (RSC)", "Regular slotted flaps (RSC)"),
  { depths: [MEET, MEET, MEET, MEET], slot: "slotWidth()" },
  ["slotter", "folder_gluer_straight"],
  SLOTTED,
);

/** Full-overlap flaps: outer and inner flaps as deep as the width. */
export const fol = flapSet(
  "fol",
  t("ฝาซ้อนเต็ม (FOL)", "Full overlap flaps (FOL)"),
  { depths: ["side", "side", "side", "side"], slot: "slotWidth()" },
  ["slotter", "folder_gluer_straight"],
  SLOTTED,
);

/** Centre special flaps: the inner (minor) flaps also reach the centre. */
export const cssc = flapSet(
  "cssc",
  t("ฝาชนกลางทุกด้าน (CSSC)", "Centre special flaps (CSSC)"),
  { depths: [MEET, "front / 2 + a.flap", MEET, "front / 2 + a.flap"], slot: "slotWidth()" },
  ["slotter", "folder_gluer_straight"],
  SLOTTED,
);

/** End flaps meeting at the centre of an end, each half its neighbour panel (wrap-around blanks). */
export const endFlaps = flapSet(
  "endFlaps",
  t("ปีกปิดหัวท้าย (แผ่นห่อ)", "End flaps (wrap-around)"),
  {
    depths: ["top / 2 + a.flap", "wall / 2 + a.flap", "top / 2 + a.flap", "wall / 2 + a.flap"],
    slot: "slotWidth()",
    labels: ["end_flap", "end_flap", "end_flap", "end_flap"],
  },
  ["slotter", "folder_gluer_straight"],
);

const DUST = "min(length * C.DUST_FLAP_LENGTH_SHARE, width * C.DUST_FLAP_WIDTH_SHARE)";

/**
 * Seal end: glued flaps. The back panel's outer flap covers the whole end (W), the front panel's
 * inner flap 60 % of it, the side dust flaps reach in under both; glue on the outer.
 */
export const seal = flapSet(
  "seal",
  t("ปิดทากาว (Seal end)", "Seal end (glued flaps)"),
  {
    depths: ["side * 0.6", DUST, "side", DUST],
    slot: "0",
    labels: ["inner_flap", "dust_flap", "outer_flap", "dust_flap"],
    kinds: ["flap", "dust_flap", "lid", "dust_flap"],
    glue: [2],
    stages: { front: 2, back: 3 },
    windowFlap: 2,
  },
  ["die_cut", "folder_gluer_straight"],
);

/**
 * A snap-lock ("1-2-3") bottom: the front and back flaps meet at the centre, the front one's
 * tongue passing into a notch in the back one; the side flaps fold in underneath. `tongue` and
 * `clearance` are expressions (legacy PatternArea pid 16 `b`: 3 / 5 / 10 mm by width).
 * ⚠ Simplified locking geometry — prepress to confirm against a die sample.
 */
export const snapLock123: ClosureModule = {
  id: "snapLock123",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ก้นล็อก 1-2-3", "Snap-lock (1-2-3) bottom"),
  params: ["lockTongue"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["lock", "dust_flap"], roles: ["cut", "crease"] },
  presets: { default: { tongue: "lockTongue ?? snapLockTongueFor(width)", clearance: "max(0.5, t)" } },
  tube: (ctx, cfg) =>
    snapLockClosure({ tongue: ctx.num(cfg.tongue as string), clearance: ctx.num(cfg.clearance as string) }),
};

/**
 * A crash-lock (auto) bottom: side flaps with a 45° crease and a glue area the factory glues to
 * the front and back flaps, so the bottom snaps square as the tube opens.
 * ⚠ Simplified hook geometry — prepress to confirm against a die sample.
 */
export const crashLock: ClosureModule = {
  id: "crashLock",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ก้นล็อกอัตโนมัติ (crash-lock)", "Crash-lock (auto) bottom"),
  params: [],
  processes: ["die_cut", "folder_gluer_crash_lock"],
  constraints: [
    {
      id: "crashLock.depth",
      code: "mfg.crash_lock_too_shallow",
      severity: "error",
      param: "width",
      require: "side / 2 >= rule.crashLockMinDepth",
      message: t("กล่องแคบเกินกว่าจะทำก้นล็อกอัตโนมัติ", "Too narrow for a crash-lock bottom in this material"),
      stage: "manufacturing",
    },
  ],
  contributes: { kinds: ["lock", "flap"], roles: ["cut", "crease", "glue_area"] },
  tube: () => crashLockClosure(),
};

/**
 * A gable top: 45° roof panels on the front and back rising to a ridge, gable triangles on the
 * sides, and a handle panel on each roof panel with a hand hole (90 × 24 mm).
 */
export const gableHandle: ClosureModule = {
  id: "gableHandle",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("หลังคาจั่วพร้อมหูหิ้ว", "Gable top with carry handle"),
  params: ["handleHeight"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["lid", "handle"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "gableHandle.width",
      code: "handle.too_narrow",
      severity: "error",
      param: "length",
      require: "front >= 60",
      message: t(
        "กล่องแคบเกินกว่าจะทำหูหิ้ว (ต้องยาวอย่างน้อย 60 มม.)",
        "Too narrow for a handle (at least 60 mm long)",
      ),
    },
  ],
  tube(ctx) {
    const side = ctx.dims.side;
    return gableClosure({
      apex: side / 2,
      roof: (side / 2) * Math.SQRT2,
      handle: num(ctx.v, "handleHeight", 40),
      hole: { width: 90, height: 24 },
    });
  },
  hinges: (_ctx, _cfg, end) => ({
    angles: {
      [`roof-front-${end}`]: 45,
      [`roof-back-${end}`]: 45,
      [`handle-front-${end}`]: -45,
      [`handle-back-${end}`]: -45,
    },
  }),
};

/**
 * A regular-polygon lid with a tuck on its far edge, hinged on the first panel of an n-sided tube
 * (the hexagonal box): `panel` is the body's compensated side.
 */
/**
 * The vertices of a regular `n`-gon built upwards (negative y) on the edge x0 → x1 at y = 0, after
 * that edge: walking on from (x1, 0), turning by the exterior angle at each vertex.
 */
export function regularPolygonRest(n: number, x0: number, x1: number): Pt[] {
  const a = x1 - x0;
  const out: Pt[] = [];
  let p: Pt = [x1, 0];
  for (let k = 1; k <= n - 2; k++) {
    const angle = (-2 * Math.PI * k) / n;
    p = [p[0] + a * Math.cos(angle), p[1] + a * Math.sin(angle)];
    out.push(p);
  }
  return out;
}

export const polygonTuckLid: ClosureModule = {
  id: "polygonTuckLid",
  slot: "closure",
  status: "implemented",
  fits: ["tube"],
  label: t("ฝาเหลี่ยมพร้อมลิ้นเสียบ", "Polygon lid with tuck"),
  params: ["tuckDepth", "tuckCorners"],
  processes: ["die_cut", "folder_gluer_straight"],
  contributes: { kinds: ["lid", "tuck"], roles: ["cut", "crease"] },
  constraints: [
    {
      id: "polygonTuckLid.min_depth",
      code: "mfg.tuck_too_shallow",
      severity: "error",
      param: "tuckDepth",
      require: "(tuckDepth ?? tuckDepthFor(2 * panel)) >= rule.minTuck",
      message: t("ลิ้นเสียบตื้นเกินไปสำหรับวัสดุนี้", "The tuck is too shallow to hold in this material"),
      stage: "manufacturing",
    },
  ],
  tube(ctx, cfg, end) {
    const a = ctx.dims.panel;
    const n = (cfg.sides as number | undefined) ?? 6;
    const h = (a * Math.sqrt(3)) / 2;
    const tuckDepth = num(ctx.v, "tuckDepth", tuckDepthFor(n === 3 ? a : 2 * a));
    const radius =
      str(ctx.v, "tuckCorners", "rounded") === "rounded" ? Math.min(TUCK_CORNER_RADIUS_MM, tuckDepth / 2) : 0;
    // `panel`: the panel the lid hinges on, per end (a reverse tuck puts the bottom lid opposite).
    const at = cfg.panel as Record<string, number> | number | undefined;
    const panel = typeof at === "number" ? at : (at?.[end] ?? 0);
    const closure = polygonLid({
      panel,
      points: (s) =>
        n === 6
          ? [
              [s.x1 + a / 2, -h],
              [s.x1, -2 * h],
              [s.x0, -2 * h],
              [s.x0 - a / 2, -h],
            ]
          : regularPolygonRest(n, s.x0, s.x1),
      // The edge opposite the hinge on an even polygon; on a triangle the edge back to the hinge's left end.
      tuckEdge: n % 2 === 0 ? n / 2 - 2 : n - 3,
      tuckDepth,
      tuckRadius: radius,
    });
    return end === "top" ? withLidWindow(ctx, closure, "lid-top") : closure;
  },
};
