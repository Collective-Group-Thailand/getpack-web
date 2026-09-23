# Brand configuration — Packio

> Referenced by ADR-0003 and `docs/prompts/design-system.md` §2. Brand values are
> **configuration**, not copy scattered through the app.

## Identity

| Value | Where it lives |
|---|---|
| Name — **Packio** | `BRAND_NAME`, `src/ui/brand/config.ts` |
| Tagline (en) — *Your Packaging Production Partner* | `BRAND_TAGLINE` |
| Tagline (th) — *พาร์ตเนอร์งานผลิตบรรจุภัณฑ์ของคุณ* | `common.brand.tagline` in `src/i18n` |
| Operator — Collective Group (Thailand) | `BRAND_COMPANY` |

"Locopack" always means the legacy system (D-001) and never appears in the product.

## Colour — placeholder until the brand kit arrives

The `brand` palette in `src/ui/tokens/primitives.ts` is a **placeholder**: the teal hue
BoxStudio shipped, kept so the rebrand was not also a visual redesign. Nothing in the product
references it directly — screens name semantic tokens (`primary`, `primary-fg`,
`primary-subtle`), so replacing the hue is one edit.

To apply the real brand kit:

1. Change `brand: palette(hue, peakChroma)` in `src/ui/tokens/primitives.ts` (OKLCH hue in
   degrees; chroma is the peak at step 600).
2. If the brand's own steps are non-uniform, replace the generated palette with explicit OKLCH
   values — `Palette` is just `Record<Step, Oklch>`.
3. `pnpm tokens && pnpm test`.

The contrast gate then decides. It is not advisory: if the new hue cannot carry white text at
step 700, `primary` must move to a darker step or `primary-fg` must change, and the build fails
until one of them does. That is deliberate — a brand colour that fails WCAG AA in the primary
button is a problem to solve at token level, once, rather than per screen.

`docs/prompts/design-system.md` §2 speaks of primary *and* secondary hues. Only a primary is
defined so far; a secondary is added as a second palette plus the semantic keys that use it,
with pairs in `scripts/check-contrast.ts`.

## Logo

`src/ui/brand/Brand.tsx` — a "P" whose bowl carries a crease line, drawn for this repo. It
takes its fill from the brand token, so it follows a hue change.

No third-party logo, template or asset appears anywhere in `src/ui` (CLAUDE.md). When the
brand kit supplies real marks, replace `BrandMark` and add the horizontal lockup, the favicon
set and the print/PDF variants beside it.

## Typography

ADR-0001: Noto Sans Thai (UI), Anuphan (display), JetBrains Mono (codes) — all SIL OFL,
self-hosted from `src/ui/fonts`. If the brand kit specifies licensed faces, the licence must
cover web embedding *and* PDF embedding, because the print PDF carries them (F4 Part C).

## Voice

See [`voice-and-tone.md`](./voice-and-tone.md).
