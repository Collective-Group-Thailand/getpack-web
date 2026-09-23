# ADR-0004 — One app, three host-based zones

**Status:** Accepted (2026-09-22) · implemented in F1 Deliverable 1.1 (F0.1 prepared the shape)

## Context

Packio needs three very different surfaces — a public storefront, a staff back-office and
a shop-floor PWA for partner factories — that nevertheless share one design system, one
set of domain components (status badges, price summary, order timeline, proof viewer, box
designer) and one contract with `packio-api` (D-002).

Three separate frontends would mean three copies of that shared layer, three deployments
and three chances for the status vocabulary to drift. One app with path-based zones
(`/admin/...` on the public host) would share an origin: one cookie jar, one CSP, and a
storefront XSS able to ride a staff session.

## Decision

**One Next.js application, three zones told apart by request host.**

- `src/proxy.ts` (Next 16's replacement for `middleware.ts`) maps the host to an internal
  route segment: `ADMIN_HOST/x` → `/admin/x`, `PARTNER_HOST/x` → `/partner/x`, and returns
  404 for `/admin/*` or `/partner/*` arriving on the customer host.
- **No `src/app/layout.tsx`.** Each zone owns a root layout — `src/app/[locale]/layout.tsx`
  (customer), `src/app/admin/layout.tsx`, `src/app/partner/layout.tsx` — with its own
  `<html>`, providers, theme, font subset and analytics, so admin providers never reach a
  customer bundle.
- Shared code lives in `src/ui`, `src/features/shared`, `src/features/designer`,
  `src/domain`, `src/i18n`, `src/lib`. ESLint import boundaries stop customer code
  importing `features/admin|partner` and vice versa.
- Locale routing is customer-only: Thai at `/`, English at `/en`, detection off so `/` is
  always Thai and stays indexable. Admin and partner carry no locale prefix — their URLs are
  tools, not indexed pages — and take their language from the `pk_locale` cookie instead,
  Thai by default (F1 1.1).
- One Docker image serves every host. If traffic or risk ever demands it, the same image
  is deployed twice with a `ZONES` env restricting which hosts it answers — no code change.

## Consequences

- Cookies are host-only, so zones cannot share a session by construction; CSP and SEO
  rules (`noindex` for admin and partner) are set per zone.
- The performance budgets in `docs/performance-budgets.md` are enforced per URL set, which
  is what catches an admin provider leaking into the customer bundle.
- F0.1 removes `src/app/layout.tsx` and moves the customer routes under `[locale]` ahead
  of time, so F1 adds the other two zones without touching the customer tree.
- With no `src/app/layout.tsx`, an unmatched path has no unambiguous root layout to render
  in, so each zone needs its own catch-all (`src/app/{admin,partner}/[...rest]`) to give
  Next a route to attach a 404 to. Customer misses land inside `[locale]` already.
- The per-request CSP nonce (F1 1.1) makes **every** route dynamically rendered: Next cannot
  statically render a page whose nonce changes per request. Storefront caching is therefore
  a CDN/ISR question, revisited in F3 when there are catalogue pages to cache.
