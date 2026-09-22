# Performance budgets (design-system.md §7) — enforced by Lighthouse CI

| Route type | LCP (p75) | INP (p75) | CLS | JS shipped (gz, initial) | LHCI URL set |
|---|---|---|---|---|---|
| Marketing / catalogue / product (customer zone) | ≤ 2.0 s | ≤ 200 ms | ≤ 0.05 | ≤ 150 KB | `customer-marketing` |
| Checkout / account (customer zone) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 200 KB | `customer-app` |
| Admin list/detail (admin zone) | ≤ 2.5 s | ≤ 200 ms | ≤ 0.1 | ≤ 250 KB | `admin` |
| Designer / 3D (`/design/[id]`) | ≤ 3.0 s to interactive shell | ≤ 200 ms | ≤ 0.1 | ≤ 350 KB, heavy modules lazy | `designer` |
| Partner zone (installable PWA) | ≤ 2.5 s on 4G mid-range | ≤ 200 ms | ≤ 0.1 | ≤ 180 KB | `partner` (mobile preset) |

One root `lighthouserc.json` with the shared assertions and one URL set per row; CI runs `next start` in mock mode (MSW) and hits each host (`localhost`, `admin.localhost`, `partner.localhost`). Because zones have separate root layouts, admin/partner providers must never appear in customer bundles — the budget per URL set catches regressions. Web Vitals RUM is posted through the zone BFF to the API.
