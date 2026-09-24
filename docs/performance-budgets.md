# Performance budgets (design-system.md §7) — enforced by Lighthouse CI

| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) | LHCI URL set |
|---|---|---|---|---|---|
| Marketing / catalogue / product (customer zone) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 150 KB | `customer-marketing` |
| Checkout / account (customer zone) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 200 KB | `customer-app` |
| Admin list/detail (admin zone) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB | `admin` |
| Designer / 3D (`/design/[id]`) | ≤ 3.0 s to interactive shell | ≤ 200 ms | ≤ 0.1 | ≤ 350 KB, heavy modules lazy | `designer` |
| Partner zone (installable PWA) | ≤ 2.5 s on 4G mid-range | ≤ 200 ms | ≤ 0.1 | ≤ 180 KB | `partner` (mobile preset) |

`lighthouse/shared.json` holds the assertions every set inherits; `lighthouse/<set>.json` is one file per row above. `pnpm lhci` (`scripts/lhci.ts`) starts one `next start` in mock mode (MSW) that answers all three hosts and runs each set against it; `pnpm lhci admin` runs one. Admin and partner URLs carry the mock's fixed access token as a cookie, so the real shell is measured rather than a redirect to `/login`. Because zones have separate root layouts, admin/partner providers must never appear in customer bundles — the budget per URL set catches regressions. Web Vitals RUM is posted through the zone BFF to the API.

## Where we actually are (measured 2026-09-24, F1 1.3)

Every route type is currently **over** its budget, so each Lighthouse assertion is pinned as a
**ratchet** just above the measured figure: it stops the number growing while the gap is worked
down. The targets below are unchanged — the ratchet is not the budget, and lowering it as
headroom is won is the job.

| URL set | Target (initial JS, gz) | Measured | Over by |
|---|---|---|---|
| `customer-marketing` | 150 KB | 374 KB | 2.5× |
| `customer-app` | 200 KB | 381 KB | 1.9× |
| `admin` | 250 KB | 363 KB | 1.5× |
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
