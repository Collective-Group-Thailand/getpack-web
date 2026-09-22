# ADR-0004 — One app, three host-based zones

**Status:** Accepted (2026-09-22) · implemented progressively: F0.1 prepares the shape, F1 creates the zones

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
  always Thai and stays indexable and cacheable. Admin and partner are Thai-only.
- One Docker image serves every host. If traffic or risk ever demands it, the same image
  is deployed twice with a `ZONES` env restricting which hosts it answers — no code change.

## Consequences

- Cookies are host-only, so zones cannot share a session by construction; CSP and SEO
  rules (`noindex` for admin and partner) are set per zone.
- The performance budgets in `docs/performance-budgets.md` are enforced per URL set, which
  is what catches an admin provider leaking into the customer bundle.
- F0.1 removes `src/app/layout.tsx` and moves the customer routes under `[locale]` ahead
  of time, so F1 adds the other two zones without touching the customer tree.
