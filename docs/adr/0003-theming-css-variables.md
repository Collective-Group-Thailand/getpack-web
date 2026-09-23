# ADR-0003 — Theming through generated CSS variables (light / dark / high-contrast), cookie-persisted

**Status:** Accepted (2026-09-21)

## Context
design-system.md §2 requires primitive → semantic → component token tiers, OKLCH with CI contrast validation, light + dark themes (system preference + user toggle stored in a cookie) and a high-contrast option for the partner PWA.

## Decision
- Tokens are TypeScript (`src/ui/tokens`). `scripts/build-tokens.ts` emits `src/ui/generated/tokens.css`: a Tailwind v4 `@theme` block (primitives, radius, shadows, motion, type scale, and semantic *aliases* `--color-<name>: var(--sem-<name>)`) plus three `--sem-*` blocks for `:root`, `[data-theme='dark']`, `[data-theme='hc']`, and a `prefers-color-scheme: dark` fallback when no explicit theme is set.
- Utilities such as `bg-primary`, `text-muted`, `border-border` therefore switch theme at runtime without rebuilding CSS.
- `ThemeProvider` reads/writes the `pk_theme` cookie (host-only, per zone) so the server can stamp `data-theme` on `<html>` and avoid a flash; admin zone defaults to light, customer zone to system, partner zone offers `hc`.
- `scripts/check-contrast.ts` converts OKLCH → sRGB (gamut-mapping by chroma reduction, as a browser does) and asserts WCAG 2.2 AA ratios for every declared semantic pair in all three themes — 32 pairs at the end of F0.2; it runs in `pnpm test`, and a semantic colour no pair mentions fails it too.

## Consequences
- Adding a semantic colour = add it to `SemanticTheme` (all three themes must define it), declare its pairs in `scripts/check-contrast.ts`, rebuild, and the gate decides.
- The tier is spelled `fg` / `muted` in code, not `text` / `text-muted` as written above: `--color-text-muted` would generate the utility `text-text-muted`, and design-system.md §2 names `text-muted`.
- `opacity-*` must not be used to de-emphasise text. It compounds onto the subtree and cannot be undone by a child, so it defeats this gate silently (see docs/PROGRESS.md, F0.2).
- Brand changes are environment variables at build time (see `docs/ui/brand.md`), never edits in app code.
