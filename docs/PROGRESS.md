# PROGRESS — packio-web

Running log maintained by the coding agent. Newest entry on top. This log starts fresh on 2026-09-22; nothing before this date may be assumed to exist in the codebase.

| Date | Deliverable | Done | Deferred | Assumptions / questions (legacy file:line) |
|---|---|---|---|---|
| 2026-09-22 | Start | Repo contains the original BoxStudio single Next.js app (designer: RSC / tuck-end / tray dieline editor, localStorage designs, PNG/PDF/SVG export) plus the Packio prompt pack v3 (`docs/decisions.md` D-001…D-155, `docs/accounting-design.md`). Brand: **Packio — Your Packaging Production Partner** (Collective Group (Thailand)). | Everything from F0 Session 0.1 | ADR-0001…0003 are accepted decisions not yet implemented |
| 2026-09-22 | **F0 Session 0.1** — structure, tooling, dieline package, zone-ready routes, rebrand | pnpm + Node 24; strict TS, ESLint flat config, Prettier; Vitest + Playwright safety net (41 unit, 4 e2e); Next 16 + React 19.3; `@packio/dieline` extracted; target folder structure; `[locale]` customer zone + `src/proxy.ts`; rebrand to Packio with localStorage migration; CI; ADR-0004…0007 | F0 Session 0.2 (`src/ui` foundation: tokens, fonts, components, Storybook, Lighthouse CI) | See the notes under this table |
| 2026-09-23 | **F0 Session 0.2** — design-system foundation (`src/ui`) | Tokens in TS → generated CSS with a WCAG contrast gate (ADR-0003); self-hosted Noto Sans Thai / Anuphan / JetBrains Mono (ADR-0001); 30 Radix + CVA components with axe tests (ADR-0002); `pk_theme` light/dark/high-contrast; namespaced th/en messages, `formatTHB`, Buddhist-era dates, `src/domain/status` shape; Storybook 10 + docs; designer, home and My designs migrated onto `src/ui`; Lighthouse CI; React Compiler rules back to `error` | The rest of `design-system.md` §3 (DataTable, Combobox, DatePicker, PhoneInput, AddressForm, FileDropzone, Timeline, PriceSummary, ProofViewer, charts, partner shop-floor set) — built when F1–F5 first needs them | See the notes under the F0.2 heading |
| 2026-09-23 | **F1 Deliverable 1.1** — zones, proxy, root layouts, security headers | Env schema (zod, server/client split, boot-validated); `src/proxy.ts` resolving zone from `Host`, rewriting admin/partner hosts, refusing cross-zone paths, per-zone nonce CSP + security headers, session-refresh decision; three root layouts with zone providers (theme, next-intl, TanStack Query, toasts), per-zone `not-found`/`error` and `global-error`; admin/partner locale from `pk_locale`; ESLint zone boundaries with a fixture test; 31 e2e (3 hosts, cross-zone 404s, noindex, CSP) and 76 new unit tests | F1 1.2 (contract, API clients, BFF, auth) and 1.3 (shells, observability, SEO, push, analytics) | See the notes under the F1.1 heading |
| 2026-09-23 | **F1 Deliverable 1.2** — contract, API clients, BFF, auth | `pnpm gen:api` + `contract.lock.json` + vendored contract + CI drift gate; adopted packio-api **B1.3**'s auth contract, retiring the seed F1.2 started against; `serverApi`/`browserApi`/`upstreamApi` on openapi-fetch with `ApiError` from problem details, `Idempotency-Key`, `If-Match`, query keys and real TanStack retry rules; `createBffHandler(zone)` on all three zones (allow-list, CSRF, refresh-once, streaming, body cap); `refreshSession` implemented; shared session-cookie module; `getActor(zone)` + route guards; staff, partner and customer OTP sign-in with sign-out; `FormField`, `OTPInput`, `PhoneInput`; shared `auth` messages; Firebase/LINE CSP origins; MSW + `pnpm dev:mock`; 378 unit and 45 e2e | F1 1.3 (shells, per-feature i18n split, status maps, observability, SEO, push, analytics). Firebase and LINE SDK wiring — UI, endpoints and CSP are in place, the SDKs load on click in F3 | See the notes under the F1.2 heading |
| 2026-09-24 | **F1 Deliverable 1.3** — shells, i18n, domain presentation, observability, quality gates | Eleven status maps behind one `contract.ts` indirection + the `status` namespace + `nextActions` renderer; messages split per zone with `react/jsx-no-literals`, ICU gates and the packaging glossary; the three zone shells (admin sidebar from `/v1/admin/me` entitlements, ⌘K, `?`, notification centre, storefront header/footer/bottom nav, partner shop-floor frame) and four new `src/ui` primitives; Sentry on all three runtimes with trace headers through the BFF and Web Vitals RUM; robots/sitemap/canonical/hreflang/JSON-LD on the indexed zone only; SSE→cache invalidation, web push, PWA manifest; typed D-102 funnel events behind a PDPA consent gate; five Lighthouse URL sets and Storybook visual snapshots. 481 unit, 78 e2e, 4 visual | F2–F6. The storefront's initial-JS budget is breached on every route type (see below) | See the notes under the F1.3 heading |
| 2026-09-25 | **F2 Deliverable 2.1** — admin foundation | Adopted packio-api B1.3's platform contract (users, roles, approvals, audit, settings, flags, notifications, web push, realtime, files); status layer realigned to the backend's approved schema-design §4 (44 vocabularies, 7 typed on contract enums); contract requests as code (zod registry → typed calls, schema-checked mocks, an OpenAPI handoff document, a self-retiring test); mock API with the 14 D-140 personas over the backend's own seed data; `src/ui` back-office set (DataTable on TanStack Table 9, Combobox, FileDropzone, SlaTimer…); console framework (URL-driven lists, saved views, export, upload → preview → confirm import, `defineResource`, typed confirmations); dashboard, approvals inbox + detail + delegations, users & role grants with SoD/escalation checks, roles matrix, audit log, effective-dated settings editor, feature flags, notification templates & routes, outbox; ⌘K search; grouped sidebar. 555 unit, 100 e2e | 2.2–2.8 | See the notes under the F2.1 heading |
| 2026-09-25 | **F2 Deliverable 2.2** — orders & CS desk | Nine contract-request groups (orders, order notes and actions, customers, geo, CS calculators, quotations, discount memos, CS create-order) with stateful mocks; the six CS queues; the order screen (sticky header with the API's next action, ten tabs, slip review, manual start, cancel, notes with @mentions, unified timeline, order groups); the seven D-100 calculators with a factory × print × quantity comparison and the D-052 memo threshold from the API; quotations, discount memos, create-order with split delivery; `keys-used` and `server-imports` unit gates. 562 unit, 113 e2e | 2.3–2.8 | See the notes under the F2.2 heading |
---

## F2 Deliverable 2.2 — 2026-09-25

Orders and the CS desk. Same worktree and branch as 2.1. None of 2.2's endpoints exist in
packio-api yet (its B3 is next on its side), so every screen runs on contract requests shaped by
the approved schema design (§3.6 commerce, §3.7 fulfilment, §4 enums, §2.9 amounts as strings).

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A message key that does not exist, rendered as its own path | `src/i18n/keys-used.test.ts` resolves every literal key and every template key's prefix used in `src/app` and `src/features` |
| A server page importing a constant or a resource definition from a `"use client"` module (compiles, fails at request time in production) | `src/app/server-imports.test.ts` — pages and layouts may import only components from client modules, following barrels one level |
| The UI hard-coding the direct-discount limit (D-052) | the calculator input data carries `discountPolicy.directLimitPct`; above it the only path is a discount memo |
| The UI comparing money to find the best price | calculation results come flagged `cheapest` / `fastest` by the API |
| Margin or the factory shown to a role not allowed to see it (D-141) | optional in the schema, absent from the mock unless the actor holds `margin.read`; the UI renders the field only when present |
| A slip action offered to CS | `nextActions` is per actor; slip review is Finance's (finance, finance_manager, superadmin) |

### Bugs this session found and fixed

1. **The settings editor's success toast rendered a raw key path** (`settings.saved` instead of
   `settings.change.saved`), found by the new keys gate's first run.
2. **Two server pages crashed in the production build only** ("includes is not a function"):
   `ORDER_TABS` and `CALCULATORS` were imported from client modules and arrived as client
   references. They now live in plain modules (`orders/tabs.ts`, `cs/calculators.ts`), and the
   imports gate above catches the next one.
3. **`text-warning` was used for text and icons** in six places; it is a fill colour and fails
   contrast on white. Warning text is `text-warning-subtle-fg`.
4. **A `1fr` column beside a fixed rail could not shrink below its table**, so the order screen's
   rail spilled past the viewport. Every such grid in admin code is `minmax(0,1fr)` now.

### Decisions taken, with reasons

- **One page-shaped order aggregate** (`GET /v1/admin/orders/{orderId}`) carrying every tab,
  rather than an endpoint per tab: the header restates statuses from all of them, and CS moves
  between tabs constantly. The timeline and notes are separate because they page and change.
- **One typed input per calculator** (a discriminated union on `calculator`, corrugate's combined
  parts included) rather than a bag of keys, so a missing field is a 422 with a path, not a price.
- **The calculator mock is illustrative, not the ported legacy maths.** The formulas belong to the
  backend (B2.3, with golden tests against legacy); the UI only renders what comes back.
- **The order tab lives in the URL without a server round trip** (local state plus
  `history.replaceState`): a server navigation would refetch the aggregate on every tab change.
- **Every irreversible order action needs the order code retyped**, restates the amount and sends
  one idempotency key per intent. Manual production start (D-073) and cancellation also need a
  reason.
- **Mentions are notified only while the name is still in the note**: deleting "@name" before
  sending un-mentions them.
- **CS create-order starts from a saved quotation**, so the price locked for 15 days (D-051) is the
  one ordered. The form keeps one idempotency key for its whole life.

### Deliberately not done

- Editing a placed order's lines or prices: not in 2.2's scope, and D-051's price lock makes it an
  approval flow of its own.
- The label calculator stays behind its feature flag, as legacy's `DISPLAY_MENU_LABEL` was.

### Open questions

- **Backend**: `admin.orders`, `admin.order-notes`, `admin.order-actions`, `admin.customers`,
  `admin.geo`, `admin.cs-calculators`, `admin.quotations`, `admin.discount-memos`,
  `admin.cs-create-order` (all in `docs/contract-requests.md` and the OpenAPI handoff document).
- **Backend**: is the queue's SLA deadline computed server-side on the business calendar
  (D-161), as assumed? The UI only renders `slaDueAt`.

---

## F2 Deliverable 2.1 — 2026-09-25

The back-office foundation. Worked in its own git worktree (`../packio-web-f2`, branch
`feat/f2-admin`), because two other sessions were editing the shared checkout — the master plan
says F2–F6 run in separate worktrees for exactly that reason.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A response type written by hand for an endpoint that does not exist | every contract request is a zod definition in `src/lib/api/requests`; `requests.call(key, …)` is typed by it |
| A mock that drifts from what the backend was asked for | `mockRequest` validates every response against the request's schema (`500 mock.drift`), and a test drives every requested GET through MSW |
| A contract request nobody retires after the backend ships it | `registry.test.ts` fails as soon as its method and path are in `contract/openapi.json` |
| A request the backend was never told about | the same test fails when an entry has no row in `docs/contract-requests.md`; `pnpm gen:api` renders the registry as `docs/contract-requests.openapi.json` under the drift gate |
| An irreversible request sent without the caller's idempotency key | `CallInit` makes `idempotencyKey` a required property for `idempotent: true` entries (asserted with `@ts-expect-error`) |
| A status the backend adds without presentation | seven maps typed on `Schemas[…]`; the other 37 copied verbatim from the approved schema design, one line to repoint each |
| A page's own URL parameters reaching the API as filters | lists declare `filterKeys`; `mergeIntoUrl` keeps everything that is not the list's |
| A grant certain to be refused | SoD role pairs (`admin.sod-rules`) and the anti-escalation rule (`RoleDto.permissions` vs the grantor's) are shown and block submit before the API's 409/403 |
| A consequential action with no restated target or a fresh key per retry | `ConfirmAction`: restatement, optional typed phrase and reason, one key per opening, dialog stays open on failure |
| An e2e click that lands before hydration | `<html data-hydrated>` from `HydrationMark`; `signInAsStaff` and `gotoHydrated` wait for it |

### Bugs this session found and fixed

1. **Every Web Vitals beacon and every funnel event was a 403** (F1 1.3). `sendBeacon` cannot set
   a header and the BFF required `x-packio-csrf` on every POST, so field RUM and the D-102 funnel
   never reached the API. The two beacon endpoints are exempt from the header only; the `Origin`
   check still applies.
2. **The realtime client could not have received anything.** The published stream sends named
   SSE events, which `EventSource`'s `message` listener never sees, and authorises with a
   60-second token `EventSource` would keep resending after it expired. Replaced with a `fetch`
   reader: every frame, a fresh token per connection, jittered backoff, a refetch after gaps.
3. **The command palette's listbox held a `<p>` and role-less `<li>`s** once it had grouped
   results (critical `aria-required-children`) — F1's palette was always empty, so nothing had
   tested it. Groups are `role="group"` now.
4. **`/approvals?tab=all` sent `tab=all` to the API**, and changing a filter would have dropped
   the tab. See `filterKeys` above.
5. **`text-subtle` was used for real text** in the sidebar, the palette and the bell (contrast).
6. **A wide or long table scrolled where no keyboard could reach** (`scrollable-region-focusable`).
7. **Avatar initials took a parenthetical for a name** ("ผ(" for "ผู้อำนวยการ ตัวอย่าง (ข้อมูลจำลอง)").

### Decisions taken, with reasons

- **Adopted packio-api's newer B1.3 contract** (`pnpm gen:api --adopt`, still versioned 0.1.0 on
  its `feat/b1.3-platform` branch). 2.1 is mostly screens for endpoints that contract publishes,
  and building them against mocks while the real shapes existed would have meant writing them
  twice. The lock's `source` still names the v0.1.0 release asset — **re-pin when packio-api tags
  a release with this document.**
- **The status vocabularies follow the backend's approved schema design (§4)**, replacing the
  seven F1 had to propose. The design was approved on 2026-09-23 and says each enum becomes a named
  OpenAPI component; copying it now means the day the components ship is a one-line change per
  map. Other branches that render statuses (F3–F6) will see the new values when they merge.
- **Contract requests are zod, not hand-written interfaces.** At F2's scale a per-call-site
  interface is a hundred and fifty places to drift. One definition typing the call, checking the
  mock and generating the handoff document is the same rule — nothing invented silently — made
  mechanical.
- **Mock reference data is the backend's own seed**, copied into `mocks/admin/fixtures` (settings,
  approval policies, SoD rules, roles, permissions) rather than imported: CI has no sibling
  checkout. The admin menu mirrors packio-api's `menu.catalog.ts` verbatim, which is how feature
  flags, notification templates/routes and the outbox entered 2.1's scope.
- **A staff directory is a contract request**, not a use of `GET /v1/admin/users`: that needs
  `users.read`, which a Director delegating an approval does not hold.
- **Money typed into a setting is normalised as text** (`"20000"` → `"20000.00"`) and never passes
  through a float; percentages stay decimal strings, as the contract sends them.
- **The SLA timer invents no "at risk" threshold.** It renders the distance to a deadline the API
  computed, and trusts an API-sent state when there is one; a threshold would be a business rule.
- **Verification runs on a production build.** In `pnpm dev:mock`, MSW intermittently stops
  intercepting — it looks like Next's own `fetch` patch capturing the unpatched `fetch` depending
  on start-up order. The e2e suite already builds for production, for its own reasons.

### Deliberately not done

- No bespoke DatePicker: date and time fields are native `date` / `datetime-local` inputs, labelled
  as Bangkok time. A Buddhist-era calendar picker waits for a screen whose users need one.
- Role grants pick a factory or company scope through `admin.search`; a dedicated picker comes
  with the partner and company screens (2.6, 2.7).
- Creating notification routes and templates from scratch: the backend seeds the D-143 matrix
  (B4.6), and 2.1 edits, previews, test-sends and publishes what exists.
- The sidebar lists every entry the API sends, so a persona sees F2.2–2.8 screens that answer 404
  until those deliverables land.

### Open questions

- **Backend**: `admin.saved-views`, `admin.search`, `admin.dashboard`, `admin.sod-rules`,
  `admin.staff-directory`, `admin.imports`, `admin.exports`, `admin.menu-entries`,
  `admin.permissions`, and `notifications.unread-and-link` (the rest of `notifications.feed`).
- **Backend**: re-publish the contract under a release tag so `contract.lock.json` can point at it.

---

## F1 Deliverable 1.3 — 2026-09-24

The last layer of the foundation. Nine commits, each with lint, typecheck, unit tests and
build green: status domain → i18n → shells → observability → SEO → realtime & push →
analytics → quality gates → docs.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A status rendered from colour alone | `StatusMeta` requires a tone, an icon *and* a label key; a test asserts all three on all 60 entries |
| A status label that drifts between zones | one `status` namespace, shared like `auth`; a test resolves every `labelKey` in both locales |
| Two statuses in one domain reading identically | a test comparing the Thai labels per map |
| A status the backend adds without presentation | `defineStatusMap<T>()` against the union in `status/contract.ts` — one file to repoint at `Schemas[...]` |
| UI copy hard-coded in JSX | `react/jsx-no-literals` on `src/app`, `src/features` and `src/ui`, plus `no-restricted-syntax` for `aria-label`, `alt`, `title`, `placeholder`; both proven by a fixture suite |
| A malformed ICU message, or a plural with no `other` branch | two new gates in `messages.test.ts`, both verified to fail on a broken message |
| The admin sidebar showing a screen this user may not open | it is built from `AdminMeDto.menu` and nothing else; an e2e test asserts exactly the two entries the mock returns |
| A storefront link that 404s | an e2e test fetches every `href` in the header, footer and nav |
| A canonical claiming every page is the home page | built from `x-packio-path`; an e2e test asserts each locale is canonical to itself |
| `robots.txt` or `sitemap.xml` answering on a `noindex` zone | matched in `src/proxy.ts` before next-intl, gated on `ZONE_CONFIG[zone].indexable`; unit and e2e |
| A sitemap entry that does not exist | an e2e test fetches every `<loc>` |
| Business data in a realtime payload | `parseEvent` keeps three known string fields and drops everything else |
| A notification permission prompt on page load | `usePushSubscription` exposes `enable` and no effect; `mayPrompt` refuses without a meaningful action; an e2e test patches `Notification.requestPermission` and asserts it is never called |
| A service worker quietly caching stale prices or job states | it has no `fetch` handler; an e2e test asserts the absence |
| A misspelt funnel step | `FunnelEvent` is a closed union |
| Personal data in an analytics property | `AnalyticsProperties` is a narrow interface, not `Record<string, unknown>` |
| A Google request before consent | GTM is not rendered at all until the cookie says yes; an e2e test watches the network, with a container id configured so it cannot pass vacuously |
| Initial JS growing further | a Lighthouse ratchet per URL set, pinned above today's figure |

### Bugs this session found and fixed

All eight came from running the thing, not from reading it.

1. **`TooltipProvider` was never in `ZoneProviders`.** Storybook had one in its own decorator,
   so every tooltip story worked — while the first tooltip rendered in the real app, in the
   collapsed admin sidebar, threw and took the whole sidebar down with it.
2. **The notification bell wrapped its trigger in a `<span>`**, so Radix put `aria-expanded` on
   a generic element: a critical `aria-allowed-attr` failure. The button is the trigger now and
   the badge is a sibling.
3. **`DropdownMenu` rendered mutually-exclusive choices as `menuitemcheckbox`** although its own
   doc comment said radio. Theme and language are single-select; a screen reader now hears
   "selected, 2 of 4".
4. **Links to pages F3 has not built did not merely 404.** Next's 404 response to an RSC
   *prefetch* carries no `content-length`, so the browser held each socket open until keep-alive
   expired — `networkidle` became unreachable and a real visitor would have paid for it. The 17
   destinations the shell links to now have real pages.
5. **`account/designs` rendered its own header, footer and `<main id="main">`**, which the new
   storefront layout also provides: two main landmarks and an ambiguous skip link.
6. **Every storefront page claimed the site root as its canonical.** Metadata set in a layout is
   inherited by every page under it, and a layout's `generateMetadata` is not given the
   pathname — so the first version told crawlers the whole site was one page, which is worse
   than no canonical. It reads `x-packio-path` now.
7. **Three of the four new browser→BFF calls were silently 404ing in admin and partner.**
   `ZONE_CONFIG[zone].bffPath` is the *internal* route segment (`/admin/bff`); a browser on the
   admin host asks for `/bff/...` and the proxy adds the prefix. They share `browserBffUrl` now,
   tested against `isUpstreamPathAllowed`.
8. **Consent looked like it worked and did not.** Accepting called `router.refresh()`, but React
   does not execute a `<script>` that arrives during a client-side update — only one present in
   the initial HTML. The DOM looked right and the container never ran. Caught by asserting on
   `dataLayer` rather than on the markup.

And three the *tests* had, each found by deliberately breaking something and watching the test
pass anyway: `http-server`'s default hour of `max-age` served the previous Storybook build; a
`fullPage` screenshot hid three avatars changing colour inside a 1% tolerance; and a Playwright
project registered conditionally exists in the main process but not in the worker.

### The performance budgets are breached, on every route type

Measured 2026-09-24 on a production build with **no** Sentry DSN and no GTM container — the
floor, not the ceiling:

| URL set | Target | Measured | Over |
|---|---|---|---|
| `customer-marketing` | 150 KB | 374 KB | 2.5× |
| `customer-app` | 200 KB | 381 KB | 1.9× |
| `admin` | 250 KB | 363 KB | 1.5× |
| `designer` | 350 KB | 518 KB | 1.5× |
| `partner` | 180 KB | 361 KB | 2.0× |

React 73 KB, Radix ~85 KB across six chunks, next-intl ~29, Lucide 19, app code ~52. Not
Sentry, and not the designer: `/` and a bare placeholder page load the same bundle, so it is
the shared shell. The single largest lever is the storefront header mounting `DropdownMenu`,
`Popover` and `Tooltip` on every page — deferring those three to interaction is worth roughly
half the gap and belongs to F3's storefront-performance work.

The Lighthouse assertions are **ratchets** pinned just above the current figures rather than at
the targets: a gate that is red forever is a gate people learn to ignore, and one that has been
quietly relaxed to green is worse. The documented budgets are unchanged.

### Decisions taken, with reasons

- **All eleven status maps ship now, with their provenance recorded per file.** The contract
  carries no domain enums (B1.3 is auth only) and the decision log has no status tables, so
  order, payment and artwork come from the legacy enumerations (§5.2, admitted by D-005) and
  `document` from `accounting-design.md`; the other seven are marked proposals assembled from
  the F2/F5/F6 vocabulary. They are a request to the backend, logged as `status.enums`, not a
  claim about the contract. Confirmed with the user, who chose this over deferring them.
- **Sentry's browser SDK is 152.7 KB gz, not the ~40 KB estimated when it was scoped.** That was
  measured and put back to the user with the option of restricting it to admin and partner,
  which the zone check makes a one-line change; they chose all three zones. It loads as a
  separate chunk after hydration and is absent entirely from builds with no
  `NEXT_PUBLIC_SENTRY_DSN` — a static import cost 133 KB whether or not a DSN was set, because
  skipping `init()` does not remove the module from the graph.
- **GTM is not loaded until consent, contrary to Google's own guidance.** Consent Mode is
  designed to let the container load and restrict the tags inside it, but fetching
  `googletagmanager.com` is itself a request to Google carrying the visitor's IP, before they
  have agreed to a third-party processor. The e2e test asserting otherwise failed, which is how
  this was decided rather than assumed.
- **First-party funnel events are not gated on cookie consent**, on the reading that they are
  necessary to operate the service, carry no advertising identifier and never leave Packio.
  **This needs legal counsel to confirm before launch** — recorded here rather than assumed
  silently.
- **SSE rather than a websocket or Pusher**, because traffic is one-way, it reconnects itself,
  and it rides the existing BFF — the same cookie and the same allow-list, with no second
  authorisation path to get right. The Pusher driver the env schema allows would sit beside it.
- **The calls whose endpoints are still contract requests use plain `fetch`, not `browserApi`.**
  The typed client only knows paths in `schema.d.ts`; forcing one through with `as never` would
  defeat the check that stops response types being invented (ADR-0006) and would keep compiling
  on the day the real shape lands.
- **`elementOverrides` is not used to exempt `<Kbd>` from the no-literals rule.** It crashes
  eslint-plugin-react 7.37.5 on any declarator with no initialiser. Keycaps are a `KEYCAP`
  constant instead, which is where the ⌘/Ctrl split belongs anyway.
- **The command palette is Radix plus our own ARIA, not `cmdk`.** ADR-0002 fixes the component
  base, and the hard parts — focus trap, scrim, Escape, scroll lock — are what `Dialog` already
  does. The active option is tracked by item **id**, so a changing result set cannot leave
  `aria-activedescendant` pointing at an element that no longer exists.
- **Three e2e helpers retry.** A shell control exists in the server HTML before the JavaScript
  that makes it work has hydrated, and a click in that window is simply dropped. Retrying is
  what a real person does; there is no DOM signal for "hydrated".

### Deliberately not done

- The admin command palette searches nothing and the mega-menu has no catalogue: both need
  endpoints F2 and F3 own. What ships is the shell, its keyboard behaviour and its a11y.
- The full PDPA preferences centre — per-purpose toggles, a record of when consent was given,
  withdrawal — is F3. Only the gate GTM legally needs is here.
- `IDEMPOTENT_PATHS` is still empty: 1.3 adds no irreversible operation.
- The 17 storefront destinations are placeholder pages, replaced by F3 rather than extended.
- Linux baselines for the visual snapshots; the CI job is `continue-on-error` until they exist.
- Firebase and LINE stay plumbed-but-not-wired, as 1.2 left them.

### Open questions

- **Legal**: whether first-party funnel events sit under legitimate interest, or need the same
  consent GA4 does.
- **Backend**: eight new contract requests — `status.enums`, `entity.next-actions`,
  `rum.web-vitals`, `store.sitemap`, `notifications.feed`, `push.subscriptions`,
  `realtime.auth` and `analytics.events`. The realtime one also needs the transport confirmed;
  the client assumes SSE.
- **Product**: the initial-JS gap above is not something F1 can close on its own.

---

## F1 Deliverable 1.2 — 2026-09-23

The app can now talk to `packio-api` — typed, mocked and authenticated. Six commits, each
with lint, typecheck, unit tests and build green: contract pipeline → clients → BFF → auth →
MSW and e2e → docs.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| A hand-edited `schema.d.ts`, or a forgotten `pnpm gen:api` | `pnpm gen:api --check`, its own CI job; proven to fail on an edit |
| Moving to a newer backend contract without anyone noticing | the vendored `contract/openapi.json` is sha256-pinned in `contract.lock.json`; only `--adopt` rewrites both, and it shows up in the PR diff |
| A response type invented by hand | there is nowhere to put one: everything comes from `schema.d.ts` or the marked seed |
| A failed API call that returns rather than throws | `problemMiddleware` throws `ApiError`; a non-problem body still becomes one |
| Admin code calling `/v1/store/...` | `surfaceZone` on `serverApi` refuses it in-process, before the request leaves |
| The browser reaching a surface its zone has no business with | the BFF allow-list, built from `ZONE_CONFIG`, answering 404 |
| A cross-site form post riding the session cookie | `Origin` + `x-packio-csrf` on every non-GET through the BFF |
| A token in JS-readable storage | there is no code path that writes one; the e2e suite asserts `document.cookie` holds neither |
| A back-office screen added without a guard | it inherits `(console)/layout.tsx` by where it is placed |
| A staff password attempted from the browser | `/v1/auth/staff/login` is on no BFF allow-list; it is a Server Action only |
| An OTP a customer cannot paste | one input, `autocomplete="one-time-code"`, asserted in both unit and e2e tests (WCAG 2.2 §3.3.8) |
| A th/en drift in the new `auth` namespace | the existing `messages.test.ts` parity suite, which covers it automatically |

### Bugs this session found and fixed

1. **`maxLength` broke pasting a Thai OTP.** The OTP field stripped non-digits in its change
   handler, but the browser applies `maxLength` to the raw text *first* — so pasting the whole
   SMS, "รหัส OTP ของคุณคือ 123456", was cut to its first six characters and left a single
   digit behind. Exactly the failure WCAG 2.2 §3.3.8 exists to prevent, in the component
   written to satisfy it. The limit now applies after the non-digits are gone.
2. **A successful sign-in navigated to `about:blank`.** The sheet called `onOpenChange(false)`
   on success, and the page hosting it treats a close as a cancel and goes back — so signing
   in undid itself. Closing and signing in are separate events now, and "back" is only taken
   when there is history to go back to, which there is not when someone arrives from an SMS
   link.
3. **The zone catch-alls sat outside the guarded route group**, so an unknown admin path
   answered 404 to anyone and quietly confirmed which paths do not exist. They are inside
   `(console)` now.
4. **`pnpm build` started demanding production secrets.** `next build` imports every route
   module to collect its config, and the BFF chain reached `src/lib/env/server`, which
   validates at module load. `apiInternalUrl()` defers that read; the proxy still validates
   eagerly on every request, so a missing key still fails the deployment at boot with every
   absent key named at once.

### Decisions taken, with reasons

- **The contract is vendored at `contract/openapi.json`.** CI has no sibling checkout of
  `packio-api` and no credentials for a private release asset, so a drift gate that reached
  outside the repo could not be reproducible. `--adopt` is the only command that reaches out,
  and it rewrites the vendored copy and the lock together.
- **The seed contract was a separate document and a separate generated file**, which is what
  made retiring it a single day's work when B1.3 landed mid-deliverable (see below). Nothing in
  it was invented: every path and field came from api-conventions §4, the backend's ADR-0004 or
  its own B1-foundation prompt. Confirmed with the user before starting.
- **Staff sign in with an email.** api-conventions §4 and the master plan both say
  "username/password", but the backend's ADR-0004 said email + password, so the seed followed
  the ADR — and `StaffLoginDto` confirms it. Partner sign-in turned out to be an email too,
  which the seed had guessed as a username.
- **The idempotency key is minted per user intent, not per fetch.** A key generated inside the
  request would be new on every retry, which guarantees the double-submit the header exists to
  prevent. The middleware only fills one in when a flagged call arrives without one; no
  operation is flagged yet, because F1 has none.
- **`refreshSession` returns `null` for every failure, not only a 401.** Refresh tokens are
  single-use and replaying a spent one revokes the whole family, so a token this app is unsure
  about must never be sent twice. Signing someone out is recoverable; guessing is not.
- **`getActor` treats 403 as "not signed in", and re-throws 5xx.** A 403 is a token for the
  wrong audience — exactly what a customer cookie looks like on the admin host. A 500 is not a
  lost session, and calling it one would bounce a signed-in user to a login screen because a
  database was briefly slow.
- **COOP relaxes to `same-origin-allow-popups` on the storefront only.** Firebase's Google and
  Apple sign-in talks to its popup through `window.opener`, which `same-origin` severs: the
  popup completes and the opener never hears, so sign-in hangs with no error. Admin and partner
  have no third-party sign-in and keep full isolation.
- **Firebase and LINE are plumbed, not wired.** UI, server-side exchange endpoints, CSP origins
  and a configured/not-configured check are in place; the SDKs load on click in F3, which the
  master plan already assigns LIFF to. A button that looks live and then fails is worse than
  one that is visibly not on offer. Confirmed with the user.
- **`auth` is the second namespace shared by all three zones.** Every zone signs someone in,
  and "your session has ended" should not drift between them. The unused copy per zone is a
  handful of strings.
- **The OTP field is one input, not six boxes.** Expiry and the resend instant come from the
  challenge; the code length and the attempt count are not in the contract, so they are the two
  open rows in `docs/contract-requests.md` and the length is named once rather than assumed at
  each use.
- **`/account/designs` is deliberately left unguarded.** Designs live in localStorage until F4
  Part B gives them a server-side home, so a guard would remove working behaviour rather than
  protect anything.
- **`docs/contract/api-conventions.md` was re-synced from `packio-api`**, which had added §5
  (Swagger/Scalar documentation requirements) and renumbered Realtime to §6. CLAUDE.md requires
  the two copies to be identical. Confirmed with the user.

### Adopting packio-api B1.3, the same day

The backend published the real auth surface while this deliverable was finishing, so the seed
was retired immediately rather than left to rot: `pnpm gen:api --adopt` pinned contract
`54b2621b`, `mocks/seed-openapi.json` and `schema.seed.d.ts` were deleted, and the one
`SeedPaths` line came out of `src/lib/api/types.ts`. Everything still typed against the seed
then failed `pnpm typecheck`, which is precisely the mechanism ADR-0006 was written for — eight
errors, each a real difference:

| Seed assumed | The contract says | What changed |
|---|---|---|
| partner login `username` + `devicePin` | `PartnerLoginDto`: `email` required, `password` **or** `pin` (+ `deviceId`) | the partner form takes an email, and either credential signs in — a shared shop-floor device can be enrolled with a PIN and no password typed on a shared screen |
| OTP challenge `ref`, `codeLength`, `resendAfterSeconds`, `attemptsRemaining` | `OtpChallengeDto`: `challengeId`, `expiresAt`, `resendAvailableAt` | the resend countdown now reads an instant straight from the API instead of computing one; the reference and the attempt counter left the UI |
| OTP verify by `phone` + `ref` + `code` | `OtpVerifyDto`: `challengeId` + `code` | the number is not sent again, so a code issued for one number cannot be replayed against another |
| OTP request `{ phone }` | `OtpRequestDto`: `phone` + `purpose` | `login` here; the same endpoint serves `link_phone`, which F3 uses to attach a number to a LINE or Firebase account |
| `/me` with `type`, `scopes`, `userCode`, `lineLinked`, `companies` | `AdminMeDto` / `StoreMeDto` / `PartnerMeDto` | `featureFlags` is a string array, `menu` entries are `{ key, path }`, and a customer's linked providers arrive as `identities[]` |
| factories with `id`, `name`, `status` | `FactoryAccessDto`: `factoryId` + `roles` | the partner zone shows roles; a display name is now a contract request, and F5's shell will need it |

Two things the contract does **not** carry are now the only open requests: the OTP code length
and the attempts remaining. The UI names the length once as `OTP_CODE_LENGTH` (6, per
B1-foundation) rather than spelling it into the markup, and `docs/contract-requests.md` asks
for both on the challenge.

The build caught one more: a `"use server"` module may export only async functions, so
`OTP_CODE_LENGTH` could not live beside the actions and moved to its own module.

### Deliberately not done

- No shells: the admin sidebar built from the `/v1/admin/me` menu entitlements, the topbar,
  the command palette and the notification centre are all 1.3. The zone home pages show the
  signed-in actor's name and roles only because that is the smallest thing that proves the
  whole chain works end to end.
- No `src/domain/status` maps, no observability, SEO, web push, realtime or analytics — 1.3.
- No Storybook stories for `OTPInput`, `PhoneInput` or `FormField`; they are covered by unit
  tests with axe. 1.3 adds the visual snapshots.
- No Lighthouse URL set for the login pages: budgets arrive with the real shells in 1.3.
- `IDEMPOTENT_PATHS` is empty. The mechanism and its tests exist; F2–F6 add their own
  operations as they build them.

### Open questions for the backend

B1.3 settled most of what was open. Two rows remain in `docs/contract-requests.md`, both on
`OtpChallengeDto` — the code length and the attempts remaining — plus a display name on
`FactoryAccessDto`, which the partner shell needs in F5. Everything else the UI needs is now in
the contract and read from it: token lifetimes, OTP expiry, the resend instant, and the device
PIN policy, which `PartnerLoginDto` expresses by requiring only the email.

---

## F1 Deliverable 1.1 — 2026-09-23

Three hosts served from one build, each with its own `<html>`, providers, CSP and 404
behaviour. No business screens — the admin and partner pages are placeholders that prove the
rewrite, the layout, the theme and the per-zone messages work end to end.

### What is now enforced rather than advised

| Rule | Mechanism |
|---|---|
| An unknown or forged `Host` picks no zone | `resolveZone` returns `null` → bare 404; there is no default zone |
| `/admin/*` and `/partner/*` are unreachable from outside, on **every** host | `isInternalOnlyPath` in `src/proxy.ts`, before any app code runs |
| A forgotten host or API URL in production | `src/lib/env/server.ts` throws at boot, naming every missing key at once |
| `API_INTERNAL_URL` reaching a client bundle | `import "server-only"` in `src/lib/env/server.ts` |
| A customer screen importing `features/admin` | `no-restricted-imports` (alias form) **and** `import/no-restricted-paths` (resolved form, catches `../../admin/…`) |
| That those two rules are still wired to the right files | `src/lib/zones/eslint-boundaries.test.ts` lints fixture *strings* through the real config |
| `X-Robots-Tag: noindex` on admin and partner, absent on the storefront | `securityHeaders`, unit-tested per zone, asserted again in `e2e/zones.spec.ts` |
| Camera permission on the partner PWA only | `Permissions-Policy` per zone, same two layers |
| A CSP that blocks something the page needs | `e2e/zones.spec.ts` fails on any CSP console violation, on all three hosts |
| The nonce in the CSP is the nonce Next stamped | asserted against the served HTML, not the DOM (see below) |
| A fourth zone half-added | `ZONES` in `src/lib/zones/zones.ts` is the one list; `ZONE_CONFIG` and `ZONE_DEFAULT_THEME` are `satisfies Record<Zone, …>` |

### Bugs this session found and fixed

Both came out of the browser, not the unit tests:

1. **A nonced `style-src` broke every page's styling, silently.** `sonner` injects its 15 KB
   stylesheet from a `document.createElement("style")` at module evaluation (`__insertCSS` —
   no nonce option, no way to opt out), Turbopack does the same for CSS in development, and
   Radix and Konva set `style` attributes, which have nowhere to put a nonce. A nonce in
   `style-src` makes the browser **ignore** `'unsafe-inline'`, so all of it was refused and
   every page logged violations. Styles are now `'self' 'unsafe-inline'` with the reasoning
   written into `src/lib/security/csp.ts`; `script-src` keeps its nonce and
   `'strict-dynamic'`, which is the allowance that matters, and `img-src`/`font-src`/
   `connect-src` still bound where CSS-based exfiltration would have to send anything.
2. **`script[nonce="…"]` can never match.** The CSP spec has browsers blank the `nonce`
   content attribute once the document is parsed, so the obvious assertion — that Next
   stamped the nonce the CSP advertises — passed vacuously as "0 elements, no failure" only
   because it was written as `> 0`. It now reads the served HTML from the response.

### Decisions taken, with reasons

- **The nonce CSP makes every route dynamically rendered, and the F0.2 note about restoring
  static rendering is superseded.** Next cannot statically render a page whose nonce changes
  per request, so moving the `pk_theme` read from `cookies()` into a proxy request header
  would buy nothing — reading a request header is equally dynamic. Confirmed with the user.
  `readThemeChoice` stays as it is. Storefront caching becomes a CDN/ISR question for F3,
  when there are real catalogue pages to cache.
- **next-intl's middleware is kept, not replaced.** It builds its rewrite from
  `new Headers(request.headers)` and forwards them through
  `NextResponse.rewrite(url, { request: { headers } })`, so handing it a header-only clone of
  the request carries `x-nonce`, the CSP and `x-packio-zone` through to the render — and
  locale negotiation, the `Link` alternate-links header and trailing-slash normalisation stay
  its job rather than becoming ours.
- **Host matching ignores the port.** One set of `*_HOST` values therefore serves `pnpm dev`
  (:3000), Playwright (:3100) and Lighthouse CI (:3200) without a per-tool override. A
  trailing root dot and an IPv6 literal are normalised for the same reason a port is: they
  are all ways to present the same host differently to an allow-list.
- **A cross-zone probe gets a bare 404 from the proxy, not a styled page.** No app code runs
  and there is no body, so a probe learns nothing about whether the route exists. A real miss
  *inside* a zone still gets that zone's `not-found.tsx`; `src/app/{admin,partner}/[...rest]`
  exists so Next has a route to attach the miss to — with no `src/app/layout.tsx`, an
  unmatched path has no unambiguous root layout to render in.
- **Hosts and `API_INTERNAL_URL` default only outside production.** `pnpm dev` needs no
  `.env`; production requires them, because a host that silently fell back to `localhost`
  would 404 that whole zone with nothing in the logs. CI therefore sets them rather than
  skipping validation, so the schema is exercised on every build.
- **The access token's expiry is a third cookie (`__Host-pk_ate`), not the JWT's `exp`.** The
  proxy forwards a token it must not need to parse; the API owns the JWT format and is the
  only thing that verifies it.
- **The HTTP half of the refresh is a named seam for 1.2.** `refreshDecision` is pure and
  tested; `refreshSession` returns `null`, which is the real "refresh failed → render
  anonymous" answer rather than a placeholder. Writing the call now would mean hand-writing a
  response shape ahead of `src/lib/api/schema.d.ts`, which CLAUDE.md forbids. Confirmed with
  the user. Nothing sets a refresh cookie before 1.2, so the branch is unreachable today.
- **`global-error.tsx` is bilingual, not translated.** It replaces the whole document,
  including the next-intl provider, so there is no bundle to read and the locale is exactly
  what has just been lost. Two short lines in Thai and English.
- **The e2e suite now runs against a production build locally as well as in CI.** The dev
  CSP legitimately differs (Turbopack's injected styles), so testing `pnpm dev` would give
  false confidence in both directions.
- **`Zone` moved to `src/lib/zones`** and `src/ui/theme/themes.ts` imports it. Which zones
  exist is a platform fact, not a design-system one, and `ZONE_DEFAULT_THEME` now cannot
  drift from the list the proxy resolves against.
- **`@typescript-eslint/no-unused-vars` ignores `_`-prefixed arguments.** A seam like
  `refreshSession(_zone, _refreshToken)` keeps the signature 1.2 needs. Unused *variables*
  are still reported.
- **The ESLint `files` glob is `src/app/**` minus the other two zones, not
  `src/app/[locale]/**`.** A flat-config glob is minimatch, so `[locale]` reads as a
  character class and matches nothing that exists — the fixture test found this. The broader
  glob is also correct: the customer BFF at `src/app/bff` must not import admin features
  either.

### Deliberately not done

- No `pnpm gen:api`, `schema.d.ts`, MSW, `serverApi`/`browserApi`, `createBffHandler`, login
  screen or `getActor` — all F1 1.2. The BFF paths are routed by the proxy and allow-listed
  in `ZONE_CONFIG` (`bffPath`, `apiPrefix`), but no route handler exists yet.
- No real shells: the admin sidebar from `/v1/admin/me` entitlements, the topbar, the command
  palette, the customer header/footer/bottom-nav and the partner bottom nav are all 1.3, as
  are observability, SEO, web push, realtime and analytics.
- Messages stay in the flat `{th,en}/*.json` files, now loaded per zone
  (`ZONE_NAMESPACES`). The per-feature split and the lint rule against hard-coded strings are
  1.3's item 2.
- The Lighthouse URL sets for the admin and partner hosts wait for 1.3: the hosts exist, but
  a placeholder page has no budget worth asserting.
- `TanStack Query` defaults are plain (`staleTime: 30s`, no refetch on focus). 1.2 replaces
  them with retry rules by HTTP status and stale times per resource type, once `ApiError`
  exists to tell a 422 from a 503.

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
