# PROGRESS — packio-web

Running log maintained by the coding agent. Newest entry on top. This log starts fresh on 2026-09-22; nothing before this date may be assumed to exist in the codebase.

| Date | Deliverable | Done | Deferred | Assumptions / questions (legacy file:line) |
|---|---|---|---|---|
| 2026-09-22 | Start | Repo contains the original BoxStudio single Next.js app (designer: RSC / tuck-end / tray dieline editor, localStorage designs, PNG/PDF/SVG export) plus the Packio prompt pack v3 (`docs/decisions.md` D-001…D-155, `docs/accounting-design.md`). Brand: **Packio — Your Packaging Production Partner** (Collective Group (Thailand)). | Everything from F0 Session 0.1 | ADR-0001…0003 are accepted decisions not yet implemented |
| 2026-09-22 | **F0 Session 0.1** — structure, tooling, dieline package, zone-ready routes, rebrand | pnpm + Node 24; strict TS, ESLint flat config, Prettier; Vitest + Playwright safety net (41 unit, 4 e2e); Next 16 + React 19.3; `@packio/dieline` extracted; target folder structure; `[locale]` customer zone + `src/proxy.ts`; rebrand to Packio with localStorage migration; CI; ADR-0004…0007 | F0 Session 0.2 (`src/ui` foundation: tokens, fonts, components, Storybook, Lighthouse CI) | See the notes under this table |
| 2026-09-23 | **F0 Session 0.2** — design-system foundation (`src/ui`) | Tokens in TS → generated CSS with a WCAG contrast gate (ADR-0003); self-hosted Noto Sans Thai / Anuphan / JetBrains Mono (ADR-0001); 30 Radix + CVA components with axe tests (ADR-0002); `pk_theme` light/dark/high-contrast; namespaced th/en messages, `formatTHB`, Buddhist-era dates, `src/domain/status` shape; Storybook 10 + docs; designer, home and My designs migrated onto `src/ui`; Lighthouse CI; React Compiler rules back to `error` | The rest of `design-system.md` §3 (DataTable, Combobox, DatePicker, PhoneInput, AddressForm, FileDropzone, Timeline, PriceSummary, ProofViewer, charts, partner shop-floor set) — built when F1–F5 first needs them | See the notes under the F0.2 heading |

---

## F0 Session 0.2 — 2026-09-23

Eight commits, each with lint, typecheck, unit tests and build green:
tokens → fonts → primitives → forms/overlays → i18n & status → Storybook → designer
migration → CI gates.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| Every semantic colour pair meets WCAG 2.2 AA in all three themes | `scripts/check-contrast.ts`, run as a Vitest suite (96 assertions) |
| A semantic colour no pair checks | fails the same gate — `uncheckedKeys()` |
| `src/ui/generated/tokens.css` matches the TypeScript tokens | `pnpm tokens:check` in CI |
| `bg-teal-600`, `text-slate-500` and friends | no longer resolve: the generated `@theme` emits `--color-*: initial` |
| Labels, hints and errors wired to their control | `<Field>` context; composite controls use `useFieldGroupProps()` |
| An icon-only button without an accessible name | will not compile — `IconButton`'s `label` is required |
| A status rendered from colour alone | impossible: `StatusBadge` takes a `StatusMeta` (tone **+** icon **+** label key) |
| A string that exists in one language only, or whose ICU placeholders differ | `src/i18n/messages.test.ts` |
| axe violations per component / per page | Vitest per component; `@axe-core/playwright` on 5 page states incl. dark and high contrast |
| Performance budgets | `lighthouserc.json`, `lighthouse` CI job |

### Bugs this session found and fixed

Four were only findable in a real browser, which is the argument for the e2e a11y job:

1. **`Button asChild` crashed the server render.** With `asChild`, Radix `Slot` received three
   children (icon, label, icon) and threw "Slot failed to slot onto its children" — so the home
   page 500'd. Fixed with `Slot.Slottable` around the label, which also keeps icons working
   with `asChild`. Pinned by a unit test.
2. **Closing any dialog dropped focus to `<body>`** (WCAG 2.4.3). Radix restores focus to
   `Dialog.Trigger`'s ref, and every dialog here is *controlled* — opened from a toolbar button,
   a menu item or a shortcut — so that ref is null. `src/ui/lib/useReturnFocus.ts` captures the
   element in `onOpenAutoFocus` (dispatched before FocusScope moves focus) and restores it in
   `onCloseAutoFocus`. Applied to Dialog, AlertDialog and Sheet.
3. **The ghost Button was illegible on the designer's dark header: 1.89:1.** It forced
   `text-fg`. Ghost now inherits its colour and tints its hover from `currentColor`, so it adapts
   to any surface instead of needing a local override at each call site. The token gate could not
   see this — the tokens were fine; the pairing was not.
4. **`<dl>` in the box-setup preview held a non-definition legend** (axe `definition-list`).
   The cut/fold legend moved out of the list.
5. **`opacity-80` on the designer header's summary turned a gated 7.25:1 pair into 4.46:1.**
   Opacity compounds onto the whole subtree, so the `opacity-100` on the `<b>` inside could not
   undo it. This is the one failure mode the token gate structurally cannot see: the tokens were
   correct and the pairing was correct, and a utility downstream quietly changed the pixels. No
   `opacity-*` is used for text anywhere now — hierarchy comes from size and weight — and the
   destructive button's `hover:opacity-90` (which dimmed its own label) became a real
   `danger-hover` token, gated like every other pair.

Two more came out of the migration itself:

5. **`SetupModal` was remounted by a `key` to reset its form**, which unmounted Radix's focus
   scope instead of closing it. The form state moved into a child Radix unmounts on close, so it
   resets with no key and no effect.
6. **The `useMemo` the React Compiler could not preserve** (F0.1 recorded it) was not "fixed" by
   restructuring its dependencies — it was deleted. It wrapped a lookup and three additions, and
   a memo the compiler cannot preserve makes it skip optimising the whole component.

The two React Compiler rules are back to `error`, and `reportUnusedDisableDirectives` is on, so
the three remaining `eslint-disable` lines cannot rot: two mount-time `localStorage` reads
(removed in F4 Part B with the designs API) and one fit-to-measured-viewport effect.

### Decisions taken, with reasons

- **Semantic keys are `fg` / `muted`, not `text` / `text-muted`** as ADR-0003 wrote them.
  `--color-text-muted` would generate the utility `text-text-muted`; the utilities
  `design-system.md` §2 actually names (`bg-primary`, `text-muted`, `border-border`) need these
  names. Same tier, renamed.
- **`subtle` is gated at 3:1, not 4.5:1.** It is only placeholders, disabled labels and
  decorative meta text, which WCAG 1.4.3 exempts; body and secondary text use `fg` and `muted`.
  Step 500 of the shared lightness ramp was tuned to 0.658 to clear 3:1 (3.13:1).
- **The theme cookie is read with `cookies()` in the customer root layout**, as the prompt asks,
  which opts customer routes out of static rendering. Accepted for F0.2 and confirmed with the
  user; F1 moves the read into `src/proxy.ts` as a request header so the pages can be cached
  again. The alternative — a pre-paint inline script — keeps them static but needs a CSP nonce
  and fails with JavaScript off.
- **axe runs in Vitest and Playwright, not the Storybook test runner** (confirmed with the user).
  One test runner, no second Vitest project in browser mode. Storybook is documentation and is
  built in CI; `color-contrast` and `region` are disabled in jsdom because it has no pixels and a
  component under test is a fragment — both are covered properly in the browser.
- **Fonts are one file per script, not per family.** `next/font/local` applies `declarations` to
  every `src` entry of a call, so it cannot give two files of one family different
  `unicode-range`s, and two `@font-face` rules for one family with no range means the second file
  is never used. Coverage order in the token stacks does the job. No declaration names a generic
  fallback: Next splices those into the family's own variable, ahead of the Thai family, and
  `system-ui` on a Thai system *does* have Thai glyphs — Thai text would never reach Noto Sans
  Thai.
- **`th-TH` already defaults to the Buddhist calendar in `Intl`**, so the naive +543 shifted
  2026 to 3112. The tag is pinned to `ca-gregory` and the offset is explicit, which is also what
  lets an accounting export ask for CE in Thai.
- **Lighthouse asserts resource sizes and accessibility as errors, field metrics as warnings.**
  A shared GitHub runner cannot stand in for a p75 measurement; Web Vitals RUM through the BFF is
  the real signal and arrives in F1.
- **Scripts run through `tsx`, not bare `node`.** Node 24 strips types but needs explicit `.ts`
  import extensions, which would force that style through all of `src/ui/tokens`.
- **Tailwind reaches Storybook through `@tailwindcss/vite`, not the shared PostCSS config.**
  Turbopack requires the plugin named as a string and Vite requires an instantiated plugin, so
  one file cannot serve both.
- **Board colours and the dieline SVG's cut/crease colours stay literal.** Paper colours describe
  real kraft and art card, and pure red/blue in the exported cut file is the die-maker's
  convention — neither may follow the brand. On-screen marks come from `PRINT` tokens through
  `src/features/designer/canvas-colors.ts`, because Konva and PDF cannot read CSS variables.
- **The brand hue is still a placeholder** (`docs/ui/brand.md`). Swapping it is one edit to
  `primitives.ts` plus `pnpm tokens`; the contrast gate then decides whether `primary` must move
  to a darker step.

### Deliberately not done

- `SiteHeader` moved out of `src/ui/brand` to `src/features/customer/shell` — it is a zone shell,
  not brand. F1 replaces it with the real one (mega-menu, cart, account, locale switcher).
- `BRAND_HEX` and `BRAND_TAGLINE_TH` are gone: the hue is a token and the Thai tagline is copy in
  `src/i18n`. `BRAND_NAME`, `BRAND_TAGLINE` and `BRAND_COMPANY` stay — legal identity, not
  translatable text.
- The ESLint rule that blocks hard-coded UI strings, the packaging glossary, and the admin and
  partner Lighthouse URL sets are all F1, with the zones they need.
- `src/domain/status` has the shape but no maps. They arrive in F1 keyed to the generated contract
  enums, so a new backend status fails the build until it has a tone, an icon and a label.

---

## F0 Session 0.1 — 2026-09-22

Branch `chore/packio-baseline`, tag `pre-packio` on the pre-F0 commit. Working tree was
clean at the start: nothing needed stashing.

### Things that turned out differently from `docs/prompts/F0-setup.md`

1. **The repo was on Next 15.5.25, not Next 16.** Worse, the designer route was broken on
   it: `react-konva` resolved to 19.3.0, which refuses to run against the React 19.1 copy
   Next 15 bundles for the client, so `/design/[id]` rendered an error page. Confirmed with
   the user, F0.1 upgrades to **Next 16.3.6 + React 19.3.0**. That is also why the test
   net had to be proven before the upgrade rather than after it, and why F1 can write
   `src/proxy.ts` directly instead of a `middleware.ts` it would later rename.
2. **`docs/` was in `.gitignore` from the first commit**, so the entire prompt pack —
   decisions, ADRs, F0–F6 prompts, PROGRESS — had never been committed, even though both
   existing commits are titled "docs: Packio prompt pack v3". Confirmed with the user;
   `docs/` is tracked now.
3. **Step 9's deletions did not apply.** `docs/frontend-00-master-plan.md` and
   `docs/README.md` do not exist. The **root** `README.md` was the v2 prompt-pack index,
   and step 7 replaced it with the packio-web README.
4. **Node on this machine defaults to v18.17.0**, which is below what Next supports.
   `.nvmrc` pins 24 and every command in this session ran on nvm's v24.21.0.
5. Next 16 **overwrites `CLAUDE.md`** with generated agent rules on `next dev`.
   `agentRules: false` in `next.config.ts` stops it; the file is hand-written documentation.
6. **Port 3000 was occupied by another project** on this machine, so the e2e suite runs on
   its own port (`E2E_PORT`, default 3100) and never depends on a dev server.

### Assumptions taken (most conservative option, per CLAUDE.md)

- **`patterns.ts` stays in the app.** Step 4 asks for "pattern tile maths without DOM" in
  the package; there is none — `buildPatternTile` is a canvas routine end to end and
  `PATTERN_OPTIONS` is Thai UI copy. The package holds geometry only.
- **Face names stay Thai** (`PANEL_NAMES`, "ปีกกาว", "ฝาบน" …) inside `@packio/dieline`, so
  the extraction changes no behaviour. F4 Part A turns them into i18n keys; ADR-0007 and
  the package README say so.
- **`noUncheckedIndexedAccess` is off.** The geometry code indexes arrays positionally
  throughout (`xs[5]`, `pts[(i + 1) % n]`); turning it on would mean rewriting the very
  code F0.1 must move unchanged. Worth revisiting in F1.
- **No ESLint zone boundaries yet.** There is no admin or partner code to keep apart until
  F1 creates the zones; the rule set belongs with them.
- **Four React Compiler lint rules are warnings, not errors.** `eslint-config-next` 16
  turns on `react-hooks/set-state-in-effect` and `react-hooks/preserve-manual-memoization`,
  which flag pre-existing designer patterns (setState inside the localStorage load effects
  in `Editor.tsx`, `DesignCanvas.tsx` and `MyDesigns.tsx`, and a `useMemo` in
  `SetupModal.tsx` the compiler cannot preserve). F0.1 must move that code unchanged, so
  they stay visible and get fixed in F0.2 when the designer UI is rebuilt on `src/ui`.
- **`localeDetection: false`.** With detection on, next-intl remembers a visitor's locale
  in a cookie and serves English from `/`, which breaks the indexed "th at `/`, en at
  `/en`" split in master-plan section 2 and makes the page uncacheable. A language switcher
  that navigates to `/en` comes with the shell in F1.
- **Changesets `baseBranch` is `master`**, the only branch this repo has; there is no
  `main` and no remote yet.
- **The brand hue is a placeholder** (`BRAND_HEX`, the teal the app already used) until the
  brand kit arrives and F0.2 puts colour behind generated tokens.
- **Prettier does not format `docs/` or `CLAUDE.md`.** `docs/contract/api-conventions.md`
  must stay byte-identical to its copy in `packio-api`, and the prompt pack is a delivered
  reference. `tsconfig.json` and `next-env.d.ts` are left to Next, which rewrites them.

### Known regression, deliberate

Removing the runtime Google Fonts `<link>` (ADR-0001) means the UI **and the designer's
artwork font list** (`FONT_FAMILIES`: Sarabun, Prompt, Kanit …) fall back to whatever the
device has. F0.2 self-hosts the UI faces with `next/font/local`; the artwork catalogue is
F4 Part C, which must also outline or embed them in print PDFs.

### Bug found and pinned, not fixed

`insetConvex` only detects a collapse at exactly half the smallest span. Past that the
offset lines cross and it returns a **mirrored** polygon whose signed area is still
positive, so the guard passes. Used for the 3 mm safe zone, where the inset is always
small, so it has never bitten. Pinned by a test in `packages/dieline/src/geometry.test.ts`
and recorded in ADR-0007 for F4 Part A to decide on.

### Not yet true of the target structure

`src/app/bff`, `src/lib/{auth,bff,observability}`, `mocks/`, `contract.lock.json`,
`Dockerfile`, `robots.ts`, `sitemap.ts` and `global-error.tsx` are all F1. `src/ui`,
`src/domain`, `src/i18n` and `src/lib/api` exist with a README each saying what goes in
them and when.
