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
 * Anuphan (both halves) and JetBrains Mono — well under the 180 KB in ADR-0001; Noto Sans Thai
 * was dropped when Anuphan became the body face too.
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
 * Trirong — the display serif of design language v2 "Warm Editorial" (round 2, Phase 2):
 * storefront h1 and large h2, the back office's and the factory app's page titles, large prices,
 * and the italic accent word (`<em>`) in a heading. Medium, semibold and medium italic only, Thai
 * and Latin split like Anuphan; OFL (`OFL-trirong.txt`), self-hosted (ADR-0001). Not preloaded:
 * a heading in the fallback for one frame costs less than ~25 KB on every first paint.
 *
 * The semibold file answers every weight from 600 up: a heading classed `font-bold` (700) would
 * otherwise get a browser-synthesised bold — smeared strokes, worst on Thai — not Trirong's own.
 */
const serifLatin = localFont({
  src: [
    { path: "./files/trirong-latin-500.woff2", weight: "500", style: "normal" },
    { path: "./files/trirong-latin-600.woff2", weight: "600 900", style: "normal" },
    { path: "./files/trirong-latin-500-italic.woff2", weight: "500", style: "italic" },
  ],
  display: "swap",
  variable: "--font-pk-serif-latin",
  preload: false,
});

const serifThai = localFont({
  src: [
    { path: "./files/trirong-thai-500.woff2", weight: "500", style: "normal" },
    { path: "./files/trirong-thai-600.woff2", weight: "600 900", style: "normal" },
    { path: "./files/trirong-thai-500-italic.woff2", weight: "500", style: "italic" },
  ],
  display: "swap",
  variable: "--font-pk-serif-thai",
  preload: false,
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
export const fontClassNames = [displayLatin, displayThai, serifLatin, serifThai, mono]
  .map((font) => font.variable)
  .join(" ");
