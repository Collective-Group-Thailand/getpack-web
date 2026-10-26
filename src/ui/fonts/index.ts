import localFont from "next/font/local";

/**
 * Self-hosted Thai-first typography (ADR-0001). No runtime Google Fonts in any zone.
 *
 * Each family is split by script, and the stacks in `src/ui/tokens/scale.ts` put Latin
 * first: ASCII comes from the metric-matched Latin companion, and Thai codepoints fall
 * through to the Thai file. That ordering is what replaces `unicode-range` — `next/font/local`
 * applies its `declarations` to every `src` entry of a call, so it cannot give two files in
 * one family different ranges, and two @font-face rules for one family with no range would
 * mean the second file never being used at all.
 *
 * None of these declarations names a generic fallback: `next/font/local` would splice it into
 * that family's own variable, ahead of the Thai family in the stack, and `system-ui` on a Thai
 * system *does* have Thai glyphs — so Thai text would never reach Noto Sans Thai. The generics
 * belong at the end of `--font-sans` / `--font-display` instead. The
 * metric-adjusted local fallback Next generates for CLS stays: Arial carries no Thai.
 *
 * Anuphan (both halves) is the only UI face, codes and numbers included — well under the 180 KB
 * in ADR-0001. Noto Sans Thai was dropped when Anuphan became the body face, and JetBrains Mono
 * when codes moved to Anuphan with tabular figures (ADR-0001 amendment, 2026-10-26).
 *
 * Fonts for *artwork* inside the designer are a separate catalogue (`FONT_FAMILIES`) and are
 * F4 Part C's problem, including outlining or embedding them in print PDFs.
 */

/**
 * Anuphan variable — the one UI face, body and headings (UX audit design baseline: one Thai/Latin
 * family so both scripts share an x-height). Thai-native geometric, legible from 13 to 64 px.
 */
const displayLatin = localFont({
  src: "./files/anuphan-latin.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-pk-display-latin",
  preload: true,
});

const displayThai = localFont({
  src: "./files/anuphan-thai.woff2",
  weight: "100 700",
  style: "normal",
  display: "swap",
  variable: "--font-pk-display-thai",
  preload: true,
});

/**
 * Applied to `<html>` by each zone's root layout. The class only carries the CSS variables;
 * what actually selects a family is `--font-sans` / `--font-display` in
 * the generated tokens.
 */
export const fontClassNames = [displayLatin, displayThai].map((font) => font.variable).join(" ");
