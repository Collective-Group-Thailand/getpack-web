/*
 * Colour on screen versus on board. Screens show RGB colours a four-colour press cannot reach —
 * saturated blues, greens, violets and oranges print duller. This is a deliberately simple
 * approximation (no ICC profile in the browser): a colour that is both very saturated and very
 * bright, in the hues process inks struggle with, gets a warning. The proof is the authority.
 */

function hsv(hex: string): { h: number; s: number; v: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** Whether a colour is likely to print noticeably duller than it looks on screen. */
export function outOfPrintGamut(hex: string): boolean {
  const c = hsv(hex);
  if (!c) return false;
  if (c.s < 0.8 || c.v < 0.75) return false;
  // Pure yellows, reds and magentas are close to process inks; greens, cyans-blues, violets and
  // vivid oranges are the usual offenders.
  const inkFriendly = (c.h >= 45 && c.h <= 65) || c.h <= 8 || (c.h >= 300 && c.h <= 335);
  return !inkFriendly;
}
