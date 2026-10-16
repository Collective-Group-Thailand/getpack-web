# F0 — Set up `getpack-web` from the BoxStudio single app

> เริ่มจาก BoxStudio แบบ single Next.js app (มี `src/lib/dieline.ts`, `src/store/editor.ts`, `package-lock.json`) · ADR-0001…0003 เป็นการตัดสินใจที่ยังไม่ได้ implement
> อ่าน `CLAUDE.md`, `docs/prompts/00-master-plan.md`, `docs/prompts/design-system.md` ก่อน · ทำ 2 session: **0.1** แล้ว `/clear` แล้ว **0.2**

---

Current state of this repo: Next.js 16 single app, npm (`package-lock.json`), Tailwind via PostCSS, routes `/`, `/my/designs`, `/design/[id]`; `src/lib/{types,dieline,geometry,patterns,catalog,export,storage}.ts`, `src/store/editor.ts` (Zustand, undo/redo), `src/components/editor/*` (Konva canvas, toolbar, side panel, setup/print-rules modals), `src/components/Brand.tsx`; designs in localStorage; PNG/PDF/SVG export.

---

## Session 0.1 — Structure, tooling, dieline package, zone-ready routes, rebrand
1. **Safety**: branch `chore/getpack-baseline`, tag `pre-getpack`. Commit or stash any uncommitted work first and report what was uncommitted. Use `git mv` for every move.
2. **Tooling**: switch npm → pnpm (`corepack enable`, `pnpm import` from `package-lock.json`, delete the lock, add `packageManager` field), `.nvmrc` = 24 (Node 22 acceptable locally, note it), `.gitignore` covers `legacy/`, `*.tsbuildinfo`, `.env*.local`, `playwright-report/`, `test-results/`, `storybook-static/`. Remove `tsconfig.tsbuildinfo` from git if tracked. TypeScript strict; ESLint flat config + Prettier.
3. **Tests before moving code**: add Vitest (+ Testing Library) and Playwright; write unit tests for current `dieline.ts` / `geometry.ts` generators (closed cut loops, dimensions equal inputs, `insetConvex` behaviour) and a smoke e2e for today's flow (new design → setup → add text → save → My designs → export SVG). Both must be green **before** step 4 so the move is provably behaviour-preserving.
4. **`packages/dieline` (`@getpack/dieline`)**: create a pnpm workspace (`pnpm-workspace.yaml` → `packages/*`); move framework-free code (`types` used by geometry, `dieline`, `geometry`, pattern tile maths without DOM) into it with its own Vitest suite, `exports` + types, zero React/DOM deps, `publishConfig` for GitHub Packages, Changesets. The app depends on `"@getpack/dieline": "workspace:*"`. Konva/React code stays in the app.
5. **Target folders** (master plan §3): `src/features/designer/` ← `src/components/editor/*`, `src/store/editor.ts`, `src/lib/{export,storage,catalog}.ts` (catalog stays a placeholder until F4 Part C); `src/ui/` (empty shell + README, filled in 0.2); `src/domain/`, `src/i18n/`, `src/lib/api/` (placeholders with README); `src/components/Brand.tsx` → `src/ui/brand/`. Path aliases `@/ui`, `@/features`, `@/lib`, `@/domain`, `@/i18n`.
6. **Zone-ready routes** (no new features): `/design/[id]` → `src/app/[locale]/design/[id]`, `/my/designs` → `src/app/[locale]/account/designs` (+ permanent redirect from `/my/designs`), `/` → customer home placeholder under `src/app/[locale]/page.tsx`; remove `src/app/layout.tsx` in favour of `src/app/[locale]/layout.tsx` as the customer root layout. Minimal next-intl (`th` default without prefix, `en` at `/en`) only as needed; zones/proxy come in F1.
7. **Rebrand BoxStudio → getpack**: brand constants (`BRAND_NAME=getpack`, tagline "Your Packaging Production Partner", company "Collective Group (Thailand)"), metadata, visible copy, favicon placeholder, README rewritten for getpack-web. Replace create-next-app assets in `public/`. Keep reading old localStorage keys (migration) so existing local designs still open.
8. **CI** (`.github/workflows/ci.yml`): install → lint → typecheck → test (app + dieline) → build → e2e. Contract-drift, Storybook and Lighthouse jobs added later (0.2 / F1).
9. **Docs**: delete `docs/frontend-00-master-plan.md` (duplicate) and `docs/README.md` if it is the prompt-pack README; write ADR-0004…0007 per master plan §9; update PROGRESS.
10. **Acceptance**: `pnpm i && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` green; smoke e2e passes on the new paths; `/my/designs` redirects; old local designs open; `git log --follow` works for moved files.

## Session 0.2 — Design-system foundation (`src/ui`) per `design-system.md` and ADR-0001…0003
Build only the foundation plus what the designer shell uses now; the rest of the component list is built when F1–F5 first need it.
1. **Tokens** in TypeScript (primitive → semantic → component) → `scripts/build-tokens.ts` generates `src/ui/generated/tokens.css` (Tailwind v4 `@theme` + `--sem-*` blocks for light / dark / high-contrast, `prefers-color-scheme` fallback); `scripts/check-contrast.ts` (OKLCH → sRGB, WCAG 2.2 AA for every semantic text/UI pair in all three themes) runs in `pnpm test`. Theme cookie `pk_theme` + `data-theme` stamped server-side (no flash).
2. **Fonts** (ADR-0001): Noto Sans Thai (UI), Anuphan (display), JetBrains Mono (codes) self-hosted via `next/font/local`, Thai + Latin subsets, no runtime Google Fonts. Artwork fonts for the editor stay a separate catalogue loaded only on the design route.
3. **Components** (ADR-0002: Radix + CVA + tailwind-merge, `<Field>` context for aria wiring, Lucide via a curated `ICONS` registry): Button, IconButton, Field/Input/NumberInput (unit)/Textarea, Select, Checkbox, RadioCards, Switch, Slider, Dialog, AlertDialog (typed confirmation), Sheet, Popover, DropdownMenu, Tooltip, Tabs, SegmentedControl, Badge/StatusBadge, Skeleton, Spinner, Card, Callout, EmptyState/ErrorState, Toast (sonner), AppShell skeleton.
4. **i18n & domain seeds**: `src/i18n` messages th/en for the designer + shell, `formatTHB` (accepts decimal strings), Buddhist-era `formatDate`; `src/domain/status` scaffolding (typed to the contract later in F1). No business-day maths in the frontend.
5. **Storybook 10** (react-vite, addon-a11y) at `.storybook/` with docs pages (principles, tokens, voice & tone) and a story + axe test per component; CI job builds Storybook.
6. **Migrate the designer UI** (shell, toolbar, side panel, setup/print-rules modals, My designs) onto `src/ui` without functional change — smoke e2e stays green. Replace ad-hoc colour utilities with semantic tokens.
7. **Lighthouse CI** config with the budgets in `docs/performance-budgets.md` (customer + designer URL sets now; admin/partner added in F1).
8. **Acceptance**: `pnpm test` (incl. contrast gate) · `pnpm build-storybook` · `pnpm e2e` green; axe clean on the designer shell; PROGRESS updated.
