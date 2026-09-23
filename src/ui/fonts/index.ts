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
 * belong at the end of `--font-sans` / `--font-display` / `--font-mono` instead. The
 * metric-adjusted local fallback Next generates for CLS stays: Arial carries no Thai.
 *
 * Total 149 KB for all five files, against the 180 KB in ADR-0001.
 *
 * Fonts for *artwork* inside the designer are a separate catalogue (`FONT_FAMILIES`) and are
 * F4 Part C's problem, including outlining or embedding them in print PDFs.
 */

/** UI — Noto Sans Thai variable. Tone marks stack correctly at 14–16 px. */
const sansLatin = localFont({
  src: "./files/noto-sans-thai-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-pk-sans-latin",
  // The UI face is on every page in both scripts: preload both halves.
  preload: true,
});

const sansThai = localFont({
  src: "./files/noto-sans-thai-thai.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-pk-sans-thai",
  preload: true,
});

/** Display — Anuphan variable, for h1–h4. Thai-native geometric, legible at 48 px. */
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
 * Mono — JetBrains Mono variable, for order codes, job numbers and tax ids. Latin only:
 * a code is never Thai script, and preloading 40 KB for the pages that show none would
 * cost the marketing LCP budget.
 */
const mono = localFont({
  src: "./files/jetbrains-mono-latin.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
  variable: "--font-pk-mono",
  preload: false,
});

/**
 * Applied to `<html>` by each zone's root layout. The class only carries the CSS variables;
 * what actually selects a family is `--font-sans` / `--font-display` / `--font-mono` in
 * the generated tokens.
 */
export const fontClassNames = [sansLatin, sansThai, displayLatin, displayThai, mono]
  .map((font) => font.variable)
  .join(" ");
