/**
 * The hero panel's box, drawn isometrically from its size (Phase 4, the "Main" board): three faces
 * in the material's tint, a seam that tells the shapes apart, and the print — a logo block on the
 * front face, or every face in the brand green with a paper logo. Pure geometry for an SVG with a
 * `-175 -150 350 300` viewBox; nothing here is a price.
 */

export type IsoShape = "mailer" | "lid" | "tuck";
export type IsoPrint = "none" | "one" | "full";
type Rgb = readonly [number, number, number];

/** Material tints (decoration, not tokens: an SVG face shaded from one base colour). */
export const MATERIAL_TINT = {
  kraft350: [205, 170, 118],
  art350: [244, 240, 232],
  corrE: [196, 160, 112],
} as const satisfies Record<string, Rgb>;

const GREEN: Rgb = [15, 95, 78];
const PAPER = "#f6f3ee";
const BRAND = "#0f5f4e";

export interface IsoFace {
  d: string;
  fill: string;
}

export interface IsoBox {
  /** The side faces the viewer sees, back to front, then the top. */
  faces: IsoFace[];
  /** Outlines of every drawn face, for the hairline over them. */
  outlines: string[];
  seam: string;
  logo: { block: string; lines: string; fill: string } | null;
  shadow: { cx: number; cy: number; rx: number; ry: number };
}

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
/** The viewer looks from +x, +y (the isometric camera): a face is seen when its normal leans that way. */
const VIEW: readonly [number, number] = [Math.SQRT1_2, Math.SQRT1_2];
/** Light from the viewer's upper left: how much each side face is darkened, by its normal. */
const LIGHT: readonly [number, number] = [-0.2, 1];

/** Lighter (`f` > 0) or darker (`f` < 0) shade of a base colour. */
function shade(base: Rgb, f: number): string {
  const channel = (v: number) => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f));
  return `rgb(${base.map(channel).join(",")})`;
}

/**
 * The box for a size in any unit (only the proportions matter), centred on the origin of a
 * `-175 -150 350 300` viewBox and turned `yaw` degrees about its vertical axis (the panel lets the
 * customer drag it round). At 0° it is the board's isometric box: the front (logo) face lower left.
 */
export function isoBox(
  size: { w: number; d: number; h: number },
  shape: IsoShape,
  tint: Rgb,
  print: IsoPrint,
  yaw = 0,
): IsoBox {
  // Fitted at 0°, and never wider than the viewBox at any angle (the plan's diagonal turns through it).
  const k = Math.min(
    300 / ((size.w + size.d) * COS),
    250 / (size.h + (size.w + size.d) * SIN),
    340 / (Math.sqrt(2 * (size.w ** 2 + size.d ** 2)) * COS),
  );
  const [W, D, H] = [size.w * k, size.d * k, size.h * k];
  const a = (yaw * Math.PI) / 180;
  const [ca, sa] = [Math.cos(a), Math.sin(a)];
  const turn = (x: number, y: number): [number, number] => [x * ca - y * sa, x * sa + y * ca];
  const oy = H / 2;
  /** A point of the box, x and y from its centre, z up from its base. */
  const at = (x: number, y: number, z: number): [string, string] => {
    const [rx, ry] = turn(x, y);
    return [((rx - ry) * COS).toFixed(1), ((rx + ry) * SIN - z + oy).toFixed(1)];
  };
  const path = (points: [string, string][]) => `M${points.map((p) => p.join(" ")).join(" L")} Z`;
  const line = (p: [string, string], q: [string, string]) => `M${p.join(" ")} L${q.join(" ")}`;
  const [hw, hd] = [W / 2, D / 2];

  const base = print === "full" ? GREEN : tint;

  // The four sides: corners along the base (start → end, anticlockwise from above) and the normal.
  const sides = [
    { id: "front", from: [-hw, hd], to: [hw, hd], normal: [0, 1] },
    { id: "right", from: [hw, hd], to: [hw, -hd], normal: [1, 0] },
    { id: "back", from: [hw, -hd], to: [-hw, -hd], normal: [0, -1] },
    { id: "left", from: [-hw, -hd], to: [-hw, hd], normal: [-1, 0] },
  ] as const;
  const visible = sides
    .map((side) => {
      const n = turn(side.normal[0], side.normal[1]);
      return { ...side, n, facing: n[0] * VIEW[0] + n[1] * VIEW[1] };
    })
    .filter((side) => side.facing > 1e-6)
    .sort((p, q) => p.facing - q.facing);
  const faceOf = (side: (typeof visible)[number]) =>
    path([
      at(side.from[0], side.from[1], H),
      at(side.to[0], side.to[1], H),
      at(side.to[0], side.to[1], 0),
      at(side.from[0], side.from[1], 0),
    ]);
  const lit = (n: [number, number]) => -0.14 - 0.12 * (1 - (n[0] * LIGHT[0] + n[1] * LIGHT[1]) / Math.hypot(...LIGHT));
  const top = path([at(-hw, -hd, H), at(hw, -hd, H), at(hw, hd, H), at(-hw, hd, H)]);
  const faces: IsoFace[] = [
    ...visible.map((side) => ({ d: faceOf(side), fill: shade(base, lit(side.n)) })),
    { d: top, fill: shade(base, 0.18) },
  ];

  let seam: string;
  if (shape === "mailer") seam = line(at(-hw, 0, H), at(hw, 0, H));
  else if (shape === "lid") {
    // The lid's rim, a little over a third down every side the viewer sees.
    const rim = H * 0.62;
    seam = visible.map((side) => line(at(side.from[0], side.from[1], rim), at(side.to[0], side.to[1], rim))).join(" ");
  } else seam = line(at(-hw, D * 0.32, H), at(hw, D * 0.32, H));

  let logo: IsoBox["logo"] = null;
  if (print !== "none" && visible.some((side) => side.id === "front")) {
    // A wordmark-like block and two lines, centred on the front face (only while it faces the viewer).
    const lh = Math.min(W * 0.22, H * 0.62);
    const lw = lh / 0.42;
    const u0 = (W - lw) / 2;
    const v0 = (H - lh) / 2;
    const front = (u: number, v: number) => at(-hw + u, hd, H - v);
    logo = {
      block: path([
        front(u0, v0),
        front(u0 + lw * 0.62, v0),
        front(u0 + lw * 0.62, v0 + lh * 0.46),
        front(u0, v0 + lh * 0.46),
      ]),
      lines: `${line(front(u0, v0 + lh * 0.66), front(u0 + lw, v0 + lh * 0.66))} ${line(
        front(u0, v0 + lh * 0.86),
        front(u0 + lw * 0.7, v0 + lh * 0.86),
      )}`,
      fill: print === "full" ? PAPER : BRAND,
    };
  }

  const reach = Math.hypot(W, D) / 2;
  return {
    faces,
    outlines: faces.map((face) => face.d),
    seam,
    logo,
    shadow: {
      cx: 0,
      cy: Number((oy + 8).toFixed(1)),
      rx: Number((reach * 2 * COS * 0.55).toFixed(1)),
      ry: Number((reach * 2 * SIN * 0.4).toFixed(1)),
    },
  };
}

/**
 * C7 (the Studio front door's mini editor): an SVG `matrix(…)` that maps a face's own millimetres onto the drawn box
 * at 0° — `top`: x along the length from the back-left corner, y toward the front; `front`: x along the length, y
 * down from the top edge — so a brand name or a logo is set "on" the face. Same projection as {@link isoBox}.
 */
export function isoFaceMatrix(size: { w: number; d: number; h: number }, face: "top" | "front"): string {
  const k = Math.min(
    300 / ((size.w + size.d) * COS),
    250 / (size.h + (size.w + size.d) * SIN),
    340 / (Math.sqrt(2 * (size.w ** 2 + size.d ** 2)) * COS),
  );
  const [hw, hd, H] = [(size.w * k) / 2, (size.d * k) / 2, size.h * k];
  const oy = H / 2;
  const at = (x: number, y: number, z: number): [number, number] => [(x - y) * COS, (x + y) * SIN - z + oy];
  const [o, u, v] =
    face === "top"
      ? [at(-hw, -hd, H), at(hw, -hd, H), at(-hw, hd, H)]
      : [at(-hw, hd, H), at(hw, hd, H), at(-hw, hd, 0)];
  const [spanU, spanV] = face === "top" ? [size.w, size.d] : [size.w, size.h];
  const m = [(u[0] - o[0]) / spanU, (u[1] - o[1]) / spanU, (v[0] - o[0]) / spanV, (v[1] - o[1]) / spanV, o[0], o[1]];
  return `matrix(${m.map((n) => n.toFixed(4)).join(" ")})`;
}
