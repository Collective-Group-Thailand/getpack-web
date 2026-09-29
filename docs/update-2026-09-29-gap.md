# Update 2026-09-29 — gap analysis (packio-web)

> Session 0 of every U-F session (`docs/prompts/U1-update-2026-09-29.md`). One row per requirement → `met | partial | missing`, with evidence and the planned change. `met` rows are not touched. Each session appends its own section.

## U-F2 — Art direction tokens (D-180) — 2026-09-29

Source of truth: `docs/prompts/design-system.md` §Art direction. Evidence is from `main` at `94aa968`.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1.1 | Palette values for light and dark per §Art direction | missing | `src/ui/tokens/primitives.ts:59-71` — cool neutral (h 255) and the BoxStudio teal (h 183); `src/ui/tokens/semantic.ts:73-103` — bg white, fg neutral-900 | Art primitives authored as the spec's hex values; semantic slots remapped (the key set stays, so components are untouched) |
| 1.2 | High-contrast theme follows the new palette | partial | `semantic.ts:140-168` exists, with the old hues | Rebuilt on the warm ink and dark teal ramps; the black/white structure stays |
| 1.3 | Contrast gate: every semantic text/UI pair passes WCAG 2.2 AA in all three themes | partial | `scripts/check-contrast.ts:31-63` + `src/ui/tokens/contrast.test.ts` run in `pnpm test`; no pairs for text on `bg-subtle`, which becomes the paper band, and none for a promotions tone | Pairs added: muted and primary on `bg-subtle`, the accent tone, kraft decorative ranges |
| 1.4 | A failing proposed value is adjusted minimally and recorded | missing | Pre-check of the proposed values: dark `primary-700` `#0D7A66` gives 3.26:1 under the dark button label and 3.49:1 as hovered link text on `bg`. All other proposed pairs pass; the tightest is light primary on paper-100 at 4.52:1 | Dark `primary-hover` moved to the nearest teal that passes both; ratios recorded in PROGRESS |
| 1.5 | Amber only for promotions | missing | No promotions token; `warning` is the amber-400 fill (`semantic.ts:98`) | New `accent` tone (`accent`, `-fg`, `-subtle`, `-subtle-fg`); `warning` becomes the spec's `#B45309` with a white label (5.02:1), so a warning no longer looks like a promotion |
| 1.6 | Kraft tones are decoration only, never text | missing | No kraft tokens | Semantic `kraft` / `kraft-strong`, gated as decorative ranges, not text pairs |
| 2.1 | Anuphan display, Noto Sans Thai UI, JetBrains Mono codes | met | `src/ui/fonts/index.ts:25-76`, `src/ui/tokens/scale.ts:80-84`, `src/ui/styles/base.css:39-48` | — |
| 2.2 | Tabular figures for prices and quantities | met | `PriceSummary.tsx:41,55,143-153`, `DataTable.tsx:246`, `QuoteDock.tsx:68-104`, `ProductCard.tsx:88`, `base.css:55-61` | — |
| 2.3 | Thai line-height ≥ 1.6 | met | `scale.ts:61-66`, `base.css:35` | — |
| 2.4 | h1 `clamp(2rem, 5vw, 3.25rem)` | missing | No token; the storefront hero uses `text-4xl md:text-5xl` (`src/app/[locale]/(storefront)/page.tsx:60`) | `--text-display` token, applied to the storefront hero h1 (U-F3 owns the rest of the hero) |
| 2.5 | Radius 12 px controls, 16 px cards/media, pill CTA on the storefront only | partial | Card is already 16 px (`Card.tsx:5`); Button and Input are 8 px (`Button.tsx:17`, `Input.tsx:11`); Dialog is 24 px; no zone marker on `<html>` | Semantic radii `control` (12), `card` (16), `cta` (= control; pill under `[data-zone="customer"]`); `data-zone` stamped by the three root layouts |
| 2.6 | Two elevation levels only | missing | `scale.ts:25-31` has four; 25 usages in `src` (sm 6, md 2, lg 13, xl 4) | `SHADOW = { none, card, overlay }` with the spec values; sm/md → card, lg/xl → overlay |
| 2.7 | Motion 150–200 ms ease-out for hovers, 250 ms for sheets | partial | `scale.ts:33-43` — 120/200/320 ms; literal `duration-200` / `duration-300` in three places | fast 150, base 200, slow 250, standard easing → ease-out; the literals move to tokens |
| 2.8 | `prefers-reduced-motion` respected | met | `base.css:167-176` | — |
| 2.9 | Carousels never auto-advance faster than 6 s, pause on hover/focus | met (n/a) | No auto-advancing carousel exists (`ImageGallery.tsx` has no timer) | — |
| 2.10 | Optional flat SVG section divider, `aria-hidden` | missing | — | `SectionDivider` in `src/ui` with a story; placing it on pages is U-F3 |
| 3 | Token-usage rules: teal = actions, amber = promotions, kraft never text (lint where feasible) | missing | ESLint has no colour rule; raw primitive palette utilities have 0 uses today | Lint: kraft text utilities banned everywhere; `accent` / `kraft` utilities only inside `src/ui`; raw primitive palette utilities banned outside `src/ui`. "Teal = actions only" cannot be linted and is documented in Storybook |
| 4 | Storybook docs and visual snapshots for all zones; admin keeps its density | partial | `src/ui/docs/Tokens.stories.tsx` shows the old scale; 17 darwin baselines in `e2e/__screenshots__/darwin`, admin/designer only — no customer or partner shots | Tokens docs gain an art-direction section; customer and partner stories join `e2e/visual.spec.ts`; baselines regenerated for review |
| 5 | axe clean on all shells | met (verified after the change) | `e2e/a11y.spec.ts`, `e2e/shells.spec.ts` and every per-screen axe case pass (PROGRESS §U-F2 Verification) | — |

**Side effect found.** `src/features/designer/canvas-colors.ts:25-46` reads `PRINT` and `PALETTES`. Print marks (cut, fold, safe, bleed) reach the print PDF, so they are frozen to their current values and do not move with a UI rebrand. The designer's artwork defaults (`text`, `shapeFill`, `shapeStroke`) are frozen for the same reason. The designer chrome (`selection`, `panelLabel`) follows the new palette.
