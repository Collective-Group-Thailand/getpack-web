# P4 — Factory co-funding, programme budget and rollout controls · plan

Branch `feat/loyalty-p4-cofunding-controls` (both repos, from `main` with P1, P1.5, P2 and P3: api `dee49f47`, web
`9c80386c`). Source: `REPORT.md` "P4 brief" (agreed 2026-11-04); PLAN §7; contract `API-CHANGES-P4.md`. Decisions:
D-473…D-505 (unchanged) and **D-506…D-511** (this phase, owner delegated to the head of team 2026-11-05).

**Owner instruction for P4: no e2e.** No e2e spec is written, extended or run in either repo (D-511, as D-503).
Unit tests, vitest, Storybook, i18n, typecheck, lint, build, contract and the wording / confidentiality greps stay in
the gate.

**Parallel build.** The API agent and the web agent build at the same time and do not talk. The contract is
`API-CHANGES-P4.md`. The web builds every new or changed call through the contract-request layer with MSW, as P3 did.
The API agent may change a path, id or field only when the codebase forces it. It must then write the change at the
top of `API-CHANGES-P4.md` (as P3 did), so the web can adopt it at integration.

## 0. Decisions applied (owner delegated; rows in `docs/decisions.md`)

| D | Decision |
|---|---|
| D-506 | **Voluntary factory co-funding, capacity deals only.** getpack funds 100 % by default. An offer can attach only to a promotion with `origin = capacity_deal`, one live offer per deal per factory. Terms: % of the deal discount (1–100) or fixed baht per order, a total cap and a validity window. The factory accepts or declines in the partner portal. Only accepted offers count. The share applies only to that deal's orders whose production job the funding factory accepted; otherwise getpack funds. Netted from that order's payout on its own billing-statement line "ส่วนร่วมส่วนลด (co-funding)"; reversed on cancel / full refund; capped. New posting rules P20F / P20FR, treatment `pending_cpa`. Per-deal funding split in analytics (Finance read-only). The storefront stays factory-blind (D-502, D-440). |
| D-507 | **Monthly programme budget** `loyalty.programme_budget`. It covers points issued (at value × expected redemption rate), getpack-funded coupon and deal discounts, and tier perks; the factory share is excluded. Alerts at 80 % / 100 % go to Marketing and Finance (notification + admin banner). At 100 %, publish-guard rule `budget_exhausted` blocks new discretionary activations, and campaign-type multipliers stop for the rest of the month. Nothing already earned, issued or published is revoked. Override (raise) through approval `programme_budget_override`: Finance Manager, then C-Level. |
| D-508 | **First-time rewards once per company.** One-off rewards count once per verified company (tax id of an active, KYC-approved company) as well as once per account. They are guarded by a company-scoped partial unique index and a check at award time. The checklist shows "บริษัทของคุณรับแต้มนี้แล้ว" and never names the other user. There is no clawback. Accounts without a verified company keep per-account behaviour. |
| D-509 | **Feature flags per surface** `loyalty.surfaces` (8 booleans). A store endpoint of a disabled surface answers `loyalty.feature_disabled` (404). Workers and admin paths also respect the flags. Discovery uses `store.publicConfig.get` (anonymous view) and the new `store.loyalty.surfaces` (per caller). The web hides nav entries and shows a calm unavailable page. No deploy is needed to toggle. |
| D-510 | **Phased rollout** `loyalty.rollout` with stages `internal → uat → percent → all`. The cohort is a stable hash of the company public id (the user public id when there is no company), plus allowlists. Out-of-cohort accounts get only the pre-P1 baseline earning and no loyalty surfaces (`loyalty.feature_disabled`). Points they already earned stay usable. Admin rollout screen with gate metrics. Advancing needs approval `loyalty_rollout_advance` (Marketing proposes, Finance Manager approves). Rolling back is immediate. |
| D-511 | **P4 test scope**: no e2e (written or run), as D-503. Unit tests, vitest, Storybook, i18n, contract and the confidentiality spec stay in the gate. |

### 0.1 Where the codebase forced a refinement (recorded, within the decisions)

1. **Problem code namespace.** Every `DomainException` code is `<namespace>.<code>` (`src/common/errors/error-codes.ts`), so
   the problem is **`loyalty.feature_disabled`** (HTTP 404). A bare `feature_disabled` is not allowed.
2. **No `capacityDeals` in store responses.** D-440 and `test/unit/storefront-factory-confidentiality.spec.ts` forbid a
   capacity-named value in any store response (P3 renamed `capacity` to `rush_unavailable` for the same reason). The
   `capacityDeals` flag therefore exists in the setting and on admin / worker paths only. `store.loyalty.surfaces` and
   `store.publicConfig.get` carry the other seven flags. While it is off, capacity deals are simply not drafted, so the
   store has nothing to hide.
3. **`dealsLiff` and `pointsLiff` are web-only gates.** LIFF pages call the same store endpoints as the web pages
   (`store.promotions.*`, `store.loyalty.*`), and the API cannot tell a LIFF call from a web call. These two flags
   therefore hide the LIFF routes and LIFF nav items in the web. The API returns them but does not 404 on them.
4. **Posting rules have no confirmation status.** Only settings carry `pending_cpa` (`SETTING_CONFIRMATIONS`).
   `posting_rules` has no such field. The CPA marker is therefore:
   - the setting `promotions.cofunding.accountingTreatment`, seeded `confirmationStatus: pending_cpa`;
   - `decisionRefs: ['D-506']` and the words "pending CPA" in the P20F / P20FR descriptions;
   - a new ⚖ item in `accounting-design.md` §10.
5. **"Payout statement" = the factory billing statement + statement of account.** There is no separate payout statement.
   Factory payouts are `payable_items` → `payout_runs`; the factory sees `billing_statements` (one per goods receipt,
   `partner.payables.getStatement`) and `partner.payables.statementOfAccount`.
   - **Netting:** the co-funding line is a `billing_statement_lines` row of new kind `cofunding`.
   - **Refund:** a refund after netting is a `payable_items` row of new source `cofunding_refund`, shown on the statement
     of account as kind `cofunding`.
   - `vendor_deductions` is **not** reused, because its event `vendor_deduction.recorded` drives P20 (Cr 5190 claim recovery).
6. **The rollout and the budget override reuse the setting-version approval.**
   - `settings-admin.service.ts` already applies `approval.approved` to a proposed `setting_versions` row, so no new
     approval subject table is needed.
   - `loyalty.programme_budget` gets `approvalPolicyKey = programme_budget_override`, so every change, an override
     included, is approved by Finance Manager and then C-Level.
   - `loyalty.rollout` is edited only through the dedicated endpoints: an advance proposes a version under
     `loyalty_rollout_advance`, and a rollback writes an approved version at once. The generic editor refuses it with
     `settings.dedicated_editor` (409).
7. **"Routed or assigned" = the funding factory accepted the order's production job** (`production_job.accepted`).
   `orders.selected_factory_id` at checkout is only the quote's choice. A job reassigned away (`production_job.reassigned`)
   reverses an accrued share.
8. **Netting is bounded by the order's own balance payable.** The share is netted from the goods-receipt payable of that
   order (`purchasing.service.ts` `delivery.reconciled`). If that payable is smaller than the share, the share is cut to
   it and the contribution is marked `capped` (getpack funds the rest). It is never carried to other orders.
9. **There is no "internal account" flag on users or companies.** Stages `internal` and `uat` therefore use the
   allowlists. `loyalty.rollout` adds `allowlistUserIds` (accounts without a company, e.g. staff test logins) and advisory
   `gates` targets for the screen. Neither changes the decision.
10. **"Verified tax id"**: `companies.status = active AND kyc_approved_at IS NOT NULL`. The guard key is the company's
    `tax_id` (unique among non-closed companies), so a closed company re-opened under the same tax id stays claimed.

## 1. Scope

| # | Item | Repo |
|---|---|---|
| 1 | **Migrations** (§3): `20270101000010_loyalty_p4_enums` (enums only), `20270101000011_loyalty_p4_cofunding_controls` (tables `cofunding_offers`, `cofunding_contributions`, `programme_budget_alerts`; columns on `points_ledger`, `billing_statement_lines`, `payable_items`; company one-off indexes). | api |
| 2 | **Settings + seed** (§2): `loyalty.programme_budget`, `loyalty.surfaces`, `loyalty.rollout`, `promotions.cofunding`; `setting-keys.ts`; `prisma/seed/data/settings.ts`; `docs/launch/SETTINGS-REVIEW.md` rows; dedicated-editor guard in `settings-admin.service.ts` (`DEDICATED_EDITOR_KEYS = ['loyalty.rollout']`) and an optional `approvalPolicyKey` override on `proposeChange` for the rollout advance. | api |
| 3 | **Approval policies** (`prisma/seed/data/approval-policies.ts`, SETTINGS-REVIEW "Approval matrices"): `programme_budget_override` (subject `setting_version`; Finance Manager approval → C-Level approval), `loyalty_rollout_advance` (subject `setting_version`; Finance Manager approval). The `capacity_deal_publish` payload gains `funding` (D-506). | api |
| 4 | **Permissions** (`src/modules/iam/permissions.catalog.ts`, `roles.catalog.ts`): `loyalty.programme.manage` (marketing, finance_manager, c_level, superadmin); partner `factory_cofunding.read` (factory_owner, factory_accountant, factory_sales) and `factory_cofunding.decide` (factory_owner). | api |
| 5 | **Co-funding** — new `src/modules/promotions/cofunding/`: `cofunding-offers.service.ts` (propose, withdraw, accept, decline, expire / end), `cofunding-contributions.service.ts` (accrue on `production_job.accepted`, reverse on `production_job.reassigned` / `production_job.rejected` / `order.cancelled` / `refund.succeeded` full, net at goods receipt, refund after netting), `cofunding.ts` (pure share / cap math), controllers `admin-cofunding.controller.ts`, `partner-cofunding.controller.ts`. Hook in `payables/purchasing.service.ts` (`delivery.reconciled` → after the balance payable and before the statement: `cofunding.netForGoodsReceipt(tx, …)` adds the line and reduces `openNetAmount` / `whtBaseHire`). `payables-views.ts` `lineKind` + totals `cofunding`; `payables-query.service.ts` `ACCOUNT_ENTRY_KIND` `cofunding_contribution → cofunding`. `capacity-deals.service.ts` `requestPublish` payload `funding`; `capacity-deals.controller.ts` items `funding`. | api |
| 6 | **Accounting**: account `4915` "ส่วนร่วมส่วนลดจากโรงงาน (co-funding)" (contra, credit, parent 4000) in `finance-accounts.ts`; rules **P20F** (`cofunding.contribution_netted`: Dr 2110 · Cr 4915) and **P20FR** (`cofunding.contribution_refunded`: Dr 4915 · Cr 2110) in `posting-rules-vendor.ts`; the refund payable is paid by the existing P17 (payout kind `balance`, VAT 0, WHT base 0). `accounting-design.md` §5 note + §10 ⚖ item. | api |
| 7 | **Programme budget** — `src/modules/loyalty/programme-budget.service.ts` (`state(month)`, `exhausted(month)` cached 60 s in-process, `spend(month)` SQL), `programme-budget.ts` (pure: thresholds, budget of a month, override validity). Guards: `promotions-admin.service.ts` (`activate`, and `update` visibility → public/unlisted) via `publishErrors` input `budgetExhausted`; `capacity-deals.service.ts` `onApprovalOutcome` (approved while exhausted → approval stands, draft stays `draft`, event `promotion.activation_deferred`); `rewards.service.ts` admin `activate`; `loyalty-campaigns.service.ts` `create`. Multipliers: `loyalty.service.ts` `earnForOrder` sets campaign-type factors to `1.00` when the order's month is exhausted (`meta.multipliers.budgetCapped = true`). Job `loyalty.programme_budget`. Admin controller. | api |
| 8 | **Company one-off guard**: `activity-rewards.service.ts` `earn` (and `alreadyEarned`) + `loyalty.service.ts` `reward` / `rewardPending` stamp `company_id` + `company_tax_id`. Company check before writing, `outcome: 'skipped', reason: 'company_claimed'` + audit `loyalty.reward_skipped_company`. `lifecycle.service.ts` first-order bonus the same. `activity-rewards.ts` `buildChecklist` status `claimed_by_company`. New helper `companies/verified-company.ts` (`verifiedCompaniesOf(userId)`). | api |
| 9 | **Surfaces**: `src/modules/loyalty/loyalty-surfaces.service.ts` (`effective(actor)` = flags ∧ cohort) and the guard decorator `@LoyaltySurface('deals' \| 'redeem' \| 'tierPerks' \| 'checklist')` on the store controllers (§API). Workers: `promotions.capacity_deals` (skip while `capacityDeals` off), `promotions.quote_recovery` (skip while `quoteRecovery` off), `loyalty.recalculate_tiers` (no new perk grants while `tierPerks` off), the checkout `tier.free_shipping` automatic promotion (not applied while `tierPerks` off). Admin: `request_publish` / `activate` of a capacity deal and `admin.cofundingOffers.create` answer `loyalty.feature_disabled` while `capacityDeals` is off. `public-config.ts` `loyaltySurfaces`. | api |
| 10 | **Rollout**: `src/modules/loyalty/loyalty-rollout.service.ts` (`inCohort(userId, companyId?)`, `bucketOf(publicId)`, `advance`, `rollback`, `gateMetrics`), `rollout.ts` (pure: stage order, grows / shrinks, hash bucket). Baseline earning for out-of-cohort accounts in `LoyaltyService.reward` / `rewardPending`, `earnForOrder`, `ActivityRewardsService.earn`, `lifecycle.service.ts`, `reorder-reminders.service.ts`, `tier-perks.service.ts`, `rewards.service.ts` (redeem), `deals.service.ts` (via the surfaces guard). Admin controller. | api |
| 11 | **Analytics**: `loyalty-analytics.service.ts` `funding(from, to)`; `admin.loyaltyAnalytics.funding`. The rollout gate metrics reuse `liability`, `earnVsRedeem` and the budget, plus a margin-after-promotions query over `orders.margin_amount` / net sales. | api |
| 12 | **Notifications + events** (§5) in `prisma/seed/data/notification-matrix.ts` / `notifications.ts`. | api |
| 13 | **Contract**: OpenAPI regenerated, spectral clean; confidentiality spec gets `store.loyalty.surfaces` and the new `publicConfig` field (no funder, no factory, no `capacity`); posting-rule spec (P20F, P20FR); error codes (`loyalty.feature_disabled`, `loyalty.budget_exhausted`, `cofunding.*`, `settings.dedicated_editor`). | api |
| 14 | **Web**: contract requests `src/lib/api/requests/{store,admin,partner}-loyalty-p4.ts` + MSW `mocks/{store,admin,partner}/loyalty-p4.ts` + readers for new fields on published reads `src/features/shared/loyalty-p4/read.ts`; prototypes first (§6.4); screens §6; i18n th + en; Storybook; vitest. `docs/contract-requests.md` rows. At integration: delete the requests, `pnpm gen:api`, adopt. | web |
| 15 | **Docs**: decisions D-506…D-511 (identical both repos), `accounting-design.md` §5 note + §10 item (api), `PROGRESS.md`, `REPORT.md` P4 section, `API-P4-NOTES.md`, `WEB-P4-NOTES.md`, `AUTORUN-STATE.md`. | both |

**Out of scope (recorded):**
- co-funding of anything but capacity deals (D-506);
- a factory ending an accepted offer early (Marketing can withdraw it; the factory asks Marketing);
- partial refunds changing a share (only cancel or full refund reverses it);
- carrying a share that exceeds the order's payable to other payables;
- a factory-issued credit note for the share (pending CPA);
- clawing back company duplicates earned before P4 (D-508);
- per-environment rollout defaults beyond the seed (§2);
- a realtime push for flags (the web reads them per request, cached 60 s).

## 2. Settings (effective-dated, audited, description + decisions; seed is idempotent, `amendInForce` only while the value in force is still the seed's)

| Key | Value (seed) | Confirmation | Owner | Approval | D |
|---|---|---|---|---|---|
| `loyalty.programme_budget` | `{ "monthlyBaht": "200000.00", "alertPcts": [80, 100], "monthOverrides": {} }` | proposed (Finance Manager sets the real figure) | finance_manager | `programme_budget_override` (every change) | D-507 |
| `loyalty.surfaces` | `{ "deals": true, "dealsLiff": true, "redeem": true, "tierPerks": true, "capacityDeals": true, "checklist": true, "pointsLiff": true, "quoteRecovery": true }` | confirmed | marketing | none | D-509 |
| `loyalty.rollout` | `{ "stage": "internal", "percent": 0, "allowlistCompanyIds": [], "allowlistUserIds": [], "gates": { "minRedemptionPct": "15.00", "maxLiabilityBaht": "500000.00", "minMarginAfterPromotionsPct": "18.00", "maxBudgetUsePct": "100.00" } }` — **UAT seed** amends to `stage: "uat"` with the UAT companies and test users | proposed (gates) | marketing | dedicated endpoints only (advance → `loyalty_rollout_advance`; rollback immediate) | D-510 |
| `promotions.cofunding` | `{ "enabled": true, "offerResponseDays": 3, "maxFixedPerOrder": "5000.00", "maxCapAmount": "200000.00", "accountingTreatment": "contra_discount" }` | **pending_cpa** | finance_manager | none | D-506 |

Value rules (JSON schema in the seed):
- **`loyalty.programme_budget`:**
  - `monthlyBaht` is a money string > 0;
  - `alertPcts` are 1–100, ascending, unique, and must include 100;
  - `monthOverrides` keys match `^\d{4}-(0[1-9]|1[0-2])$`, values are money > 0.
- **`loyalty.rollout`:**
  - `stage` ∈ `internal | uat | percent | all`;
  - `percent` is an integer 0–100: 1–99 when `stage = percent`, otherwise 0 (and 100 is never used: `all` instead);
  - the allowlists hold uuid arrays, ≤ 500 each;
  - `gates` values are decimal strings, advisory only (shown, never enforced).
- **`promotions.cofunding`:**
  - `accountingTreatment` ∈ `contra_discount | supplier_discount | marketing_contribution`. Only `contra_discount` is
    implemented; the other two are refused at write until the CPA decides (422 `cofunding_treatment_unimplemented`).

Hard-coded: nothing. The budget's month is the Bangkok calendar month. The budget of month M is
`monthOverrides[M]` when present, otherwise `monthlyBaht` of the version in force at the evaluation time.

`LoyaltySettings.tsx` gains:
- a "การเปิดใช้งานแต่ละส่วน" section (eight switches → `loyalty.surfaces`);
- a link to the budget page (edited through its own form, approval).

`loyalty.rollout` is never on the generic settings screen as editable (it is read-only there, with a link to the rollout
screen). `promotions.cofunding` is edited in the Finance settings screen (`finance_manager`).

## 3. Migrations (hand-written guards, commented DOWN; names follow `20270101000009`)

**`20270101000010_loyalty_p4_enums`** (enum additions only; `ALTER TYPE … ADD VALUE` cannot share a transaction with
their use):
- new `cofunding_share_mode` (`pct_of_discount`, `fixed_per_order`);
- new `cofunding_offer_status` (`proposed`, `accepted`, `declined`, `withdrawn`, `expired`, `ended`);
- new `cofunding_contribution_status` (`accrued`, `netted`, `reversed`, `refunded`);
- new `cofunding_reverse_reason` (`order_cancelled`, `order_refunded`, `job_reassigned`, `job_rejected`, `offer_withdrawn_before_job`);
- `payable_source` + `cofunding_refund`.

**`20270101000011_loyalty_p4_cofunding_controls`**:

- **`cofunding_offers`** (the offer's terms; status and cache columns only change after insert):
  - **Columns.**
    - Identity and links: id, public_id, entity_id, promotion_id FK (**the service and a trigger refuse a promotion
      whose `origin` is not `capacity_deal`**), factory_id FK.
    - Terms: mode `cofunding_share_mode`, share_pct numeric(5,2) null, fixed_amount numeric(14,2) null,
      cap_amount numeric(14,2), valid_from, valid_to, respond_by timestamptz.
    - Lifecycle: status, proposed_by FK users, proposed_at, answered_by FK users null, answered_at null,
      decline_reason text null, withdrawn_by null, withdrawn_at null, withdraw_reason null, ended_at null.
    - Cache and snapshot: accrued_amount numeric(14,2) NOT NULL DEFAULT 0, cap_reached_at null, terms_snapshot jsonb
      (deal name, product type code + name, week start, deal benefit pct, deal window, at proposal).
    - Housekeeping: created_at, updated_at, row_version.
  - **CHECKs.**
    - `mode = 'pct_of_discount'` ⇔ (`share_pct BETWEEN 1 AND 100 AND fixed_amount IS NULL`); `mode =
      'fixed_per_order'` ⇔ (`fixed_amount > 0 AND share_pct IS NULL`).
    - `cap_amount > 0`; `valid_to > valid_from`; `0 ≤ accrued_amount ≤ cap_amount`.
    - `status = 'accepted'` ⇒ `answered_at IS NOT NULL`; `status = 'declined'` ⇒ `decline_reason IS NOT NULL`;
      `status = 'withdrawn'` ⇒ `withdraw_reason IS NOT NULL`.
  - **Indexes.** **Partial unique (promotion_id, factory_id) WHERE status IN ('proposed', 'accepted')** — one live
    offer per deal per factory. Index (factory_id, status); index (promotion_id).

- **`cofunding_contributions`** (one share of one order):
  - **Columns.**
    - Identity and links: id, public_id, entity_id, offer_id FK, promotion_id FK, factory_id FK, order_id FK,
      production_job_id FK.
    - Amounts: discount_amount numeric(14,2) (the deal's discount on the lines that job produces, after the margin
      guard's cap), share_amount numeric(14,2), capped boolean NOT NULL DEFAULT false (cut by the offer cap or by the
      order's payable).
    - Lifecycle: status, accrued_at, netted_at null, goods_receipt_id FK null, billing_statement_line_id FK null
      unique, reversed_at null, reverse_reason `cofunding_reverse_reason` null, refunded_at null,
      refund_payable_item_id FK null unique, created_at.
  - **CHECKs.**
    - `share_amount > 0 AND share_amount ≤ discount_amount`.
    - `status = 'netted'` ⇒ `billing_statement_line_id IS NOT NULL AND netted_at IS NOT NULL`.
    - `status = 'refunded'` ⇒ `netted_at IS NOT NULL AND refund_payable_item_id IS NOT NULL`.
    - `status = 'reversed'` ⇒ `reverse_reason IS NOT NULL AND netted_at IS NULL`.
  - **Indexes.**
    - **Partial unique (order_id, promotion_id) WHERE status IN ('accrued', 'netted')** — one live share per order per
      deal.
    - Index (offer_id, status), index (factory_id, status), index (production_job_id).
  - **Guard trigger `cofunding_contributions_guard`.** It allows only `accrued → netted | reversed` and
    `netted → refunded`, and only the status / timestamp / link columns of that move.

- **`billing_statement_lines`** + `cofunding_contribution_id` FK null unique; CHECK `vendor_deduction_id IS NULL OR
  cofunding_contribution_id IS NULL`.

- **`payable_items`** + `cofunding_contribution_id` FK null unique; CHECK `(source = 'cofunding_refund') =
  (cofunding_contribution_id IS NOT NULL)`.

- **`points_ledger`** + `company_id` FK companies null, `company_tax_id char(13)` null; CHECK both null or both not null.
  - The append-only guard is extended so that both columns are fixed after insert.
  - **`ux_points_ledger__company_one_off_rewards`** — unique (company_tax_id, entry_type, coalesce(meta->>'provider',
    '')) WHERE `company_tax_id IS NOT NULL AND status <> 'reversed' AND entry_type = ANY (the 14 one-off types of
    ux_points_ledger__one_off_rewards)`.
  - **`ux_points_ledger__company_first_order_bonus`** — unique (company_tax_id) WHERE `company_tax_id IS NOT NULL AND
    status <> 'reversed' AND entry_type = 'earn_bonus' AND meta->>'reason' = 'first_order'`.
  - The existing per-account indexes are unchanged.

- **`programme_budget_alerts`**:
  - **Columns:** id, month char(7) (CHECK `^\d{4}-(0[1-9]|1[0-2])$`), threshold_pct smallint (CHECK 1–100),
    budget_amount numeric(14,2), spent_amount numeric(14,2), setting_version_id FK setting_versions, fired_at.
  - **Unique (month, threshold_pct, budget_amount).** A raised budget re-arms the alerts; a rerun is a no-op.
  - Append-only.

No backfill: existing ledger rows keep `company_id` null (D-508, no retroactive clawback). No column on `orders`. The
budget cap of an earning is in `points_ledger.meta.multipliers.budgetCapped`.

## 4. Workers (`@ScheduledJob`, Bangkok time, lease + retries as existing jobs)

| Job | Schedule | Does |
|---|---|---|
| `loyalty.programme_budget` (new) | `*/15 * * * *` | Computes this month's spend (§API "spend"). For each `alertPcts` threshold reached and not yet in `programme_budget_alerts` for (month, pct, budget), it inserts the row and emits `programme_budget.threshold_reached` (notification to the Marketing and Finance teams). It also refreshes the in-process exhaustion cache. On the 1st it fires nothing for the new month until spend exists. |
| `promotions.cofunding_offers` (new) | hourly `:35` | `proposed` past `respond_by` or `valid_to` → `expired` (`cofunding.offer_expired`, Marketing notified). `accepted` whose `valid_to` passed or whose deal ended → `ended` (`cofunding.offer_ended`). Contributions already accrued are kept. |
| `promotions.capacity_deals` (changed) | `20 7 * * *` | Does nothing while `loyalty.surfaces.capacityDeals = false` (logs `skipped: surface_off`). |
| `promotions.quote_recovery` (changed) | unchanged | Sends nothing while `loyalty.surfaces.quoteRecovery = false` or the quotation's owner is out of the rollout cohort. |
| `loyalty.recalculate_tiers` (changed) | daily | Still recalculates tiers. It grants no new perk coupons while `tierPerks` is off or for out-of-cohort accounts. Issued perk coupons stay. |
| `loyalty.credit_due` (changed) | unchanged | Credits pending entries as before. A pending `earn_bonus` / activity entry of an account that left the cohort (rollback) is still credited: written promises are kept (D-510 "already earned"). |

Event consumers (no schedule):
- `production_job.accepted` → `cofunding.accrue`;
- `production_job.reassigned` / `production_job.rejected` → `cofunding.reverse` (job);
- `order.cancelled` → reverse or refund;
- `refund.succeeded` with the order fully refunded → reverse or refund;
- `delivery.reconciled` (inside `purchasing.service.ts`, same transaction) → net.

## 5. Notifications, events, realtime

Notification matrix rows (th / en templates). Customer copy never names a funder or a factory, and never says budget or
rollout.

| Event | Audience | Channels | Category |
|---|---|---|---|
| `programme_budget.threshold_reached` | staff — Marketing team, Finance team | in-app, e-mail | operational |
| `cofunding.offer_proposed` | partner — the factory's `factory_owner` users | in-app, e-mail | operational |
| `cofunding.offer_answered` (accepted / declined) | staff — the proposer + Marketing team | in-app, e-mail | operational |
| `cofunding.offer_expired` | staff — the proposer | in-app | operational |
| `cofunding.cap_reached` | staff — Marketing team; partner — the factory's `factory_owner` users | in-app | operational |
| `loyalty.rollout_changed` | staff — Marketing team, Finance team | in-app, e-mail | operational |

Thai subjects:
- "งบโปรแกรมสะสมแต้มเดือน {month} ใช้ไปแล้ว {pct}%";
- "getpack เสนอให้ร่วมสนับสนุนส่วนลด: {productTypeName} สัปดาห์ {weekStart}";
- "โรงงาน{answer}ข้อเสนอร่วมสนับสนุนส่วนลด: {dealName}";
- "ข้อเสนอร่วมสนับสนุนส่วนลดหมดเวลาตอบรับ: {dealName}";
- "ส่วนร่วมส่วนลดครบวงเงินแล้ว: {dealName}";
- "ปรับขั้นการเปิดใช้โปรแกรมสะสมแต้ม: {stage}".

**Domain events** (new):
- co-funding offers: `cofunding.offer_proposed`, `cofunding.offer_accepted`, `cofunding.offer_declined`,
  `cofunding.offer_withdrawn`, `cofunding.offer_expired`, `cofunding.offer_ended`, `cofunding.cap_reached`;
- co-funding contributions: `cofunding.contribution_accrued`, `cofunding.contribution_reversed`,
  `cofunding.contribution_netted` (P20F), `cofunding.contribution_refunded` (P20FR);
- budget: `programme_budget.threshold_reached`, `promotion.activation_deferred` (approved capacity deal not activated
  because the budget is exhausted);
- rollout: `loyalty.rollout_advance_requested`, `loyalty.rollout_changed` (after an approved advance or a rollback);
- skipped rewards (audit rows): `loyalty.reward_skipped_company`, `loyalty.reward_skipped_rollout`.

`loyalty.surfaces` changes are the existing `setting.changed`.

**Realtime:** no new types. The web reads `store.loyalty.surfaces` per request (60 s cache), and the admin banner reads
`admin.programmeBudget.get`. The existing `loyalty.points_awarded` is unchanged.

## 6. Screens (getpack tokens, Anuphan only, light theme without dark surfaces, 390 + 1440)

**Design rules for every P4 screen:**
- Deal and offer "tickets" use the D-486 ticket in **system green**. Amber is used only for a small badge (e.g. "รอตอบรับ",
  "80 %").
- No countdown, no flash-sale styling, no spin wheel, no progress "streaks".
- Bars show budget / cap use as a plain meter with the numbers beside it.
- The quality bar is a senior product designer: never AI-generic.

### 6.1 Customer (and LIFF)

| Screen | Route | Notes |
|---|---|---|
| **Unavailable page** | `/deals`, `/deals/[slug]`, `/account/points/redeem`, `/liff/deals`, `/liff/points` (when `pointsLiff` off), `/deals?tab=points` (when `redeem` off) | `FeatureUnavailable` (`src/features/customer/shell/FeatureUnavailable.tsx`): neutral illustration-free card, title "ส่วนนี้ยังไม่เปิดให้บริการ", body "เรากำลังทยอยเปิดให้ใช้งาน ระหว่างนี้คุณยังสั่งงานและใช้แต้มที่มีได้ตามปกติ", actions "ไปหน้าแต้มของฉัน" (when signed in and points page allowed) / "เลือกสินค้า". `robots: noindex`; `/deals` leaves `sitemap.ts` while `publicConfig.loyaltySurfaces.deals` is false. Never says "rollout", "budget", "ปิดชั่วคราวเพราะงบ". |
| **Nav and entry points hidden** | storefront header / mobile bottom nav / footer `/deals` links, `HomeDeals` strip, `PdpBuyBox` deal badge link, `AccountNav` "แลกแต้ม", `/account/wallet` "ดูดีล", `/account/points` "แลกแต้ม" + `EarnChecklist` + `TierPerks`, `/account` checklist banner, `LiffNav` points / deals items | Driven by one server reader `getLoyaltySurfaces()` (`src/features/customer/loyalty/surfaces.server.ts`) over `store.loyalty.surfaces` (signed in) or `store.publicConfig.get` (guest). The points balance and ledger always stay. |
| **Checklist: claimed by the company** | `/account/points` checklist, `/liff/points` | Task row status `claimed_by_company`: muted row, neutral check icon, text "บริษัทของคุณรับแต้มนี้แล้ว", no points figure, no CTA, not counted in "รับได้อีก N แต้ม", sorted after `todo`. Never names who claimed it. |

### 6.2 Admin

| Screen | Route | Notes |
|---|---|---|
| **Capacity deal — co-funding panel** | `/marketing/promotions/[id]` (capacity deal) | Panel "ส่วนร่วมสนับสนุนจากโรงงาน": default line "getpack สนับสนุน 100 %" when no accepted offer; offers table (factory, terms "40 % ของส่วนลด" / "฿150 ต่อออเดอร์", cap, window, status badge, accrued / cap meter); "เสนอส่วนร่วม" sheet (factory picker from `admin.cofundingOffers.candidates`, mode, value, cap, window, respond-by, note); withdraw with reason; contributions table (order code, factory, discount, share, status). Hidden when `capacityDeals` off (shows the flag state instead). |
| **Capacity deal list** | `/marketing/promotions?origin=capacity_deal` | `CapacityDeals.tsx` gains a "ผู้ร่วมสนับสนุน" column ("—" or "1 โรงงาน · 40 %"). |
| **Approval detail** | approvals inbox, policy `capacity_deal_publish` | Funding split block from the payload `funding` (getpack default + each offer with status at request time); note "ข้อเสนอที่ตอบรับหลังส่งขออนุมัติจะนับเพิ่ม" (accepted later counts; it can only lower getpack's cost). |
| **Programme budget** | `/marketing/loyalty/budget` | Month picker; meter used / budget with the figures; breakdown (แต้มที่ออก, ส่วนลดคูปองและดีล, สิทธิ์ตามระดับ, หักส่วนร่วมจากโรงงาน); state line; alerts fired; "ขอเพิ่มงบเดือนนี้" form (amount > current, reason ≥ 10 chars) → approval; pending request card. Marketing + Finance (`loyalty.read`; request with `loyalty.programme.manage`). |
| **Budget banner** | admin shell (`AdminShell.tsx`), users with `loyalty.read` | ≥ 80 %: neutral banner "งบโปรแกรมสะสมแต้มเดือนนี้ใช้ไป 84 %" with the small amber badge "80 %" and a link to the budget page; at 100 %: "งบเดือนนี้ครบแล้ว — เปิดใช้แคมเปญ ดีล และของรางวัลใหม่ไม่ได้จนถึงสิ้นเดือน" (neutral banner, danger-tone text, no amber fill). Dismissible per session. |
| **Publish refusal copy** | promotion editor, reward catalogue, loyalty campaigns | Rule `budget_exhausted` → "งบโปรแกรมเดือนนี้ครบแล้ว" with a link to the budget page (`problem-copy.ts`). |
| **Rollout** | `/marketing/loyalty/rollout` | Stage rail (ภายใน · UAT · บางส่วน N % · ทุกคน) as a static stepper; cohort size (companies / accounts in cohort); four gate cards (อัตราการแลกแต้ม, ภาระแต้มคงค้าง, กำไรหลังโปรโมชัน, การใช้งบ) with value, target from `gates`, state (ผ่าน / ต้องดู / ยังไม่มีข้อมูล); allowlist editor (company search, user search); "ขอเลื่อนขั้น" sheet (next stage / percent, reason) → approval, pending card with link; "ถอยกลับ" confirm dialog (target, reason) applied at once; history of the last 10 versions. |
| **Surfaces** | `/marketing/loyalty` (`LoyaltySettings.tsx`) | Section "การเปิดใช้งานแต่ละส่วน" with 8 switches and a reason field; effective now; caption under each switch of what the customer sees when off. |
| **Funding split** | `/marketing/loyalty/analytics` | New table "แหล่งเงินส่วนลดดีล" (deal, week, orders, discount, getpack, factory, reversed) from `admin.loyaltyAnalytics.funding`; Finance read-only. |
| **Statement lines** | admin billing statement detail (existing) | Line kind `cofunding` "ส่วนร่วมส่วนลด (co-funding)" with the deal name; totals row `cofunding`. |

### 6.3 Partner portal

| Screen | Route | Notes |
|---|---|---|
| **Co-funding offers** | `/cofunding` | Nav item "ร่วมสนับสนุนส่วนลด" (group `sales`, permission `factory_cofunding.read`, `src/features/partner/shell/sidebar.ts`, `nav.ts`); list of offer tickets (system green): product type, week, deal discount, terms, cap, respond-by, status badge (amber "รอตอบรับ" only). |
| **Offer detail** | `/cofunding/[offerId]` | Terms in plain Thai ("คุณร่วมจ่าย 40 % ของส่วนลดดีล เฉพาะออเดอร์ของดีลนี้ที่โรงงานของคุณรับผลิต สูงสุด ฿20,000 · หักจากยอดจ่ายของออเดอร์นั้น"); what it is not ("ไม่ใช่ข้อบังคับ ไม่ตอบรับก็ไม่มีผลกับการรับงาน"); accrued / cap meter; orders counted (order codes and amounts only, no customer); "ตอบรับ" / "ปฏิเสธ" (`factory_cofunding.decide`; decline asks a reason) with confirm dialogs. |
| **Billing statement + statement of account** | `/billing/[statementId]`, `/payouts/statement` | Kind `cofunding` "ส่วนร่วมส่วนลด (co-funding)" (negative) and, on the account, refunds "คืนส่วนร่วมส่วนลด (co-funding)"; `KINDS` in the page gains `cofunding`. |

### 6.4 Prototype first (self-contained HTML in `prototypes/`, Anuphan, tokens, 390 + 1440, screenshots in `screenshots/P4/`, DESIGN-NOTES P4 section)

1. `p4-partner-cofunding.html` — offer list + offer detail with accept / decline (partner is mobile-first: 390 is the primary frame).
2. `p4-admin-rollout.html` — rollout screen with gates, pending advance and rollback dialog.
3. `p4-admin-budget.html` — budget page + the shell banner at 84 % and at 100 %.
4. `p4-customer-states.html` — the unavailable page (web + LIFF) and the checklist row "บริษัทของคุณรับแต้มนี้แล้ว".

The co-funding panel on the capacity deal reuses the promotion editor's patterns (no separate prototype).

## 7. Tests (unit only — no e2e, D-511)

API (`jest`):
- `cofunding.spec.ts` (pure):
  - pct share = round2(discount × pct);
  - fixed = min(fixed, discount);
  - the cap cuts the last share (`capped`) and stops at 0;
  - a reversal frees cap room;
  - netting is bounded by the order's payable.
- `cofunding-offers.spec.ts`:
  - only `origin = capacity_deal` (others → 422 `cofunding.deal_not_eligible`);
  - one live offer per deal × factory (409);
  - window inside the deal window;
  - accept / decline only by the factory's `factory_cofunding.decide` user of that factory (others 404);
  - accept after `respond_by` → 409;
  - withdraw;
  - the expire / end job;
  - the `capacity_deal_publish` payload carries `funding`;
  - refused while `capacityDeals` is off.
- `cofunding-contributions.spec.ts`:
  - accrue on job accepted by the funding factory only;
  - nothing for another factory or an order placed before acceptance / outside the window / after withdrawal;
  - reassigned → reversed;
  - cancel before GR → reversed, nothing posted;
  - GR → line "ส่วนร่วมส่วนลด (co-funding)" + payable reduced + `cofunding.contribution_netted`;
  - refund after netting → `cofunding_refund` payable + P20FR;
  - idempotent replays.
- `posting-rules.spec.ts`: P20F balanced (Dr 2110 · Cr 4915), P20FR (Dr 4915 · Cr 2110), refund payout through P17 with
  VAT 0.
- `payables-views.spec.ts`: line kind `cofunding`, totals `cofunding`, statement of account kind `cofunding`.
- `programme-budget.spec.ts`:
  - spend = points × rate + getpack-funded discounts + perks − factory share;
  - catalogue reward coupons not double-counted;
  - thresholds fire once per (month, pct, budget);
  - an override re-arms;
  - guard `budget_exhausted` on promotion activate / publish, reward activate, campaign create;
  - system promotions and checkout never blocked;
  - a capacity-deal approval while exhausted defers activation;
  - `earnForOrder` sets campaign / anniversary / reorderCampaign / promotion to 1.00 with `budgetCapped`;
  - tier, payment method and early pay untouched;
  - override must raise and needs Finance Manager then C-Level.
- `company-one-off.spec.ts`:
  - second member of a verified company gets nothing (`company_claimed`) for each one-off type and the first-order bonus;
  - unverified company → per-account;
  - a reversed (rejected held) entry frees the company;
  - concurrent awards → the unique index wins and the loser is skipped;
  - checklist `claimed_by_company` without naming the other user;
  - no backfill.
- `loyalty-surfaces.spec.ts`:
  - each flag → its store endpoints answer `loyalty.feature_disabled`;
  - `listMine` / `cancel` stay;
  - workers skip;
  - `publicConfig.loyaltySurfaces` omits `capacityDeals`.
- `loyalty-rollout.spec.ts`:
  - bucket is stable and monotone in `percent`;
  - company key beats user key;
  - allowlists;
  - out-of-cohort: only the baseline types are written, with `earn_order` at tier only;
  - surfaces off;
  - checkout redemption and issued coupons still work;
  - grows ⇒ approval, shrinks ⇒ immediate;
  - generic setting edit refused (`settings.dedicated_editor`).
- `loyalty-analytics.spec.ts`: funding split per deal; gate metrics; rates below 10 customers are null.
- `storefront-factory-confidentiality.spec.ts`: `store.loyalty.surfaces`, `store.publicConfig.get` (new field), checklist
  status; no factory, funder or capacity word.
- `uat-p4-seed.spec.ts`: idempotent seed.

Web (`vitest` + Storybook):
- `FeatureUnavailable`, `getLoyaltySurfaces` reader (guest vs signed-in; a failed read hides the gated surfaces and keeps
  the balance and ledger);
- nav filtering (`LiffNav`, header, `AccountNav`);
- `EarnChecklist` claimed row;
- `CofundingPanel`, `CofundingOfferSheet`, approval funding block, `ProgrammeBudget`, `BudgetBanner`, `RolloutScreen`
  (advance / rollback), surfaces switches, funding table;
- partner `CofundingOfferList`, `CofundingOfferDetail` (accept / decline), statement `cofunding` lines;
- i18n completeness th + en;
- contract-request registry entries + MSW mock validation (`mocks.test.ts`);
- problem copy for `loyalty.feature_disabled`, `loyalty.budget_exhausted`, `cofunding.*`.

No Playwright e2e. The visual comparison against the prototypes (gate 5) stays.

## 8. UAT seed (idempotent, UAT-labelled, every promotion `hidden`)

- **`loyalty.rollout`:** `stage: uat`, allowlist = the UAT companies of `docs/launch/UAT-DATA.md` + the UAT test users;
  one non-allowlisted UAT customer shows the out-of-cohort state.
- **`loyalty.surfaces`:** all on; the tester toggles them.
- **`loyalty.programme_budget`** (UAT only): `monthlyBaht: "30000.00"`, so the seeded P1–P3 activity crosses 80 %; the
  tester proposes an override.
- **Co-funding:** on the P3 capacity-deal draft, one offer `proposed` to UAT factory A (respond-by +3 days) and one
  `accepted` from UAT factory B (40 %, cap ฿2,000). One UAT order of that deal has its job accepted by factory B
  (contribution `accrued`), and one delivered order has its contribution `netted` on its billing statement.
- **Company one-off:** one verified UAT company with two member accounts. Member A has `earn_tax_profile` and
  `earn_brand_kit` stamped with the company, so member B's checklist shows two "บริษัทของคุณรับแต้มนี้แล้ว" rows.
- No real customer or factory is touched.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Factory identity leaks to customers through co-funding | Co-funding lives only on admin / partner surfaces and payables; no store DTO changes except flags; the confidentiality spec covers every store response; the capacity flag is not exposed to the store. |
| Factory feels pressured to co-fund | Offers are voluntary, expire unanswered, never affect routing (the router does not read offers — asserted in a unit test); the partner copy says so. |
| Routing biased towards funding factories | `production` / routing code never reads `cofunding_*` (grep in the gate); the share applies only after acceptance of the job. |
| Accounting treatment wrong (supplier discount vs marketing contribution, VAT, WHT) | `contra_discount` default only, `pending_cpa` setting, §10 ⚖ item, P20F / P20FR versioned so the CPA's answer is a new rule version, not a migration. |
| Netted share larger than the payable | Bounded to the order's balance payable (`capped`); never negative payables. |
| Budget computed late (15-minute job) | The guard recomputes on demand when the cache is older than 60 s; activations are rare. A small overshoot is possible and acceptable: nothing is revoked (D-507). |
| Budget stops campaigns customers were promised | Only new activations and the campaign-type multipliers stop; earned points, issued coupons and published deals continue; banner explains it to staff. |
| Company guard punishes legitimate colleagues | Only one-off rewards; order earning per account unchanged; the checklist says clearly why; no clawback. |
| Rollout seed `internal` hides loyalty on existing environments | UAT seed sets `uat`; local dev seed note in API-P4-NOTES (`pnpm seed:uat` or a rollback/advance through the screen); production starts internal on purpose. |
| `/deals` is public SEO but closed until `all` | Pages answer the unavailable page with `noindex` and leave the sitemap while closed; re-indexed when opened. |
| e2e skipped | Unit tests cover every rule; REPORT lists the e2e debt for a later Mac run. |
| Enum additions in one migration | Split 10 (enums) / 11 (use), as P2 / P3. |
