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

export interface IsoBox {
  top: string;
  left: string;
  right: string;
  seam: string;
  fills: { top: string; left: string; right: string };
  logo: { block: string; lines: string; fill: string } | null;
  shadow: { cx: number; cy: number; rx: number; ry: number };
}

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);

/** Lighter (`f` > 0) or darker (`f` < 0) shade of a base colour. */
function shade(base: Rgb, f: number): string {
  const channel = (v: number) => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f));
  return `rgb(${base.map(channel).join(",")})`;
}

/**
 * The box for a size in any unit (only the proportions matter), fitted inside 300 × 250 of the
 * viewBox and centred on its origin.
 */
export function isoBox(size: { w: number; d: number; h: number }, shape: IsoShape, tint: Rgb, print: IsoPrint): IsoBox {
  const k = Math.min(300 / ((size.w + size.d) * COS), 250 / (size.h + (size.w + size.d) * SIN));
  const [W, D, H] = [size.w * k, size.d * k, size.h * k];
  const ox = ((D - W) * COS) / 2;
  const oy = (H - (W + D) * SIN) / 2;
  const at = (x: number, y: number, z: number): [string, string] => [
    (x * COS - y * COS + ox).toFixed(1),
    (x * SIN + y * SIN - z + oy).toFixed(1),
  ];
  const path = (points: [string, string][]) => `M${points.map((p) => p.join(" ")).join(" L")} Z`;
  const line = (a: [string, string], b: [string, string]) => `M${a.join(" ")} L${b.join(" ")}`;

  let seam: string;
  if (shape === "mailer") seam = line(at(0, D / 2, H), at(W, D / 2, H));
  else if (shape === "lid") {
    // The lid's rim, a little over a third down the sides.
    const rim = H * 0.62;
    seam = `${line(at(0, D, rim), at(W, D, rim))} L${at(W, 0, rim).join(" ")}`;
  } else seam = line(at(0, D * 0.82, H), at(W, D * 0.82, H));

  const base = print === "full" ? GREEN : tint;
  const centre = at(W / 2, D / 2, 0);

  let logo: IsoBox["logo"] = null;
  if (print !== "none") {
    // A wordmark-like block and two lines, centred on the front face.
    const lh = Math.min(W * 0.22, H * 0.62);
    const lw = lh / 0.42;
    const u0 = (W - lw) / 2;
    const v0 = (H - lh) / 2;
    const front = (u: number, v: number) => at(u, D, H - v);
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

  return {
    top: path([at(0, 0, H), at(W, 0, H), at(W, D, H), at(0, D, H)]),
    left: path([at(0, D, H), at(W, D, H), at(W, D, 0), at(0, D, 0)]),
    right: path([at(W, 0, H), at(W, 0, 0), at(W, D, 0), at(W, D, H)]),
    seam,
    fills: { top: shade(base, 0.18), left: shade(base, -0.14), right: shade(base, -0.26) },
    logo,
    shadow: {
      cx: Number(centre[0]),
      cy: Number(centre[1]) + 8,
      rx: Number(((W + D) * 0.5).toFixed(1)),
      ry: Number(((W + D) * 0.17).toFixed(1)),
    },
  };
}
