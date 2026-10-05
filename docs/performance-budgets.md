# Performance budgets (design-system.md §7) — enforced by Lighthouse CI

| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) | LHCI URL set |
|---|---|---|---|---|---|
| Marketing / catalogue / product (customer zone) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 150 KB | `customer-marketing` |
| Checkout / account (customer zone) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 200 KB | `customer-app` |
| Admin list/detail (admin zone) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB | `admin` (shell), `admin-lists`, `admin-crud` |
| Designer / 3D (`/design/[id]`, redirects to the studio since U4.2) | — | — | — | — | retired → `studio` |
| Studio (`/studio/[designId]`, U4) | ≤ 3.0 s to interactive shell (studio-spec §1) | ≤ 100 ms input latency | ≤ 0.1 | ≤ 350 KB, heavy modules lazy | `studio` |
| Partner zone (installable PWA) | ≤ 2.5 s on 4G mid-range | ≤ 200 ms | ≤ 0.1 | ≤ 180 KB | `partner` (mobile preset) |

`lighthouse/shared.json` holds the assertions every set inherits; `lighthouse/<set>.json` is one file per row above (the admin row has three: its shell, its lists and details, and a list with a create form — one ceiling cannot ratchet all three). `pnpm lhci` (`scripts/lhci.ts`) starts one `next start` in mock mode (MSW) that answers all three hosts and runs each set against it; `pnpm lhci admin` runs one. Admin and partner URLs carry the mock's fixed access token as a cookie, so the real shell is measured rather than a redirect to `/login`. Because zones have separate root layouts, admin/partner providers must never appear in customer bundles — the budget per URL set catches regressions. Web Vitals RUM is posted through the zone BFF to the API.

## Where we actually are (measured 2026-09-24, F1 1.3)

Every route type is currently **over** its budget, so each Lighthouse assertion is pinned as a
**ratchet** just above the measured figure: it stops the number growing while the gap is worked
down. The targets below are unchanged — the ratchet is not the budget, and lowering it as
headroom is won is the job.

| URL set | Target (initial JS, gz) | Measured | Over by |
|---|---|---|---|
| `customer-marketing` | 150 KB | ~~374 KB~~ 257 KB (F3 3.1) | 1.7× |
| `customer-app` | 200 KB | ~~381 KB~~ 268 KB (F3 3.1) | 1.3× |
| `admin` (shell) | 250 KB | 363 KB | 1.5× |
| `admin-lists` | 250 KB | 390 KB | 1.6× |
| `admin-crud` | 250 KB | 489 KB | 2.0× |
| `designer` | 350 KB | 518 KB | 1.5× |
| `partner` | 180 KB | 361 KB | 2.0× |

Measured with **no** `NEXT_PUBLIC_SENTRY_DSN` and no GTM container, so these are the floor. A
build with a browser Sentry DSN adds ~153 KB gz on top (F1 1.3 decision; see `docs/PROGRESS.md`).

What the weight is, on the storefront: React 73 KB, Radix ~85 KB across six chunks, next-intl
~29 KB, Lucide 19 KB, app code ~52 KB. None of it is Sentry and none of it is the designer —
`/` and a bare placeholder page load the same bundle, so it is the shared shell.

The largest single lever is Radix: the storefront header mounts `DropdownMenu` (theme,
language), `Popover` (notifications) and `Tooltip` on every page. Deferring those three until
interaction is F3's storefront-performance work, and is worth roughly half the gap on its own.

## F2 2.8 — what the admin weight was, and what came out

Measured on the production build in mock mode (F2 2.8), before and after:

| Page | Before | After | What changed |
|---|---|---|---|
| `/` (dashboard) | 490 KB | 363 KB | zod left the browser: `clientEnv` no longer parses with zod (the server checks the same public values at boot), the `@/lib/env` barrel exports no schema, `browserRequests` imports the request registry as a type, and the dashboard imports the console by path |
| `/orders`, a detail | 501 KB | 390 KB | the same |
| `/partners` | 509 KB | 489 KB | still carries zod: its create form's schema is defined at module level |

**Next levers.** (1) Load a `CrudList` form — and the zod schema it validates with — only when its
sheet opens; every CRUD list then drops to the `admin-lists` figure. (2) The console barrel is
not tree-shaken across the `"use client"` boundary: importing one hook from `../console` pulls
the whole console (forms, import wizard, saved views). Importing by path is what fixed the
dashboard. (3) The storefront reads `clientEnv` too, so the customer sets should have shed zod as
well; re-measure them and lower their ratchets (F3).

## F3 3.1 — the storefront, before and after

Measured on the production build in mock mode, same method (desktop preset, `pk_consent=a1m1`).
The marketing set now covers what 3.1 built: `/`, `/products`, a product page, an article, `/faq`.

| Set | Start of 3.1 | End of 3.1 | Ratchet |
|---|---|---|---|
| `customer-marketing` | 341 KB (zod already gone, F2.8) | 256–257 KB | 390 → 270 KB |
| `customer-app` | — | 256–268 KB | 400 → 280 KB |

What came out, in order of weight:

1. **The header's menus load on intent.** Language and theme are plain buttons until pointed at,
   focused or clicked (`DeferredMenus.tsx`); the Radix menu, its positioning engine and their
   dependencies arrive then. A click opens the menu as it arrives; a focused placeholder hands
   focus to the real trigger.
2. **No bell for a guest.** The notification bell (a Popover and a query) renders only with a
   session, and is imported dynamically: Next ships every client module a server component
   *imports*, rendered or not, so the import itself had to move behind `dynamic()`.
3. **`error.tsx` imported the `@/ui` barrel.** A client component on every customer route, so the
   whole component library — galleries, tables, editors' neighbours — was in every page. All
   three zones' `error.tsx`/`not-found.tsx` now import by path.

LCP 0.76–0.85 s, CLS 0, accessibility 1 and SEO 1 on every marketing URL (the app set's SEO is
0.66 by design: those pages are `noindex`).

**What is left** (≈256 KB): React + react-dom ~73 KB, Next's router runtime ~43 KB, Radix still in
the shell ~40 KB (`TooltipProvider` and sonner's `Toaster` in `ZoneProviders`, which all three
zones share; the sign-in sheet and the search dialog load on demand and add nothing up front),
next-intl ~11 KB, Lucide ~16 KB, app code. The next levers: a customer-only
`ZoneProviders` that mounts the tooltip provider and toaster lazily, and next-intl's client
provider carrying only the namespaces a page's client components use instead of the whole zone.

## F3 3.2 — the configurator and the RFQ form

Measured the same way. Both pages join the `customer-app` set (the app-page row: 200 KB target),
because they are tools, not landing pages — `/configure/*` is `noindex`, and the product page
that is indexed is unchanged.

| Page | Initial JS | Note |
|---|---|---|
| `/configure/tuck-end-box` | 292 → 283 KB | steps after the first and the phone dock's sheet load on demand |
| `/rfq/rigid-box` | 272 KB | the form is the page (Select, FileDropzone, Checkbox) |
| marketing set | 254–256 KB | unchanged |

The `customer-app` ratchet moves **280 → 290 KB** to cover the configurator, the heaviest page in
the set; the marketing ratchet stays at 270 KB. The 3D preview costs nothing extra: it is CSS 3D
transforms, not WebGL. The next lever is the same as 3.1's — the shared shell (~254 KB) is most of
every page.

## F3 3.3 — cart and checkout

Measured signed out (the set's convention), so `/cart` measures the sign-in page it redirects to
(268 KB); the cart, checkout and payment pages themselves need a customer session, which the
Lighthouse runs do not carry. The configurator moved 283 → 284 KB with 3.3's changes to modules it
shares, just over the 290,000-byte ceiling pinned in 3.2; the ratchet moves to **293,000** bytes.

## U3.1 — style recipes (2026-10-02)

Measured on the same build of `main` (`bb1fe7f`) and of the U3.1 branch, `pnpm lhci`, script
transfer size, heaviest of three runs:

| Page | `main` | U3.1 | Ratchet |
|---|---|---|---|
| `/design/new` | 459,739 | 467,144 | designer 460,000 → **468,000** |
| `/configure/tuck-end-box` | 319,069 | 326,473 | customer-app 293,000 → **327,000** |
| `/account/designs` | 308,493 | 315,900 | (same set) |
| `/rfq/rigid-box`, `/sign-in` | 281,735 / 274,726 | unchanged | — |

The ~7.4 KB is the recipe engine on every page that loads `@packio/dieline` (ADR-0011): 30
recipes as data, the module declarations and the expression evaluator. Recipe data must leave the
initial bundle before U3.4 wave 1 (≈ 75 more recipes) — loaded per style, or read from the API
(U3.B2). **`customer-app` was already over its ceiling on `main`** (319,069 against 293,000):
that growth came with the U-F0 migrations and is not explained in their entries. It is a separate
follow-up; the ratchet now covers both so the set stops failing on everything else.

## U2.F1 — configurator v2 (2026-10-04)

| Page | Before (U3.3) | After | Ratchet |
|---|---|---|---|
| `/configure/tuck-end-box` | 326,749 | 336,117 | customer-app 327,000 → **337,000** |

The size step is the configurator's first step and carries the new measurement-basis logic: the basis cards, the API's conversion and per-pattern bases (`conversion.ts`), the derived-sizes panel and the diagrams; `build.ts` now writes six published configurations instead of two. Everything after the first step — the Structure Advisor and its inputs, the target price and levers, the summary and drafts — loads on demand (`next/dynamic`). Follow-up: move the quote and draft actions (save, share, PDF, levers, send to sales) behind a dynamic import on first click.

## U3.4 wave 1 → U3.5 — style library (2026-10-04)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/styles`, `/styles/<code>-<name>` (new, `customer-marketing`) | — | 269,148 / 269,242 | 270,000 (unchanged) |
| `/configure/tuck-end-box` | 336,117 | 338,896 | customer-app 337,000 → **339,000** |
| `/design/new` | ≤ 468,000 | 471,492 | designer 468,000 → **472,000** |

Wave 1 adds 60 recipes and 15 modules; all of them, their parameters and their words live in
`@packio/dieline/library`, and the core styles the designer and configurator draw stay in their
pre-wave form in the main entry (the library replaces them by id with their extended versions).
What is left in the main entry is the code of core modules that the extended versions share:
joints (stitched / taped), hand holes in long panels and trays, the insert-piece hook and the
`floor` placement, mailer fronts, pouch features, the slit-lock band and pillow hang holes —
about 2.8 KB on the configurator and 3.5 KB on the designer. Splitting those into library-only
copies of the modules would leave two versions of each to keep in step, so the ratchets move
instead. The library pages fit the marketing budget without a change: the first page's cards are
rendered on the server, facets and sort are links, favourites are a small store, and the API
client, the card renderer and the 3D model load on interaction.


## U4.1 — Packio 3D Studio shell (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/studio/new?product=tuck-end-box…` (new, `studio`) | — | 478,237 (performance 0.98) | **479,000** (new set) |
| `/design/new` | ≤ 472,000 | 473,984 | designer 472,000 → **474,500** |

The studio is the designer (same lazy Konva and three.js chunks, ADR-0010) inside the step bar and
the price dock; the dock reuses the configurator's configuration builder, which the designer's
price widget already shipped. The designer grows by the editor's frame slots and the studio save
client (box fields, `patchDocument`); the JSON-Patch diff itself loads only when a studio save
runs (dynamic import). The target stays 350 KB for both; the gap is the U3/U4 follow-up of moving
the configurator's build out of the initial chunk.

## U4.2 — ① Start and ② Box (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/studio/new?product=tuck-end-box…` | 478,237 | 484,482 (performance 0.98) | studio 479,000 → **485,000** |
| `/design/new` | 473,984 | redirects to the studio | `designer` set retired |

`/design/[id]` is a redirect into the studio now, so its URL set measured the studio twice and is
retired. ① (the "describe your product" helper) and ② (the box step: variant picker, size with
the API's conversion, materials, print method, finishes, the Structure Advisor) are `next/dynamic`
and load only when shown — a design opened on ③ never loads them (they measured +12 KB inline).
What stays in the first load is the print method's ink rule, the rules catalogue query and the
dock's typed quantity.

## U4.3 — ③ Design core (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/studio/new?product=tuck-end-box…` | 484,482 | 486,106 (performance 0.98) | studio 485,000 → **487,000** |

The stage's view bar (split / flat / 3D, outside / inside), the layers panel as an accessible tree,
the distance labels and the engine's `mirrorDieline` for inside printing are in the editor's chunk;
three.js still loads only with the 3D view. **Orbit performance** (`e2e/studio-perf.spec.ts`): a
150-object design orbited in 3D with the CPU throttled 4× — **59.6 fps** on the CI machine's
software WebGL; the floor is 45 fps (`STUDIO_ORBIT_FPS_FLOOR`).

## U4.4 — ③ Design content (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/studio/new?product=tuck-end-box…` | 486,106 | 492,619 (performance 0.98) | studio 487,000 → **493,000** |

The content tools — Packio templates and their re-flow, elements, codes and data blocks, brand
kits with palette extraction, backgrounds — are `next/dynamic` rail panels (inline they measured
496,380). What the canvas itself needs stays in the first load: finish layers, gradients and the
full-wrap picture, the EAN-8 / UPC-A / Code 128 encoders (the canvas draws every symbol) and the
image-quality badge of the properties panel. Orbit performance alone (`pnpm e2e:perf`): 56.1 fps.

## U4.5 — ④ Check (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/studio/new?product=tuck-end-box…` | 492,619 | 496,235 (performance 0.98) | studio 493,000 → **497,000** |

The checks now run packio-api's rule catalogue (ids, severities, thresholds, print methods,
material classes) with the vendored catalogue as the fallback while `getRules` has not answered;
the panel groups findings by severity with their fixes and acceptances; the soft proof is a CSS
filter. The fixes themselves load on first use.

## U4.6 — ⑤ Order (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/studio/new?product=tuck-end-box…` | 496,235 | 498,368 | studio 497,000 → **499,000** |
| `/configure/tuck-end-box` | 338,896 | 339,234 | customer-app 339,000 → **340,000** |

The order sheet, the render upload and the print-job polling are `next/dynamic` (on first open of
⑤); the stable idempotency key has its own module so no other zone loads it (partner went back
under its budget once it left `lib/api/client.ts`). What remains is copy: the zone's
`NextIntlClientProvider` carries every customer namespace in each page's flight data, so the order
sheet's th text, the lock notice, the proof and order-page links and the shortcut groups count on
every customer page. Scoping client messages per route would take that back for all of them
(follow-up, not U4.6's). Orbit performance (`pnpm e2e:perf`): 54.3 fps.

## U4.7 — Collaboration, versions, presentation, AR (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| `/studio/new?product=tuck-end-box…` | 498,368 | 496,889 (performance 0.98–0.99) | studio 499,000 → **497,500** (lowered) |

Comments, the share-links dialog, the presentation view, the AR view (`@google/model-viewer`, three's
glTF / USDZ exporters) and the version history with its compare view all load on demand; the
editor's first load only gained the comment pins (flat and 3D). Making the history and the old
view-link dialog lazy too won back more than the session added. Partner stayed under 300,000 after the
rebuild (the two new problem messages ride in every zone's `common` copy).

## U2.F4 — partner ratchet (2026-10-05)

| Page | Before | After | Ratchet |
|---|---|---|---|
| partner `/jobs` | ≤ 300,000 | 300,067 | partner 300,000 → **301,000** |

The U2 sessions added copy that every zone loads: the sample status vocabulary (`status`), the shared
sample-evidence form and the `samples.*` / `dielines.*` problem messages (`common`). The factory app
itself only gained the sample-jobs screen, on its own route. Splitting `common` per zone would win
this back for everyone (follow-up).
