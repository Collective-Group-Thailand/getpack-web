# AUTORUN-STATE — getpack Points & Deals

- **Status:** P4 in progress (branch `feat/loyalty-p4-cofunding-controls`, both repos), 2026-11-05. Block A (P1 → P1.5 → P2 → P3) DONE.
- **Main:**
  - api `77c1c0a0`: P1 `417b5a47`, P1.5 `15e1ed60`, P2 `dd8d2c7f`, P3 `77c1c0a0`.
  - web `51df1dcb`: P1 `fb9d1796`, P1.5 `136e3733`, P2 `baa9a8ec`, P3 `51df1dcb`.
  - Plus the final docs commit.
- **Branches kept:** `feat/loyalty-p1-activity-rewards`, `feat/loyalty-p15-deals-surface`, `feat/loyalty-p2-lifecycle`
  and `feat/loyalty-p3-catalogue-tiers`, in both repos and in the sibling clones `getpack-*-p1`.
- **Not done here:** full typecheck, migrations on a real database, seeds, `next build`, Storybook, Lighthouse and the
  visual compare. These need the Mac; see REPORT "สิ่งที่คุณต้องทำ". e2e was skipped by the owner (D-503).
- **BLOCKED:** none.
- **Decisions recorded:** D-473 … D-511 (identical in both repos; D-506 … D-511 for P4).
- **Open contract requests:** `store.reviews.reward-preview`, `store.orders.reviewable` (P2 follow-ups).
- **Next:** P4 build — API and web agents in parallel from `plans/P4-PLAN.md` and `API-CHANGES-P4.md` (no e2e, D-511).
- **Resume:** P4 — continue on `feat/loyalty-p4-cofunding-controls`; plan and contract are committed. To fix a Mac gate failure, branch from `main` as `fix/loyalty-<gate>`.
