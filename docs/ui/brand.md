# Brand configuration — getpack

> Referenced by ADR-0003 and `docs/prompts/design-system.md` §2. Brand values are
> **configuration**, not copy scattered through the app.

## Identity

| Value | Where it lives |
|---|---|
| Name — **getpack** | `BRAND_NAME`, `src/ui/brand/config.ts` |
| Tagline (en) — *Your Packaging Production Partner* | `BRAND_TAGLINE` |
| Tagline (th) — *พาร์ตเนอร์งานผลิตบรรจุภัณฑ์ของคุณ* | `common.brand.tagline` in `src/i18n` |
| Operator — Collective Group (Thailand) | `BRAND_COMPANY` |

"Locopack" always means the legacy system (D-001) and never appears in the product.

## Colour — the D-180 art direction, until the brand kit arrives

The palette is the **getpack art direction** (D-180, values Proposed), taken verbatim from
`docs/prompts/design-system.md` §Art direction: warm paper and kraft neutrals, warm ink text,
one deep teal-green for actions and links, and amber for promotions only. When a real brand kit
arrives, it replaces these **values only**. Screens name semantic tokens (`primary`, `accent`,
`bg-subtle`, `kraft`…), never a palette, so no component changes.

Where the values live, in `src/ui/tokens/primitives.ts`:

| What | Constant | Authored as |
|---|---|---|
| The named art-direction colours per theme (paper, kraft, ink, primary, accent, border) | `ART.light`, `ART.dark` | hex, exactly as the spec writes them (`hexToOklch`) |
| Light-theme status colours | `STATUS` | hex |
| Ramps for the slots the spec does not name (placeholders, outlines, badge tints, dark and high-contrast steps) | `PALETTES` | OKLCH `palette(hue, peakChroma)`, each on the hue of its art colour |
| Print marks (cut, fold, safe zone, bleed) | `PRINT` | literal OKLCH — **never** follows a rebrand |

To apply a brand kit:

1. Paste its hex values into `ART` / `STATUS`, and move each `PALETTES` hue to match (OKLCH hue
   in degrees — `hexToOklch("#…").h` gives it).
2. `pnpm tokens && pnpm contrast` — the table shows every pair in light, dark and high contrast.
3. `pnpm test`.

The contrast gate then decides. It is not advisory: a value that fails AA fails the build. The
fix is the smallest change to the value, recorded in `docs/PROGRESS.md`. This is what happened
to the art direction's own dark `primary-700`, and it is why dark hover goes lighter (see
`semantic.ts`). A brand colour that fails WCAG AA in the primary button is a problem to solve at
token level, once, rather than per screen.

Usage rules (D-180, linted where a rule can see them):

- **Teal (`primary`) is for actions only**: buttons, links, active navigation, focus, selected
  states. It is not decoration and not a status.
- **Amber (`accent`) is for promotions only**: campaign badges and "ราคาพิเศษ", from a real
  campaign (D-181). A warning is `warning`, a different burnt-orange hue.
- **Kraft (`kraft`, `kraft-strong`) is never text**: surfaces, illustration fills, dieline art.
  ESLint rejects `text-kraft*`, and `accent` / `kraft` utilities outside `src/ui`.

## Logo

The logo is the **getpack.** wordmark, supplied by the product owner on 2026-10-21 (it replaces the green-oval
logo of 2026-10-16): letters `#262626`, a dark-green "g" `#0B3F2F` with a bright-green L-shaped notch `#12AB21` on
its top right, and a green full stop `#008F2C`, on white. The vector data is `src/ui/brand/logo-paths.ts`, traced
from the supplied 348 × 204 px image (the notch and the full stop redrawn as exact shapes); box 302 × 71, about
4.25 : 1.

`src/ui/brand/Brand.tsx`: `BrandLogo` draws it inline (`role="img"`, label `BRAND_NAME`, height in px) and `Brand`
is the logo as the link home. Inline so it follows the theme: on the dark theme the letters and the g turn to the
page foreground (`.brand-logo` in `src/ui/styles/base.css`); the two greens never change. `tone="mono"` is the
one-colour logo (every part in the surrounding text colour) for coloured surfaces — the sign-in panel and the
designer bars, where the greens would sink into the background. Sizes in use:
storefront header 28 (24 on a phone), admin and partner bars 24, footer 30, sign-in panel 32, designer bars 22,
not-found pages 32. `public/brand/getpack-logo.svg` and `.png` (1021 × 240, transparent) are the same logo as files
for anything outside the app; the proxy serves both on every host (`ROOT_ASSETS`). The share card
(`og-image.tsx`) draws it from the same paths.

The favicon / app icon (`src/app/icon.svg`) is the mark alone: the white "g" with its green notch on a dark-green
`#0B3F2F` tile. Still to come from the brand kit: the master vector file (replace the traced paths), the favicon
set and the print/PDF variants.

## Typography

ADR-0001: Anuphan (UI and display — one face since the 2026-10-06 UX audit; Noto Sans Thai is no longer loaded), JetBrains Mono (codes) — all SIL OFL,
self-hosted from `src/ui/fonts`. If the brand kit specifies licensed faces, the licence must
cover web embedding *and* PDF embedding, because the print PDF carries them (F4 Part C).

## Voice

See [`voice-and-tone.md`](./voice-and-tone.md).
