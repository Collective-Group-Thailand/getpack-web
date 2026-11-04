# P3 — Catalogue, tiers, campaigns, capacity deals · plan

Branch `feat/loyalty-p3-catalogue-tiers` (both repos, from `main` with P1, P1.5 and P2). Source: PLAN §2.3 (Phase 3
rows), §3.5.6, §4, §5, §7 Phase 3, §9.7; `LOYALTY-AUTORUN.md` block A "Phase-specific musts" P3; contract
`API-CHANGES-P3.md`. Decisions: D-473…D-496 (unchanged) and **D-497…D-503** (this phase, owner delegated 2026-11-04).

**Owner instruction for P3: no e2e.** No e2e spec is written, extended or run in either repo (D-503). Unit tests,
Storybook, i18n, typecheck, lint, build, contract and the wording/confidentiality greps stay in the gate.

## 0. Decisions applied (owner delegated; rows in `docs/decisions.md`)

| D | Decision |
|---|---|
| D-478 / D-479 / D-485 | Platinum, catalogue items and the credit-limit uplift as decided in P1 — detailed below. |
| D-497 | **Benefit schema v2**: adds `free_sample`, `free_rush`, `free_addon` (with `addonCode`), `revision_round`; `free_shipping` gains an optional `maxAmount`. Every v2 kind is applied by the checkout pipeline (money kinds as line discounts, `free_rush` / `revision_round` as perks the order keeps). A v1 benefit stays v1. |
| D-498 | **Reward catalogue mechanics**: each item is backed by a hidden system promotion; redeeming writes a negative `redeem` ledger entry (FIFO lots) and one per-customer single-use coupon valid 90 days; the customer may cancel an unused coupon within 7 days → `redeem_reversal`; posting P11 at redemption, the coupon's discount posts to 4930 through P09, an unused coupon that expires releases 4930 to 4990 (P12C). Never cash-out or transfer. |
| D-499 | **Full loyalty campaigns in `earnForOrder`**: admin campaigns by date window, product types, audience (conditions v2 `audience`) and reason; only the best matching campaign counts; anniversary month ×2; early pay ×1.2; QR / transfer ×1.2 (P2) unchanged; the ×3.00 combined cap (D-495) holds over all factors. |
| D-500 | **Tier perks**: Platinum ≥ ฿500,000 / 12 m ×2; perks through `tier_perk_grants` (one per user × tier × quarter × perk); Silver 1 free-shipping coupon / quarter; Gold free shipping on every order (system automatic promotion), priority support tag; Platinum = Gold + 1 free-rush coupon / quarter + priority production slot (planner flag only). 30-day terms and a named account manager are not automated in P3. |
| D-501 | **Credit-limit tier uplift (implements D-485)**: company tier from the company's own 12-month spend; uplift = base × 1.5 (Gold) / × 2 (Platinum), auto up to ฿1,000,000; above → capped auto version + Finance prefilled request through `credit_limit` (D-449/D-451); Finance override modes `auto | frozen | off`; setting disabled by default, enabled only by the UAT seed. |
| D-502 | **Capacity-driven deals**: the outlook comes from D-101 weekly capacity − bookings aggregated per product type (never per factory) behind a `CapacityOutlookProvider` interface; the worker drafts a hidden `automatic` promotion; visibility can leave `hidden` only after the `capacity_deal_publish` approval (Marketing, the drafter cannot approve). |
| D-503 | **P3 test scope and P&L**: e2e skipped by the owner for P3 (unit tests only); the executive P&L points-liability memo from P2 (D-495) already covers P3 redemptions — no change. |

## 1. Scope

| # | Item | Repo |
|---|---|---|
| 1 | **Migrations** (§3): enums first (`loyalty_tier` + `platinum`, campaign kind `admin_rule` / `anniversary`, reward enums, credit-limit `origin`, promotion `origin`), then tables `reward_catalog_items`, `reward_redemptions`, `tier_perk_grants`, `capacity_deal_drafts`; columns on `loyalty_campaigns`, `company_credit_limits`, `company_credit_limit_versions`, `promotions`, `orders`. | api |
| 2 | **Settings** (§2): `loyalty.tiers` v+1 (Platinum), `loyalty.tier_perks`, `loyalty.rewards`, `loyalty.order_multipliers` v+1 (anniversary, early pay), `promotions.free_rush`, `promotions.capacity_deal`, `b2b.credit_tier_uplift`; `SETTINGS-REVIEW.md`, `setting-keys.ts`. | api |
| 3 | **Benefit schema v2** in `promotion-schemas.ts`, `promotion-engine.ts` (money + perks), `benefit-summary.ts`, `deals.ts`, `promotions.dto.ts`; checkout application: `free_sample` on sample lines (the `samples` extension runs before promotions), `free_addon` priced as the delta of the addon through the quote engine, `free_rush` → `orders.priority_production` + shorter promised ship date when `CapacityService.nextAvailable` allows, `revision_round` → extra free rounds on the order's design request (`design-services`). | api |
| 4 | **Reward catalogue**: `rewards.service.ts` (list, redeem, cancel, expire), system promotion per item (`systemKey = reward.<code>`), coupon issue, ledger `redeem` / `redeem_reversal` with `meta.rewardRedemptionId`, posting P11 (catalogue context) and new rule P12C; store + admin controllers; UAT seed of the 8 items. | api |
| 5 | **Campaigns**: `loyalty_campaigns` columns for admin rules; `campaignMultiplierFor()`, `anniversaryMultiplier()`, `earlyPayMultiplier()` in `order-multipliers.ts` / `points-math.ts`; early pay applied when the pending `earn_order` is credited (`creditDue`); admin CRUD + actions. | api |
| 6 | **Tiers and perks**: Platinum in `tierFor`; `recalculateTiers` grants perks at quarter start and on upgrade (idempotent `tier_perk_grants`); system promotion `tier.free_shipping` (automatic, hidden, audience tiers gold + platinum); `priority_support` tag on conversations / CS inbox; `priority_production` planner flag on Platinum orders' production jobs; `store.loyalty.get` tier + perks. | api |
| 7 | **Credit-limit uplift**: `credit-uplift.service.ts` + job `b2b.credit_tier_uplift`; versions with `origin`; `admin.companyCredit.setUpliftMode`, `admin.creditUplifts.list`; notification `credit_limit.tier_uplift`; `admin.companyCredit.get` echoes base / origin / mode. | api |
| 8 | **Capacity deals**: `CapacityOutlookProvider` (default `CapacityBookingsOutlook` over D-101 data; `DisabledCapacityOutlook` when the setting is off), worker `promotions.capacity_deals`, approval policy `capacity_deal_publish`, publish-guard rule `approval_required`, `admin.capacityDeals.list`. | api |
| 9 | **Deals points tab**: `store.promotions.listPublic` `tab=points` returns the reward catalogue as cards (`kind: reward`), `counts.points` real. | api |
| 10 | **Notifications + events + realtime** (§5). | api |
| 11 | **Contract**: OpenAPI regenerated, spectral clean, confidentiality spec over every new store response, posting-rule spec (P11 catalogue, P11R, P12C). | api |
| 12 | **Web**: `pnpm gen:api`; prototype first for `/account/points/redeem`; screens §6; i18n th + en; Storybook; MSW mocks; vitest. | web |
| 13 | **Docs**: decisions D-497…D-503 (identical both repos), `accounting-design.md` §5 note (P11 catalogue, P12C), `PROGRESS.md`, `REPORT.md` P3 section, `API-P3-NOTES.md`, `WEB-P3-NOTES.md`. | both |

Out of scope (recorded): Platinum 30-day terms and named account manager (manual, Finance / Sales already own them);
applying a `revision_round` coupon to an extra-revision charge raised after the order (only at checkout); company-level
points (D-473).

## 2. Settings (effective-dated, audited, description + decisions; seed is idempotent, `amendInForce` only while the value in force is still the seed's)

| Key | Value (seed) | Owner | D |
|---|---|---|---|
| `loyalty.tiers` (new version) | member 0 ×1 · silver 50,000.00 ×1.25 · gold 200,000.00 ×1.5 · **platinum 500,000.00 ×2** | marketing | D-134, D-478 |
| `loyalty.tier_perks` | `{ "silver": { "quarterly": [ { "item": "free_shipping", "qty": 1 } ] }, "gold": { "freeShippingEveryOrder": true, "prioritySupport": true, "quarterly": [] }, "platinum": { "freeShippingEveryOrder": true, "prioritySupport": true, "priorityProductionSlot": true, "quarterly": [ { "item": "free_rush", "qty": 1 } ] }, "grantOnUpgrade": true }` | marketing | D-500 |
| `loyalty.rewards` | `{ "couponValidityDays": 90, "cancelWindowDays": 7, "maxOpenPerItem": 2, "expiryReminderDaysBefore": 7 }` | marketing | D-498 |
| `loyalty.order_multipliers` (new version) | P2 value + `"anniversary": { "multiplier": "2.00" }`, `"earlyPay": { "multiplier": "1.20", "minDaysBeforeDue": 1 }`, `"campaigns": { "best": "single" }`; `maxCombined` stays `3.00` | marketing | D-495, D-499 |
| `promotions.free_rush` | `{ "daysSaved": 2 }` | operations | D-497 |
| `promotions.capacity_deal` | `{ "enabled": true, "minFreePct": 30, "discountPct": 5, "leadTimeDaysSaved": 3, "horizonWeeks": 1, "minWeeklyCapacityUnits": 1, "validityDays": 7 }` | marketing | D-502 |
| `b2b.credit_tier_uplift` | `{ "enabled": false, "factors": { "gold": "1.50", "platinum": "2.00" }, "capAmount": "1000000.00", "spendBasis": "company_12m" }` — **UAT seed sets `enabled: true`** | finance_manager | D-485, D-501 |

`LoyaltySettings.tsx` edits the loyalty keys; the credit uplift key is edited in the Finance settings screen
(`finance_manager`). Every rate or threshold above is a setting, never a constant.

## 3. Migrations (hand-written guards, commented DOWN; names follow `20270101000006`)

**`20270101000007_loyalty_p3_enums`** (enum additions only; `ALTER TYPE … ADD VALUE` cannot share a transaction with
their use):
- `loyalty_tier` + `platinum`;
- `loyalty_campaign_kind` + `admin_rule`, `anniversary` (the P2 `admin` value is kept, unused);
- new `reward_item_kind` (`cash_off`, `free_shipping`, `free_sample`, `free_rush`, `free_addon`, `revision_round`),
  `reward_item_status` (`draft`, `active`, `paused`, `archived`), `reward_redemption_status` (`issued`, `used`,
  `cancelled`, `expired`), `reward_redemption_source` (`catalogue`, `tier_perk`);
- new `credit_limit_origin` (`request`, `tier_uplift`, `tier_uplift_override`), `credit_uplift_mode` (`auto`,
  `frozen`, `off`);
- new `promotion_origin` (`manual`, `system`, `capacity_deal`).

**`20270101000008_loyalty_p3_catalogue_tiers`**:
- `reward_catalog_items`: id, public_id, code (unique, `^[a-z0-9_]{3,40}$`), kind, name jsonb {th,en},
  description jsonb, cost_points int (CHECK 1–100000), value jsonb (benefit v2 of the backing promotion), constraints
  jsonb (`minOrderValue`, `productTypeCodes`, `perUserEveryMonths`, `addonCode`), tier_required `loyalty_tier` null,
  validity_days smallint (CHECK 7–365), active_from, active_to (CHECK to > from), status, sort_order, promotion_id
  (FK, unique — the backing system promotion), created/updated by/at, row_version. Partial unique index on
  `sort_order` per status `active`.
- `reward_redemptions`: id, public_id, user_id, item_id, source, points_spent int (CHECK ≥ 0; 0 for tier perks),
  points_entry_id (FK unique, null for perks), reversal_entry_id (FK unique, null), coupon_code_id (FK unique, not
  null), status, cancellable_until, expires_at, used_order_id null, cancelled_at, cancelled_by, cancel_reason,
  item_snapshot jsonb, created_at. CHECK: `source = 'catalogue'` ⇔ `points_entry_id IS NOT NULL`; `status =
  'cancelled'` ⇒ `reversal_entry_id IS NOT NULL` when `source = 'catalogue'`. Index (user_id, item_id, created_at
  desc) for the frequency rule. Append-only trigger except the status transition columns.
- `tier_perk_grants`: id, user_id, tier, period (`YYYY-Qn`, CHECK pattern), perk_code, redemption_id (FK unique),
  granted_at; **unique (user_id, tier, period, perk_code)** — the idempotency key (per user, tier and quarter).
- `capacity_deal_drafts`: id, product_type_id, week_start date, free_pct numeric(5,2), promotion_id FK unique,
  approval_request_id FK null, provider text, created_at; unique (product_type_id, week_start). Internal only.
- `loyalty_campaigns` + `name` text, `product_type_codes text[]`, `audience jsonb`, `audience_schema_version`
  smallint, `cancelled_by`; CHECK `applies_to = 'earn_order'` kept; CHECK `kind = 'admin_rule'` ⇒ `user_id IS NULL
  AND reason IS NOT NULL`; multiplier CHECK stays 1 < m ≤ 5.
- `company_credit_limits` + `uplift_mode credit_uplift_mode NOT NULL DEFAULT 'auto'`, `uplift_mode_reason`,
  `uplift_mode_set_by`, `uplift_mode_set_at`.
- `company_credit_limit_versions` + `origin credit_limit_origin NOT NULL DEFAULT 'request'`, `base_version_id` FK
  self null (the base it was derived from), `uplift_factor numeric(4,2)` null, `company_tier loyalty_tier` null;
  CHECK `origin = 'request'` ⇔ `base_version_id IS NULL`; CHECK `origin = 'tier_uplift'` ⇒ `limit_amount ≤ cap at
  write` is enforced in the service (the cap is a setting).
- `promotions` + `origin promotion_origin NOT NULL DEFAULT 'manual'` (existing `system_key` rows → `system`).
- `orders` + `priority_production boolean NOT NULL DEFAULT false`, `priority_reason text` null (`free_rush |
  platinum_slot`), CHECK reason present ⇔ flag true.
- `points_ledger`: `meta.rewardRedemptionId` on `redeem` / `redeem_reversal` rows of the catalogue; partial unique
  index on `(meta->>'rewardRedemptionId')` per entry type.

## 4. Workers (`@ScheduledJob`, Bangkok time, lease + retries as existing jobs)

| Job | Schedule | Does |
|---|---|---|
| `loyalty.recalculate_tiers` (changed) | daily (unchanged) | Platinum; on the first run of a quarter (and on an upgrade when `grantOnUpgrade`) writes `tier_perk_grants` + perk coupons; emits `loyalty.perk_granted`. Never revokes issued coupons on a downgrade. |
| `b2b.credit_tier_uplift` (new) | `10 3 * * *` | When `b2b.credit_tier_uplift.enabled`: per company with an approved permanent `request` version and `uplift_mode = auto`, computes the company tier from its own 12-month completed spend and writes a new effective-dated version when the target changes (D-501). |
| `rewards.expire` (new) | hourly | Coupons past `expires_at` and unused → redemption `expired`, coupon `expired`, event `reward.coupon_expired` (P12C). |
| `rewards.remind_expiring` (new) | `0 10 * * *` | One reminder per redemption `expiryReminderDaysBefore` days before expiry. |
| `promotions.capacity_deals` (new) | `20 7 * * *` | For each product type with free capacity ≥ `minFreePct` next week (provider), drafts one hidden automatic promotion (idempotent per product type × week) and opens its `capacity_deal_publish` approval; drafts whose week passed are ended. |

## 5. Notifications, events, realtime

Notification matrix rows (th/en templates; customer copy says "แต้ม", no factory words):

| Event | Audience | Channels | Category |
|---|---|---|---|
| `reward.redeemed` | customer | in-app, e-mail | transactional |
| `reward.coupon_expiring` | customer | in-app, e-mail, LINE | transactional |
| `loyalty.perk_granted` | customer | in-app, e-mail, LINE | transactional |
| `loyalty.tier_changed` (existing; copy adds Platinum) | customer | in-app, e-mail | transactional |
| `credit_limit.tier_uplift` | staff — Finance team | in-app, e-mail | operational |
| `capacity_deal.drafted` | staff — Marketing team | in-app, e-mail | operational |

Domain events: `reward.redeemed`, `reward.redemption_cancelled`, `reward.coupon_used`, `reward.coupon_expired`,
`loyalty.perk_granted`, `loyalty.campaign_started` / `loyalty.campaign_ended` (admin campaigns reuse P2 events),
`company.credit_limit_uplifted`, `company.credit_uplift_mode_changed`, `promotion.capacity_deal_drafted`,
`order.priority_production_set`. Points movements keep `points.redeemed` (P11), `points.redemption_reversed` (P11R).
Realtime (user channel, `{ type, id }`): `reward.redeemed`, `loyalty.perk_granted`; `loyalty.points_awarded`
unchanged.

## 6. Screens (prototype first for the customer screen; getpack tokens, Anuphan, light theme without dark surfaces, 390 + 1440)

| Screen | Route | Notes |
|---|---|---|
| **Redeem page** | `/account/points/redeem` | Balance strip (available, expiring soon); catalogue grid grouped "ส่วนลดเงินสด" / "สิทธิพิเศษ"; card: name, cost "60 แต้ม", condition line ("ขั้นต่ำ ฿2,000", "1 ครั้งต่อ 3 เดือน", "ตามคิวการผลิต"), CTA "แลก" or the blocked reason ("แต้มไม่พอ — ขาดอีก 12 แต้ม", "สำหรับสมาชิก Gold ขึ้นไป"); confirm sheet (cost, balance after, validity, "ยกเลิกได้ภายใน 7 วันถ้ายังไม่ใช้"); success state with the code + copy + "ใช้กับตะกร้า"; "คูปองของฉัน" list (issued / used / expired / cancelled, cancel button inside the window). Prototype `prototypes/p3-redeem.html` first. |
| **/deals "แลกด้วยแต้ม" tab** | `/deals?tab=points` | Real now: reward cards (same DealCard family, D-486 green stub) linking to `/account/points/redeem#<code>`; guest sees costs and a sign-in prompt; empty state never shown when items exist. |
| **Tier perks on /account/points** | `/account/points` | Tier card shows Platinum; perks list (active / granted this quarter with the coupon / next tier's perks); "สั่งซ้ำ ×2 เดือนเกิดสมาชิก" style multiplier chips from `activeMultipliers`; link "แลกแต้ม" to the redeem page. `/liff/points` gets the same link. |
| **Admin reward catalogue editor** | `/admin/marketing/loyalty/rewards` (+ `/new`, `/[itemId]`) | Table (code, kind, cost, tier, status, redemptions 30 d); form with kind-specific fields, Thai/English names, constraints, validity, window; actions activate / pause / archive; redemptions tab (cancel with reason, `loyalty.adjust`). |
| **Admin loyalty campaigns** | `/admin/marketing/loyalty/campaigns` | P2 read-only list gains create / edit / cancel for `admin_rule` campaigns (window, multiplier, product types, audience picker reused from the promotion editor, reason). |
| **Finance uplift review** | `/admin/finance/credit-uplifts` and the company credit panel | List of uplift versions (company, tier, base → new, capped, above-cap target) with "ขออนุมัติวงเงินเต็ม" (prefilled `admin.companyCredit.requestLimit`) and the mode switch auto / frozen / off with a reason; credit panel shows origin badges per version. |
| **Capacity-deal approval** | `/admin/marketing/promotions?origin=capacity_deal` + approvals inbox | Draft list (product type, week, discount, status, approval); detail = the promotion editor read-only for benefit/conditions, display editable (an edit restarts the approval); approve / reject through the approvals inbox (policy `capacity_deal_publish`). No factory or utilisation-by-factory anywhere; the free % is shown per product type only. |

Copy rules: never factory / partner / โรงงาน, no margin words, no countdown, no "฿0"; free rush says "ผลิตด่วน (ตามคิว)"
and the Platinum slot is never promised in customer copy beyond "คิวผลิตลำดับพิเศษ".

## 7. Tests (unit only — no e2e, D-503)

API (`jest`):
- `promotion-schemas.spec.ts`: v2 kinds accept / refuse; v1 unchanged; `benefitSchemaVersion` rules.
- `promotion-engine.spec.ts`: `free_shipping` maxAmount; `free_sample` on sample lines only; `free_addon` delta and
  `maxAmount`; perks for `free_rush` / `revision_round`; margin guard still applies; reward stack groups.
- `rewards.spec.ts`: redeem consumes FIFO lots and issues one coupon; insufficient points; tier required; free sample
  1 per 3 months; `maxOpenPerItem`; cancel inside 7 days → `redeem_reversal` and coupon cancelled; cancel after 7
  days or after use refused; expiry; idempotency key replay; never a cash or transfer path.
- `points-math.spec.ts`: admin campaign best-of, anniversary ×2, early pay ×1.2, combined cap ×3.00 with all factors.
- `tier-perks.spec.ts`: Platinum threshold; grant once per user × tier × quarter × perk (rerun = no-op); upgrade
  mid-quarter; downgrade keeps coupons.
- `credit-uplift.spec.ts`: Gold ×1.5 / Platinum ×2 of base; cap 1,000,000; above cap → capped + request payload; base
  ≥ cap → nothing; frozen / off; downgrade back to base; disabled setting → nothing; never below base.
- `capacity-deals.spec.ts`: threshold, idempotency per type × week, disabled provider, hidden + automatic, publish
  refused without approval, drafter cannot approve, copy has no factory words.
- `posting-rules.spec.ts`: catalogue redemption P11 balanced (2330 / 4930), cancel P11R, expiry P12C (4930 / 4990),
  coupon use through P09 to 4930.
- `storefront-factory-confidentiality.spec.ts`: rewards list, redemptions, deals points tab, loyalty perks.
- `uat-p3-seed.spec.ts`: idempotent seed.

Web (`vitest` + Storybook): `RewardCard`, `RedeemSheet`, `MyRewardCoupons`, `TierPerks`, deals points tab,
`RewardItemForm`, `LoyaltyCampaignForm`, `CreditUpliftList`, `CapacityDealList`; i18n completeness (th + en, "แต้ม");
model tests for blocked reasons. No Playwright e2e; the visual comparison against the prototype (gate 5) stays.

## 8. UAT seed (idempotent, every promotion `hidden`, UAT-labelled)

The 8 catalogue items (cash-off 20/40/100, free shipping 60, free sample 80, free rush 120, print upgrade 100,
artwork round 40) and their system promotions; one Platinum customer (with granted perks for the current quarter);
one Gold company with a ฿200,000 base limit and `b2b.credit_tier_uplift.enabled = true` **on UAT only**; one admin
campaign ×1.5 for corrugated boxes; one capacity-deal draft awaiting approval. No real customer is touched.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Uplift touches a real customer's limit | Setting disabled by default; enabled only by the UAT seed; nightly job only; every version audited and notified to Finance; never above ฿1,000,000 automatically. |
| Company tier vs user tier mismatch confuses Finance | The uplift row shows the company spend and tier it used; D-501 records the rule. |
| Free rush promised without capacity | Applied only when `CapacityService.nextAvailable` accepts the shorter date; otherwise the code is "ยังใช้ไม่ได้" and stays unused (cancellable within 7 days). |
| Capacity data unstable / not configured | Provider returns nothing when capacity is not configured; drafts are hidden and need Marketing approval; setting can be disabled. |
| Factory exposure through capacity deals | Aggregate per product type only; draft/approval payloads carry no factory ids; wording grep in the publish guard. |
| Liability drift between redemption and coupon use | P11 at redemption, P09 at use to 4930, P12C at expiry; posting-rule tests prove the 4930 roll-forward. |
| Stacking abuse (catalogue cash-off + checkout points) | Reward coupons count toward the D-133 20 % cap together with checkout points; one reward coupon per kind per order; margin guard unchanged. |
| e2e skipped | Unit tests cover every rule; REPORT lists the e2e debt for a later Mac run. |
| Enum additions in one migration | Split 07 (enums) / 08 (use), as P2. |
