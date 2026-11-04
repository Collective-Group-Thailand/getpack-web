# getpack Points & Deals — REPORT

_Updated 2026-11-05 · autorun Block A finished (P1 → P1.5 → P2 → P3)._

## Status

| Phase | Status | Merge on main | Commits (api / web) |
|---|---|---|---|
| P1 — Onboarding earn + checklist | **MERGED** · Mac gates pending | api `417b5a47` · web `fb9d1796` | 13 / 8 + integration |
| P1.5 — Deals surface | **MERGED** · Mac gates pending | api `15e1ed60` · web `136e3733` | see `API-P15-NOTES.md` / `WEB-P15-NOTES.md` |
| P2 — Lifecycle, segments, analytics | **MERGED** · Mac gates pending | api `dd8d2c7f` · web `baa9a8ec` | see `API-P2-NOTES.md` / `WEB-P2-NOTES.md` |
| P3 — Catalogue, tiers, perks, capacity deals | **MERGED** · Mac gates pending | api `77c1c0a0` · web `51df1dcb` | 19 / 18 |
| P4 — Factory co-funding and programme controls | **BRIEF ONLY** (below) | — | — |

- **Scope:** the owner merged phases into main in the workspace (2026-11-04) and dropped e2e runs (D-503: e2e is
  written up to P2 and not written for P3).
- **Since the plan commit:** main moved api `b61cd4ae` → `77c1c0a0` (67 commits) and web `24fd4035` → `51df1dcb`
  (64 commits, plus this report). Every commit is authored and committed by Superball <Piyapan.pa@abbon.co.th>, with
  no trailers.
- **Not pushed, nothing deployed.**
- **Main repos:** getpack-api's checkout is still on your branch `chore/home-photos-auto` with your WIP untouched.
  `main` was updated by fetch only. getpack-web's `main` fast-forwarded; your `next-env.d.ts` change and
  `docs/design/agent-portal/` were left as they were.
- **Decisions:** D-473 … D-505 are identical rows in both repos' `docs/decisions.md`.
- **Contract:** web uses the generated client for every P1–P3 operation. Two P2 asks stay open as contract requests:
  - `store.reviews.reward-preview`;
  - `store.orders.reviewable`.
- **Migrations to apply on the Mac (in order):**
  1. `20270101000003_loyalty_activity_rewards`
  2. `…04_promotions_deals_surface`
  3. `…05_loyalty_p2_entry_types`
  4. `…06_loyalty_p2_lifecycle`
  5. `…07_loyalty_p3_enums`
  6. `…08_loyalty_p3_catalogue_tiers`
  7. `…09_loyalty_p3_coupon_return`

### Gates

| Gate | Workspace (Linux VM) | Mac |
|---|---|---|
| Lint, Prettier, targeted tsc on touched files | pass, every phase | full `pnpm typecheck` (out of memory here) |
| Unit tests (API) / Vitest (web) | pass (web 90 files / 681 tests at P3 integration) | re-run `pnpm test` |
| `gen:api --check`, registry, `contract:lint` | pass | `pnpm contract:build`. The contract here is a no-check emit: commit it if it differs. |
| Migrations, seed ×2, UAT seed, drift check | not run (no Postgres) | **required** |
| `next build`, Storybook build, Lighthouse, prototype-vs-page compare | not run | **required** |
| e2e | skipped by the owner | optional (P1–P2 specs exist; P3 has an e2e debt list in `API-P3-NOTES.md`) |

## สิ่งที่คุณต้องทำ

1. **getpack-api บน Mac** (Node 24 และ Docker เปิดอยู่) บน `main`:
   ```
   pnpm install
   pnpm prisma:generate
   pnpm typecheck && pnpm lint && pnpm test
   pnpm contract:build && pnpm contract:lint     # ถ้า contract/openapi.json เปลี่ยน ให้ commit
   pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema --exit-code
   pnpm db:migrate                               # migration 03 → 09
   pnpm db:seed && pnpm db:seed                  # รอบสองต้องไม่เพิ่มอะไร
   UAT_SEED_CONFIRM=uat-only pnpm db:seed:uat && UAT_SEED_CONFIRM=uat-only pnpm db:seed:uat
   pnpm launch:settings                          # SETTINGS-REVIEW.md ต้องไม่เปลี่ยน
   pnpm build
   ```
2. **getpack-web บน Mac** บน `main`:
   ```
   pnpm install
   pnpm gen:api --check
   pnpm typecheck && pnpm lint && pnpm test
   pnpm build && pnpm build-storybook
   pnpm dev:mock
   ```
   - เปิดหน้าตามรายการใน `WEB-P3-NOTES.md` §6
   - เทียบกับ `prototypes/p*-*.html` ที่ 1440 และ 390 (light) และ 390 (dark)
3. **ถ้ามีอะไรล้ม** ให้ส่ง log มา ผมจะแก้บน branch ใหม่แล้ว merge ให้
4. **ก่อนเปิดใช้จริง**:
   - ยืนยันอัตรา expected redemption 60 % กับ CPA (D-480, `pending_cpa`)
   - ให้ Marketing มีสิทธิ์ใน approval policy `loyalty_reward_review` และ `capacity_deal_publish`
   - สร้างรายการรางวัล `free_shipping` และ `free_rush` ใน production (UAT seed ไว้แล้ว) เพราะ perk รายไตรมาสต้องใช้
   - ตั้ง `loyalty.*` / `promotions.capacity_deal` / `b2b.credit_tier_uplift` ใน admin settings แล้วให้ Finance ตรวจ
5. **อยากให้ทำ P4 ต่อเมื่อไหร่ บอกได้เลย** บรีฟอยู่ข้างล่าง

## Decisions taken as head of team (owner-delegated)

- **"แต้ม" everywhere** for loyalty points; review stars keep "คะแนน".
- **Liability:** activity rewards count in the points liability.
- **/account:** shows one banner, by priority.
- **Finance:** reads loyalty analytics, read-only (D-496).
- **Contrast:** used-ticket text meets AA.
- **Margin guard (D-504):** a deal that would sell below actual cost plus the whole promotion stack is refused.
- **Coupon return on cancel (D-505):** a reward coupon comes back when its order is cancelled before production. If
  the coupon has expired by then, the points come back instead.
- **No points math in the web:** the API returns `balanceAfter` (`store.rewards.preview`).
- **Ticket design:** system green (D-486). Amber is used only for one small badge.

## P1 — Onboarding earn + checklist

- **Customer:** activity rewards for profile, phone, packaging profile, LINE OA, identity links, brand kit and team
  member.
- **Cap and review:** a cap of 1,500 baht (DEC-4), with held rewards going through `loyalty_reward_review`.
- **Surfaces:**
  - the "ทำสิ่งนี้รับแต้ม" checklist on `/account/points`;
  - a banner on `/account`;
  - `/liff/points`;
  - `/account/packaging-profile`;
  - the "+N แต้ม" toast.
- **Details:** `API-P1-NOTES.md`, `WEB-P1-NOTES.md`, `screenshots/P1/`.

## P1.5 — Deals surface

- **Customer pages:**
  - `/deals`;
  - the deal card (ticket, vertical and compact);
  - the PDP badge and volume ladder;
  - the cart coupon picker (`applicable-codes`);
  - `/liff/deals`;
  - quote recovery, which needs marketing consent (D-487).
- **Admin:** promotion Visibility/Display tab with hero upload, plus report columns.
- **Details:** `*-P15-NOTES.md`, `screenshots/P15/`.

## P2 — Lifecycle, segments, analytics

- **Lifecycle and segments:** lifecycle messages, segment audiences for promotions, the "For you" surface and a
  review/survey earn.
- **Analytics:** loyalty analytics for Marketing and Finance (read-only, D-496).
- **Decisions:** D-488 … D-496.
- **Details:** `*-P2-NOTES.md`, `screenshots/P2/`.

## P3 — Catalogue, tiers, perks, capacity deals

- **Customer:**
  - reward catalogue at `/account/points/redeem` (confirm sheet using `store.rewards.preview`, "คูปองของฉัน",
    cancel within `cancelWindowDays`);
  - a points tab on `/deals`;
  - the tier panel and quarterly perks;
  - early-pay bonus as a separate `earn_bonus`.
- **Admin:**
  - reward catalogue and redemptions;
  - campaigns;
  - capacity deals (draft → `request_publish` → `capacity_deal_publish` approval → publish);
  - credit tier uplift for Finance;
  - the six P3 setting keys in `LoyaltySettings`.
- **API rules:** `rush_unavailable` reason, paginated `{data, meta}` admin lists, margin guard (D-504), coupon
  return (D-505).
- **Decisions:** D-497 … D-505.
- **Details:** `*-P3-NOTES.md`, `API-CHANGES-P3.md`, `screenshots/P3/`.

## P4 brief — factory co-funding and programme controls (not started)

Agreed with the owner on 2026-11-04. getpack funds 100 % of discounts and points by default. Factories never have to
co-fund.

1. **Voluntary factory co-funding, capacity deals only.**
   - **Who and what:** a factory may offer to fund a share of a capacity deal for its own idle capacity. Nothing else
     can be co-funded: no platform coupons, points or tier perks.
   - **Terms:** agreed per deal as a percentage or a baht amount per order, with a cap. The factory accepts them in the
     partner portal.
   - **Approval:** the capacity-deal approval shows both sides' share.
   - **Payout:** the factory's share is netted from its payout for the order. The payout statement shows it on a
     separate line.
   - **Cancel or refund:** the share is reversed with the order.
   - **Accounting:** needs an entry type and a CPA review of how the share is treated (a discount from the supplier
     versus a marketing contribution), and of VAT and the withholding tax effect.
   - **Confidentiality:** customers never see which factory funded a deal. This stays within the existing
     storefront-factory confidentiality spec.
   - **Reporting:** per-deal funding split in loyalty analytics (Finance read-only).
2. **Monthly programme budget.**
   - A budget for points issued, coupons and perks, set in settings.
   - Alerts to Marketing and Finance at 80 % and 100 %.
   - At 100 %, new discretionary campaigns pause; earned points and issued coupons are never revoked.
3. **First-time rewards per company.** Sign-up and activity rewards count once per company (verified tax id) as well
   as once per account. This stops multi-account farming.
4. **Feature flags per surface.** `/deals`, the redeem catalogue, tier perks, capacity deals and LIFF surfaces can each
   be switched off without a deploy.
5. **Phased rollout.** Internal accounts first, then UAT customers, then about 10 % of companies, then everyone. Each
   step is gated on the loyalty analytics: redemption rate, liability, margin after promotions.

The margin guard on actual cost (D-504) is already in P3 and applies to co-funded deals too.

## Files

- **Plans:** `PLAN.md`, `LOYALTY-AUTORUN.md`, `plans/P*-PLAN.md`.
- **Phase notes and API changes:** `API-CHANGES-P*.md`, `API-P*-NOTES.md`, `WEB-P*-NOTES.md`.
- **Design:** `DESIGN-NOTES.md`, `stitch/`, `prototypes/`, `screenshots/`.
- **State and visual summary:** `AUTORUN-STATE.md`; `report.html` is the visual summary of this report.
