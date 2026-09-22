# 00 — Master Plan (frontend): packio-web

> อ่านไฟล์นี้ก่อนทุก session แล้วค่อยเปิด prompt ของ deliverable ที่ได้รับมอบหมาย (F0–F5)
> Repo นี้คือ **frontend อย่างเดียว** — Next.js app เดียวที่รวม customer + admin + partner · backend อยู่ที่ repo `packio-api`

---

## 1. Product
**Packio — Your Packaging Production Partner**, operated by Collective Group (Thailand), is a **new** self-service, end-to-end, fully traceable packaging platform (discover → configure (7 instant types) or RFQ → design with 3D/2D preview → cart → instalments → artwork & proof → production at partner factories → delivery with POD → claim/reorder → full accounting). Legacy Locopack is a logic and UX-inspiration reference only (D-005). This repo delivers every user interface; `packio-api` delivers every behaviour and all data. Business rules live in `docs/decisions.md`.

## 2. Why one app with three zones
One Next.js app gives one design system, one set of domain components (status badges, price summary, timeline, proof viewer, box designer) and one deployment, while zones keep audiences apart:

| Zone | Host (env) | Local dev | Audience / token | Upstream API prefix | Default theme | SEO |
|---|---|---|---|---|---|---|
| customer | `PUBLIC_HOST` | `localhost:3000` | anonymous + `customer` | `/v1/store/*` | system | indexed, th at `/`, en at `/en` |
| admin | `ADMIN_HOST` | `admin.localhost:3000` | `staff` | `/v1/admin/*` | light | `noindex`, no sitemap |
| partner | `PARTNER_HOST` | `partner.localhost:3000` | `partner` | `/v1/partner/*` | light / high-contrast | `noindex`, installable PWA |

- **Host-based zones, not path-based**: `src/proxy.ts` (Next 16 replaces `middleware.ts` with `proxy.ts`) maps the request host to an internal route segment (`ADMIN_HOST/x` → `/admin/x`, `PARTNER_HOST/x` → `/partner/x`) and returns 404 for `/admin/*` or `/partner/*` on the customer host. Each zone therefore has its own origin: cookies are host-only, CSP differs per zone, and a storefront XSS cannot ride a staff session.
- **Separate root layouts** (no `src/app/layout.tsx`): `src/app/[locale]/layout.tsx` (customer), `src/app/admin/layout.tsx`, `src/app/partner/layout.tsx` — each with its own `<html>`, providers, theme, fonts subset and analytics, so admin code and providers never ship to customers.
- The same Docker image serves all hosts. If traffic or risk later demands it, the same image can be deployed twice with a `ZONES` env restricting which hosts it answers — no code change.

## 3. Repository structure (target, after F0)
```
packio-web/
├─ src/
│  ├─ proxy.ts                      host → zone rewrite, 404 cross-zone paths, next-intl (customer), token refresh, CSP nonce, security headers
│  ├─ app/
│  │  ├─ [locale]/                  CUSTOMER zone (root layout) — (marketing) (catalog) configure/ rfq/ design/[id] cart/ checkout/ account/ business/ track/[token] liff/ …
│  │  ├─ admin/                     ADMIN zone (root layout) — (auth)/login  (console)/… every back-office screen
│  │  ├─ partner/                   PARTNER zone (root layout) — onboarding, cost tables, jobs, QC, ship, billing, payouts
│  │  ├─ bff/[...path]/route.ts     customer BFF  → /v1/store/*   (admin/bff and partner/bff are the zone equivalents)
│  │  ├─ robots.ts sitemap.ts       customer host only
│  │  └─ global-error.tsx
│  ├─ features/
│  │  ├─ shared/<domain>/           used by more than one zone (order status header, price summary, timeline, proof viewer, file upload…)
│  │  ├─ customer/<domain>/         catalog, configurator, cart, checkout, account, claims…
│  │  ├─ admin/<domain>/            orders, cs-calculators, catalog-admin, reports, production-board…
│  │  ├─ partner/<domain>/          jobs, scan, ship…
│  │  └─ designer/                  box editor (Konva, 3D preview) — used by customer (edit) and admin (read-only / copy)
│  ├─ ui/                           design system: tokens (TS → generated CSS), Tailwind v4 theme, components, patterns, icons, charts, fonts
│  ├─ domain/                       status presentation (label th/en, tone, icon) keyed by generated API enums; client-side form schemas (zod)
│  ├─ i18n/                         next-intl config, messages/{th,en}/*.json, formatters (formatTHB, Buddhist-era dates, bahtText for display)
│  └─ lib/
│     ├─ api/                       schema.d.ts (generated), clients (server: API_INTERNAL_URL; browser: zone /bff), query keys, error mapping
│     ├─ auth/                      session cookies, login/logout server actions, refresh, current actor
│     ├─ bff/                       createBffHandler(zone) — allow-listed upstream prefixes, token attach, refresh-once, CSRF checks
│     └─ observability/             Sentry, OpenTelemetry, web-vitals
├─ packages/dieline/                framework-free box geometry engine, published as `@packio/dieline` (the only workspace package)
├─ .storybook/  e2e/  mocks/ (MSW handlers generated from the contract + overrides)
├─ docs/  prompts/ contract/ legacy/ adr/ design-tool/ PROGRESS.md contract-requests.md performance-budgets.md
├─ contract.lock.json               pinned backend contract version + source URL + sha256
└─ Dockerfile (standalone)  .github/workflows/ci.yml
```
Import rules (ESLint `boundaries` / `no-restricted-imports`): `app/[locale]/**` and `features/customer/**` may not import `features/admin|partner/**`; `features/admin/**` may not import `features/customer|partner/**`; everything may import `ui`, `features/shared`, `features/designer`, `domain`, `i18n`, `lib`. `packages/dieline` imports nothing from `src/`.

## 4. Data access & auth (BFF pattern — ADR-0005)
- **Server Components** fetch with `serverApi(zone)` (openapi-fetch, `API_INTERNAL_URL`, `Authorization: Bearer <access token from the zone cookie>`, `Accept-Language`). Lists render initial data on the server and hydrate TanStack Query.
- **Client Components** use `browserApi` (same generated types, base URL `/bff`) + TanStack Query. The zone BFF route handler allow-lists upstream prefixes (customer → `/v1/store`, `/v1/auth/customer`; admin → `/v1/admin`; partner → `/v1/partner`), attaches the token, streams the response back (including file downloads), refreshes once on `401`, and requires same-origin `Origin` + header `x-packio-csrf: 1` for non-GET requests.
- **Cookies** (host-only, `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` prefix): `__Host-pk_at` / `__Host-pk_rt` per host (so zones never share them). Access token refresh happens in `proxy.ts` before rendering (Server Components cannot set cookies) and in the BFF.
- **Login flows** are Server Actions/route handlers that call `/v1/auth/*`, set cookies and redirect: staff username/password (admin), customer phone OTP (primary) / Firebase (Google, Apple) / LINE Login & LIFF (customer), partner login + optional device PIN (partner).
- **Authorisation in the UI** reads `/v1/{surface}/me` (roles, permissions, menu entitlements, scopes). The UI hides what the user cannot do; the API is the enforcement point.
- **Server Actions** only for auth and small progressive-enhancement forms; business mutations go through the BFF so errors, idempotency keys and optimistic updates are handled uniformly.
- Realtime (order/payment/chat alerts, production updates) via the API's realtime auth; payloads are ids only → invalidate TanStack Query keys.

## 5. Contract sync with `packio-api` (ADR-0006)
- `pnpm gen:api` reads `API_CONTRACT_SOURCE` (local: `../packio-api/contract/openapi.json`; CI: the release asset pinned in `contract.lock.json`) → `openapi-typescript` → `src/lib/api/schema.d.ts` (committed) → regenerates MSW base handlers in `mocks/generated/`.
- CI fails if the generated file differs from the committed one. Upgrading the backend contract = bump `contract.lock.json` in a PR; type errors show exactly what changed.
- `src/domain/status/*` is typed `Record<Schemas['OrderStatus'], StatusMeta>` etc., so a new backend enum value fails the frontend build until it has a label, tone and icon.
- Missing endpoints → `docs/contract-requests.md` + mock; never invent a shape.

## 6. Platform baseline
Next.js 16 (App Router, RSC, `proxy.ts`), React 19, TypeScript 6 strict, Tailwind v4, pnpm, Node 24 LTS. `src/ui` built on Radix + CVA (ADR-0002), Storybook 10, TanStack Query/Table/Virtual, react-hook-form + zod, next-intl, Zustand (UI state only), Konva + @react-three/fiber (designer), Vitest + Testing Library, Playwright (+ axe), Lighthouse CI, MSW. Sentry, OpenTelemetry, Web Vitals RUM → API.

## 7. Release scope & run order (frontend)
**R1 = public launch** (single launch, no beta — D-110, D-113): everything in `docs/decisions.md` D-110 including cart, B2B, loyalty, campaigns & referral, proof annotations, 3D preview, LIFF, partner zone, finance workspace, demand analytics. **R2** (D-111): card instalments & direct debit, e-Tax sending, partner offline sync, extra operational reports.

| Step | Prompt | Output | Needs from backend |
|---|---|---|---|
| F0 | `F0-setup.md` 0.1 → 0.2 | BoxStudio single app → packio-web structure, pnpm, `@packio/dieline`, rebrand; `src/ui` foundation | nothing |
| F1 | `F1-foundation.md` 1.1 → 1.3 | zones, proxy, root layouts, BFF & auth, contract & mocks, i18n, shells, observability | B1.1 contract (mocks until then) |
| F2 | `F2-admin.md` 2.1 → 2.8 | admin zone (orders, CS, RFQ, prepress, catalogue, partners & cost review, promotions, B2B, discount memos, settings, analytics) | B2–B4, B6 |
| F3 | `F3-storefront.md` 3.1 → 3.7 | customer zone (catalogue, configurator + 3D, RFQ, cart, checkout & instalments, account, B2B, loyalty, referral, tracking, claims, reorder, LIFF) | B2–B4 |
| F4 | `F4-designer.md` A → E | designer v2 + `@packio/dieline` engine, style library, publishing | B4.1 designs API, B2.5 quotes |
| F5 | `F5-partner.md` 5.1 → 5.3 | partner zone PWA | B2.2, B4.2–4.3, B5.3 |
| F6 | `F6-finance.md` 6.1 → 6.4 | finance & accounting workspace in the admin zone | B5 |
F2–F6 run in parallel in separate git worktrees after F1, against MSW mocks until the backend deliverable exists.

## 8. Definition of Done (every screen/flow)
- Lint, typecheck, unit/component, e2e green; axe clean (WCAG 2.2 AA); keyboard path works; performance budgets met (Lighthouse CI).
- Runs against the real backend in the integration environment (not only mocks); no `CONTRACT-REQUEST` mock left for that screen.
- Thai + English strings, no hard-coded copy; statuses via `src/domain/status`.
- Irreversible actions (approve slip, manual start production, cancel, refund, credit note, payout approval, bank-account change, period close, checkout pay) use typed confirmation dialogs that restate order code + amount and send an `Idempotency-Key`.
- `docs/PROGRESS.md` updated: screens done, decisions implemented (D-

## 9. ADRs in this repo
0001 Thai-first typography · 0002 Component base (Radix + Tailwind v4 + CVA) · 0003 Theming via generated CSS variables · 0004 One app, three host-based zones · 0005 BFF, cookies & token handling · 0006 Contract consumption & mocks · 0007 `@packio/dieline` ownership & publishing. (0001–0003 are accepted decisions implemented in F0 Session 0.2; F0 Session 0.1 writes 0004–0007.)
