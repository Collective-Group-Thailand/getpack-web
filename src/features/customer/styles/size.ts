/**
 * The size search's units (C0): the customer types the outside of their product in centimetres
 * (กว้าง × ยาว × สูง, one decimal); the URL and the API speak millimetres, length × width × height
 * (D-183: every size in the API is mm). A unit change only — the fit rule itself is the API's.
 */

export interface SizeCm {
  w: string;
  l: string;
  h: string;
}

const MM = /^(\d{1,4}(?:\.\d)?)x(\d{1,4}(?:\.\d)?)x(\d{1,4}(?:\.\d)?)$/;

/** cm as typed → the URL's `LxWxH` in whole mm, or null when a dimension is missing or not above 0. */
export function sizeOfCm(cm: SizeCm): string | null {
  const mm = [cm.l, cm.w, cm.h].map((v) => Math.round(Number(String(v).replace(",", ".")) * 10));
  if (mm.some((v) => !Number.isFinite(v) || v <= 0 || v > 9999)) return null;
  return mm.join("x");
}

/** The URL's `LxWxH` mm → centimetres for the inputs and the chip (`120x80x50` → l 12, w 8, h 5). */
export function cmOfSize(size: string | undefined): SizeCm | null {
  const m = size ? MM.exec(size) : null;
  if (!m) return null;
  const cm = (mm: string) => String(Number(mm) / 10);
  return { l: cm(m[1]!), w: cm(m[2]!), h: cm(m[3]!) };
}

/** A size in mm shown in cm ("20.5"), for "ขนาดภายในแนะนำ". */
export const cmOf = (mm: number) => String(Math.round(mm) / 10);
