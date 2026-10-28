/**
 * The category size finder (category Phase 1 item 5), with the same fit rule as the /styles size search
 * (DECISIONS-STAGE-A §4; getpack-api `style-fit.ts`): the customer measures the outside of the product; the box
 * needs that plus 0.5 cm on every dimension inside; length and width may swap (the product turned on the base),
 * height may not. Of the standard sizes (inside dimensions, mm) that fit, the smallest by volume is recommended.
 * Pure geometry — no money.
 */

/** 0.5 cm per dimension (DECISIONS-STAGE-A §4 — the styles rule; getpack-api `FIT_CLEARANCE_MM`). */
export const FIT_CLEARANCE_MM = 5;
/** Below this share of the box the product fills, the finder suggests a custom size (prompt pack item 5). */
export const LOW_FIT_PERCENT = 45;

export interface StandardSize {
  code: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
}

export interface ProductMm {
  l: number;
  w: number;
  h: number;
}

export interface FitAnswer {
  size: StandardSize;
  /** Product volume ÷ box volume, whole percent. */
  utilisation: number;
  /** The product had to be turned 90° on the base. */
  rotated: boolean;
  /** Suggest a custom size (utilisation below {@link LOW_FIT_PERCENT}). */
  lowFit: boolean;
}

const volume = (size: StandardSize) => size.lengthMm * size.widthMm * size.heightMm;

/** Whether the product fits this size, and how (as measured first, turned second); null when it does not. */
export function fitsIn(size: StandardSize, product: ProductMm): { rotated: boolean } | null {
  const a = product.l + FIT_CLEARANCE_MM;
  const b = product.w + FIT_CLEARANCE_MM;
  const h = product.h + FIT_CLEARANCE_MM;
  if (h > size.heightMm) return null;
  if (a <= size.lengthMm && b <= size.widthMm) return { rotated: false };
  if (b <= size.lengthMm && a <= size.widthMm) return { rotated: true };
  return null;
}

/** The smallest-volume standard size the product fits (ties: the list's order), or null. */
export function bestFit(sizes: readonly StandardSize[], product: ProductMm): FitAnswer | null {
  if (![product.l, product.w, product.h].every((value) => Number.isFinite(value) && value > 0)) return null;
  let best: { size: StandardSize; rotated: boolean } | null = null;
  for (const size of sizes) {
    if (size.heightMm <= 0) continue;
    const fit = fitsIn(size, product);
    if (fit && (!best || volume(size) < volume(best.size))) best = { size, rotated: fit.rotated };
  }
  if (!best) return null;
  const utilisation = Math.round(((product.l * product.w * product.h) / volume(best.size)) * 100);
  return { ...best, utilisation, lowFit: utilisation < LOW_FIT_PERCENT };
}

/** Centimetres typed by the customer ("25", "9.5", "9,5") → millimetres; null when not a positive number. */
export function cmToMm(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 && value < 1000 ? Math.round(value * 10 * 10) / 10 : null;
}
