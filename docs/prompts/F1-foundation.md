# F1 — Foundation: zones, proxy, BFF & auth, contract & mocks, i18n, shells

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `docs/contract/api-conventions.md`, `design-system.md` ก่อน · ต้องทำ F0 เสร็จแล้ว
> ทำทีละ Deliverable ต่อ 1 session (1.1 → 1.3)

---

You are a senior frontend engineer on **`getpack-web`** (getpack — Your Packaging Production Partner). Build the skeleton that every screen depends on. No business screens yet.

## Deliverable 1.1 — Zones, proxy, root layouts, security headers
1. Env schema (zod, validated at boot, server/client split): `PUBLIC_HOST`, `ADMIN_HOST`, `PARTNER_HOST`, `API_INTERNAL_URL`, `API_CONTRACT_SOURCE`, `NEXT_PUBLIC_ASSET_BASE_URL` (S3/CDN), `NEXT_PUBLIC_REALTIME_*`, `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `SENTRY_*`, `ZONES` (optional allow-list), `NEXT_PUBLIC_ENV_BADGE` (UAT/PROD).
2. `src/proxy.ts`: resolve zone from `Host` (with local `*.localhost` support); rewrite admin/partner hosts to `/admin/*` / `/partner/*`; 404 `/admin/*`, `/partner/*`, `/bff/*` of another zone on the wrong host; next-intl on the customer host only (`th` default no prefix, `en` at `/en`); per-zone CSP with nonce (admin/partner stricter: no third-party analytics), `X-Robots-Tag: noindex` on admin/partner, HSTS, `Referrer-Policy`, `Permissions-Policy` (camera allowed only on partner); access-token refresh before rendering when the access cookie is missing/near expiry and a refresh cookie exists.
3. Three root layouts (`src/app/[locale]/layout.tsx`, `src/app/admin/layout.tsx`, `src/app/partner/layout.tsx`) with zone providers (theme cookie `pk_theme` per host, next-intl, TanStack Query, toasts), fonts from `src/ui/fonts`, error boundaries per segment, `not-found`, `global-error`. Admin/partner locale comes from a cookie (th default) rather than a URL prefix.
4. ESLint zone boundaries (master plan §3) with a failing fixture test proving the rule works.
5. Tests: unit tests for host → zone resolution; Playwright: each host renders its placeholder shell; `/admin` on the customer host → 404; admin responses carry `noindex`.

## Deliverable 1.2 — Contract, API clients, BFF, auth
1. `pnpm gen:api` (reads `API_CONTRACT_SOURCE`, verifies sha256 from `contract.lock.json`, runs `openapi-typescript` → `src/lib/api/schema.d.ts`, generates MSW base handlers into `mocks/generated/` seeded from the **examples in the contract** (§5), falling back to obviously fake data; error-path handlers generated from each operation's documented problem codes); CI contract-drift job enabled. If the backend contract is not ready, bootstrap with the auth + `me` endpoints described in `docs/contract/api-conventions.md` §4 as a hand-written seed contract in `mocks/seed-openapi.json`, clearly marked, replaced as soon as `getpack-api` B1.1 publishes.
2. `serverApi(zone)` and `browserApi` (openapi-fetch) with: `Accept-Language`, request id, problem-details → typed `ApiError` (`code`, `detail`, field `errors` mapped onto react-hook-form), automatic `Idempotency-Key` for flagged operations, `If-Match` support, query-key factory, TanStack Query defaults (retry rules by status, stale times per resource type).
3. `createBffHandler(zone)` for `src/app/bff`, `src/app/admin/bff`, `src/app/partner/bff`: upstream prefix allow-list, token attach, one refresh-and-retry on `401`, cookie rotation, streaming passthrough (downloads, SSE), same-origin + `x-getpack-csrf` check on non-GET, body size limit, no caching of authenticated responses.
4. Auth: staff login page + Server Action; customer sign-in sheet with phone OTP (D-143 SMS) (OTP paste allowed, resend timer, rate-limit messages), Firebase (Google/Apple) and LINE Login/LIFF; partner login (username/password or magic link, optional device PIN stub); logout everywhere; `getActor(zone)` helper reading `/v1/{surface}/me` (cached per request); route guards in layouts (admin/partner require a session; customer account pages redirect to sign-in with return URL).
5. Tests: Vitest for BFF (allow-list, CSRF, refresh-once, cookie flags `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`); Playwright on MSW: staff login → admin shell shows name + role; customer OTP login → account page; a customer cookie never authenticates on the admin host.

## Deliverable 1.3 — Shells, i18n, domain presentation, observability, quality gates
1. **Shells** from `src/ui` AppShell:
   - Customer: header (getpack logo from tokens, mega-menu placeholder, search, account, cart, LINE chat button), footer (help, contact, payment methods, PDPA/terms), mobile bottom nav (Home, Products, Design, Orders, Account).
   - Admin: collapsible sidebar built from the **menu entitlements returned by `/v1/admin/me`** (no hard-coded role checks), topbar (global search, command palette ⌘K/Ctrl+K skeleton, notification centre, language, environment badge, user menu), breadcrumbs, `?` shortcuts overlay.
   - Partner: shell with bottom nav and big targets — built out in F5.
2. **i18n**: messages split per zone and feature (`src/i18n/messages/{th,en}/{common,customer,admin,partner}/*.json`), ICU plurals, lint rule blocking hard-coded UI strings, glossary file for packaging terms (th ↔ en).
3. **Domain presentation**: `src/domain/status/{order,payment,instalment,artwork,proof,rfq,job,shipment,claim,payout,document}.ts` typed against generated enums (string enums from the contract), `StatusBadge` usage everywhere, next-action helpers that only interpret API-provided `nextActions` (the API decides; the UI renders).
4. **Observability**: Sentry (per zone DSN tags), OpenTelemetry fetch instrumentation propagating `traceparent` to the API, Web Vitals RUM posted through the BFF, request id shown in error states for support.
5. **SEO base (customer only)**: `robots.ts`/`sitemap.ts` answering only on `PUBLIC_HOST` (sitemap data from the API), canonical + hreflang helpers, Organization structured data (getpack, operated by Collective Group (Thailand)). No legacy URL redirects (D-005).
6. **Web push & realtime**: service worker for web push on customer and partner hosts (VAPID, permission prompt only after a meaningful action), realtime client (ids only → TanStack Query invalidation), in-app notification centre in all zones (D-143).
7. **Analytics events** (D-102): typed event helper posting page views and funnel steps through the BFF with consent mode; GTM/GA4 on the customer host only.
8. **Quality gates** wired: Lighthouse CI with URL sets per zone (`docs/performance-budgets.md`), axe in Playwright for every shell, Storybook visual snapshots for shells.
9. `docs/PROGRESS.md` entry.
