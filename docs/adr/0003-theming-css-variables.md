# ADR-0003 — Theming through generated CSS variables (light / dark / high-contrast), cookie-persisted

**Status:** Accepted (2026-09-21)

## Context
design-system.md §2 requires primitive → semantic → component token tiers, OKLCH with CI contrast validation, light + dark themes (system preference + user toggle stored in a cookie) and a high-contrast option for the partner PWA.

## Decision
- Tokens are TypeScript (`src/ui/tokens`). `scripts/build-tokens.ts` emits `src/generated/tokens.css`: a Tailwind v4 `@theme` block (primitives, radius, shadows, motion, type scale, and semantic *aliases* `--color-<name>: var(--sem-<name>)`) plus three `--sem-*` blocks for `:root`, `[data-theme='dark']`, `[data-theme='hc']`, and a `prefers-color-scheme: dark` fallback when no explicit theme is set.
- Utilities such as `bg-primary`, `text-muted`, `border-border` therefore switch theme at runtime without rebuilding CSS.
- `ThemeProvider` reads/writes the `pk_theme` cookie (host-only, per zone) so the server can stamp `data-theme` on `<html>` and avoid a flash; admin zone defaults to light, customer zone to system, partner zone offers `hc`.
- `scripts/check-contrast.ts` converts OKLCH → sRGB and asserts WCAG 2.2 AA ratios for 19 semantic pairs in all three themes; it runs in `pnpm test`.

## Consequences
- Adding a semantic colour = add it to `SemanticTheme` (all three themes must define it), rebuild, and the contrast gate decides.
- Brand changes are environment variables at build time (see `docs/ui/brand.md`), never edits in app code.
