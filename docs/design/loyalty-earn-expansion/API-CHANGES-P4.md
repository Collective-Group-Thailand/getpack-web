# API changes — P4 Factory co-funding, programme budget, company one-offs, surfaces, rollout (contract both sides build against)

> **2026-11-05 — API build notes (deviations the codebase required; details in `API-P4-NOTES.md`):**
> 1. **`funding.factoryShareToDate` is `factoryShareSoFar`**: the spectral rule `getpack-field-formats` reads a
>    `…Date` field as a calendar date. Same meaning (accrued on offers that were accepted).
> 2. **`admin.cofundingContributions.list` accepts `promotions.read` or `payables.read`** (D-512, integration): `@Can`
>    requires every listed permission and `factory_payables.read` is a partner permission, so the new `@CanAny`
>    (contract `x-required-permissions-any`) takes the staff `payables.read` instead. Marketing reads through
>    `promotions.read`, Finance and the Finance Manager through `payables.read`, read-only; `admin.loyaltyAnalytics.funding`
>    stays `loyalty.read` (both finance roles hold it, D-496).
> 3. **`CofundingReverseReason` gains `no_payable`**: at the goods receipt a share with nothing left of the order's
>    payable to net it from is reversed (getpack funds it; never carried to another payable).
> 4. **`admin.loyalty.ledger` items are `AdminPointsEntryDto`** = `PointsEntryDto` + `companyClaim`
>    (`{ companyId, legalName } | null`). `store.loyalty.ledger` keeps `PointsEntryDto` (no company).
> 5. **`budgetCapped` is a field of `EntryMultipliersDto`** (`false` on entries before P4), so it also appears on the
>    checkout preview's `points.multipliers` (`true` while this month's budget is used up).
> 6. **The two 202s carry `x-async`**: `admin.programmeBudget.requestOverride` polls `admin.programmeBudget.get`,
>    `admin.loyaltyRollout.advance` polls `admin.loyaltyRollout.get` (contract rule). Bodies unchanged.
> 7. **Reason lengths**: `admin.cofundingOffers.withdraw` reason 10–800 characters (a 10–500 / 10–1000 reason schema
>    already exists; no duplicate shapes); decline 5–500. `FactoryNameRefDto.name` (trade name, else legal name)
>    has `minLength: 1`.
> 8. **Notification audiences**: the router has no "the proposer" audience, so `cofunding.offer_answered` and
>    `cofunding.offer_expired` go to the Marketing team (proposers are Marketing). The contract's "notifies the
>    factory" on withdraw is a factory row `cofunding.offer_withdrawn` (in-app). Staff payloads carry `promotionId`
>    (the inbox link to the deal); factory payloads carry `factoryId` + `recipientRoles: ['factory_owner']`.
> 9. **Before the P4 settings are seeded** an environment behaves as before P4: surfaces all on, rollout `all`, no
>    budget (never exhausted). `pnpm db:seed` creates them (`loyalty.rollout` starts at `internal`).
> 10. **Budget guard scope**: `activate` of any discretionary promotion (`origin` manual / capacity deal, hidden or
>     not) and `update` that turns visibility to public / unlisted answer `budget_exhausted`; a capacity deal approved
>     while exhausted stays `draft` (`promotion.activation_deferred`) and is activated by Marketing later.
> 11. **Spend simplification**: points are valued at the expected redemption rate in force at evaluation (not per
>     credit time); reversals of earnings are `reversal_claim_refund` entries of the month.
> 12. **Company-claim races** are settled by the partial unique indexes: the losing insert fails, the event consumer
>     retries and the check then skips it (`company_claimed`). There is no in-transaction catch.
> 13. **`store.loyalty.surfaces`** answers `Cache-Control: private, max-age=60` (signed in) / `public, max-age=60`
>     (anonymous) with `Vary: Authorization`. `publicConfig.loyaltySurfaces` is the anonymous view.
> 14. **Funding analytics** counts the orders of a deal placed in `from`..`to`; `offersAccepted` counts offers that
>     were accepted at some point (answered, not declined), `factoryCount` their distinct factories.

Source: `REPORT.md` "P4 brief"; decisions **D-506…D-511**. Plan: `plans/P4-PLAN.md` (§0.1 lists where the codebase
refined the decisions). Conventions are unchanged:
- money is a decimal string, points are integers, percentages are decimal strings;
- dates are Bangkok-offset strings (`+07:00`); calendar days are `YYYY-MM-DD`; months are `YYYY-MM`;
- operation ids are `<surface>.<tag>.<action>`, three segments only (`OPERATION_ID_PATTERN`);
- admin and partner lists use the paginated envelope `{ data, meta }`;
- errors are `DomainException` codes in namespaces, with an RFC 9457 problem body as today;
- writes that move money take `Idempotency-Key`; editable aggregates take `If-Match` (row version ETag);
- realtime payloads are `{ type, id }` only, and there are no new types in P4;
- **no factory data in any store response** (GLOBAL-RULES §1, D-440, D-481, D-502), no funder, no capacity word;
- customer-facing Thai says "แต้ม" (D-489).

The API agent may adjust paths or ids where the codebase demands it, but must then update this file and say why at
the top (as in P1…P3). The web builds every operation below with contract requests + MSW before the API publishes.
**No e2e in P4 (D-511).**

## New operations

| # | Operation id | Method + path | Permission |
|---|---|---|---|
| 1 | `store.loyalty.surfaces` | `GET /v1/store/loyalty/surfaces` | public (token optional) |
| 2 | `admin.cofundingOffers.candidates` | `GET /v1/admin/promotions/{promotionId}/cofunding-candidates` | `promotions.manage` |
| 3 | `admin.cofundingOffers.list` | `GET /v1/admin/promotions/{promotionId}/cofunding-offers` | `promotions.read` |
| 4 | `admin.cofundingOffers.create` | `POST /v1/admin/promotions/{promotionId}/cofunding-offers` | `promotions.manage` |
| 5 | `admin.cofundingOffers.withdraw` | `POST /v1/admin/cofunding-offers/{offerId}/actions/withdraw` | `promotions.manage` |
| 6 | `admin.cofundingContributions.list` | `GET /v1/admin/cofunding-contributions` | `promotions.read` or `factory_payables.read` |
| 7 | `partner.cofundingOffers.list` | `GET /v1/partner/cofunding-offers` | `factory_cofunding.read` |
| 8 | `partner.cofundingOffers.get` | `GET /v1/partner/cofunding-offers/{offerId}` | `factory_cofunding.read` |
| 9 | `partner.cofundingOffers.accept` | `POST /v1/partner/cofunding-offers/{offerId}/actions/accept` | `factory_cofunding.decide` |
| 10 | `partner.cofundingOffers.decline` | `POST /v1/partner/cofunding-offers/{offerId}/actions/decline` | `factory_cofunding.decide` |
| 11 | `admin.programmeBudget.get` | `GET /v1/admin/loyalty/programme-budget` | `loyalty.read` |
| 12 | `admin.programmeBudget.requestOverride` | `POST /v1/admin/loyalty/programme-budget/overrides` | `loyalty.programme.manage` |
| 13 | `admin.loyaltyRollout.get` | `GET /v1/admin/loyalty/rollout` | `loyalty.read` |
| 14 | `admin.loyaltyRollout.advance` | `POST /v1/admin/loyalty/rollout/actions/advance` | `loyalty.programme.manage` |
| 15 | `admin.loyaltyRollout.rollback` | `POST /v1/admin/loyalty/rollout/actions/rollback` | `loyalty.programme.manage` |
| 16 | `admin.loyaltyRollout.cohort` | `GET /v1/admin/loyalty/rollout/cohort` | `loyalty.read` |
| 17 | `admin.loyaltyAnalytics.funding` | `GET /v1/admin/loyalty/analytics/funding` | `loyalty.read` |

New permissions:
- `loyalty.programme.manage`: marketing, finance_manager, c_level, superadmin;
- `factory_cofunding.read`: factory_owner, factory_accountant, factory_sales;
- `factory_cofunding.decide`: factory_owner.

## Existing operations that change

| Operation | Change |
|---|---|
| `store.publicConfig.get` | Gains `loyaltySurfaces` (anonymous view, below). Cache unchanged (5 min + ETag). |
| `store.promotions.listPublic`, `store.promotions.getPublic`, `store.promotions.save` | 404 `loyalty.feature_disabled` when `deals` is off for the caller (flag off, or out of cohort). `tab=points` additionally returns `items: []`, `counts.points: 0` when `redeem` is off for the caller. |
| `store.rewards.list`, `store.rewards.preview`, `store.rewards.redeem` | 404 `loyalty.feature_disabled` when `redeem` is off for the caller. `store.rewards.listMine` and `store.rewards.cancel` **stay available** (issued coupons are never revoked). |
| `store.loyalty.tasks` | 404 `loyalty.feature_disabled` when `checklist` is off for the caller. Task `status` adds **`claimed_by_company`** (D-508). |
| `store.loyalty.get` | `perks: []`, `nextTierPerks: []` when `tierPerks` is off for the caller. `activeMultipliers` lists only the factors that apply to the caller (out of cohort: `tier` only). There is no new field and no budget wording. |
| `store.loyalty.campaigns` | `items: []` for out-of-cohort callers. |
| `store.cart.applicableCodes`, checkout preview / place | **Unchanged.** Published deals, issued coupons and checkout points keep working whatever the flags, the cohort or the budget (D-507, D-510). Preview `points` reflects the cohort (baseline earning) and the budget cap (campaign-type factors `"1.00"`). |
| `admin.promotions.action` (`activate`), `admin.promotions.update` (visibility → `public` / `unlisted`) | Publish guard rule **`budget_exhausted`** inside `promotions.not_publishable` (422) for discretionary promotions (`origin` `manual` or `capacity_deal`) while this month's budget is used up. `request_publish` and `activate` of a capacity deal → 404 `loyalty.feature_disabled` while `capacityDeals` is off. |
| `admin.promotions.get` | For `origin = capacity_deal`, `capacityDeal` gains `funding` (same shape as `admin.capacityDeals.list`). |
| `admin.capacityDeals.list` | Items gain `funding` (below). |
| `admin.rewardCatalog.action` (`activate`) | 409 **`loyalty.budget_exhausted`** while the budget is used up. |
| `admin.loyaltyCampaigns.create` | 409 **`loyalty.budget_exhausted`** while the budget is used up (an `admin_rule` campaign is active from creation). |
| approvals: `capacity_deal_publish` request payload | Gains `funding` (below), a snapshot at request time. |
| `admin.payables.getStatement`, `partner.payables.getStatement`, `…listStatements` | `BillingStatementLineKind` adds **`cofunding`**; `BillingStatementTotalsDto` adds **`cofunding`** (sum of those lines, ≤ 0). |
| `partner.payables.statementOfAccount` | `AccountEntryKind` adds **`cofunding`** (P20F debit, P20FR credit). |
| `admin.settings.*` (generic editor) | A change to `loyalty.rollout` → 409 **`settings.dedicated_editor`**. `loyalty.programme_budget` changes go through approval `programme_budget_override` (existing `setting.change_proposed` flow). |
| `admin.loyalty.ledger`, `store.loyalty.ledger` | `earn_order` `multipliers` gains `budgetCapped` (bool). Admin items gain `companyClaim` (`{ companyId, legalName } \| null`, staff only); store items do not. |

## Store — surfaces (D-509, D-510)

### GET /v1/store/loyalty/surfaces — `store.loyalty.surfaces`

Public. With a customer token the flags are **effective for the caller** (setting ∧ rollout cohort). Without a token
they are the anonymous view: the setting, and only when `loyalty.rollout.stage = all`. `Cache-Control: private,
max-age=60` (signed in) / `public, max-age=60` (anonymous).

```json
{ "deals": true, "dealsLiff": true, "redeem": true, "tierPerks": true,
  "checklist": true, "pointsLiff": true, "quoteRecovery": true }
```

- Only these seven booleans. `capacityDeals` is never in a store response (D-440, P4-PLAN §0.1 item 2).
- There is no cohort or stage field: the customer is never told they are out of a rollout.
- `dealsLiff` / `pointsLiff` are web gates only (the API serves the same endpoints to LIFF and web).

### `store.publicConfig.get` (changed)

```json
{ "...": "existing fields",
  "loyaltySurfaces": { "deals": false, "dealsLiff": false, "redeem": false, "tierPerks": false,
                       "checklist": false, "pointsLiff": false, "quoteRecovery": false } }
```
Anonymous view (as above). The web uses it for guests, the sitemap and the header. Signed-in pages use
`store.loyalty.surfaces`.

### Problem `loyalty.feature_disabled` (404)

```json
{ "type": "https://getpack.co/problems/loyalty.feature_disabled", "title": "Not available",
  "status": 404, "code": "loyalty.feature_disabled", "params": { "surface": "deals" } }
```
`params.surface` ∈ `deals | redeem | tierPerks | checklist | capacityDeals`. `capacityDeals` appears only on admin
responses. The web shows the calm unavailable page; it never shows the code.

| Surface flag | Store operations that answer `loyalty.feature_disabled` | Workers / admin that respect it |
|---|---|---|
| `deals` | `store.promotions.listPublic`, `getPublic`, `save` | — |
| `dealsLiff` | — (web gate) | — |
| `redeem` | `store.rewards.list`, `preview`, `redeem` | — |
| `tierPerks` | — (`store.loyalty.get` returns empty perks) | `loyalty.recalculate_tiers` grants nothing new; checkout skips the `tier.free_shipping` automatic promotion |
| `capacityDeals` | — | `promotions.capacity_deals` drafts nothing; `admin.promotions.action` `request_publish` / `activate` on a capacity deal and `admin.cofundingOffers.create` → 404 `loyalty.feature_disabled` |
| `checklist` | `store.loyalty.tasks` | — (earning continues; only the surface hides) |
| `pointsLiff` | — (web gate) | — |
| `quoteRecovery` | — | `promotions.quote_recovery` sends nothing |

### `store.loyalty.tasks` (changed)

```json
{ "tasks": [
  { "code": "tax_profile", "points": 20, "status": "claimed_by_company", "doneAt": null, "heldReason": null },
  { "code": "brand_kit", "points": 20, "status": "claimed_by_company", "doneAt": null, "heldReason": null },
  { "code": "phone_verified", "points": 10, "status": "todo", "doneAt": null, "heldReason": null }
], "earnedPoints": 0, "remainingPoints": 10, "capPoints": 240, "capRemainingPoints": 240, "pointValue": "2.50" }
```
- `LoyaltyTaskStatus` = `todo | held | done | claimed_by_company`.
- A `claimed_by_company` task is not counted in `remainingPoints`. It never carries who claimed it.

## Company one-off guard (D-508) — earning rule

- **One-off types:**
  - `earn_signup`, `earn_line_link`, `earn_identity_link` (per provider);
  - `earn_phone_verified`, `earn_profile_completed`, `earn_tax_profile`, `earn_address`, `earn_brand_kit`;
  - `earn_first_design`, `earn_team_invite`, `earn_packaging_profile`, `earn_line_oa_friend`;
  - `earn_first_sample`, `earn_showcase_consent`;
  - plus `earn_bonus` with reason `first_order`.
- **Verified companies of a user:** active `company_members` of companies with `status = active` and
  `kyc_approved_at IS NOT NULL`.
- **Award.** If any verified company of the user already has a non-reversed entry of that type (and provider), the
  award is skipped (`company_claimed`). "Already has" means either:
  - an entry stamped `company_tax_id` = the company's tax id; or
  - an entry of any of its current active members.
- **Stamping.** Otherwise the entry is written with `company_id` / `company_tax_id` of the user's earliest verified
  membership. The partial unique index settles races.
- **Unchanged.** Accounts with no verified company keep per-account rules. Order earning, reviews, surveys, data refresh
  and referrals are unchanged. There is no backfill and no clawback.
- **Audit row** `loyalty.reward_skipped_company` (resource user, data `{ entryType, provider, companyId }`). No customer
  notification.

## Rollout (D-510) — earning rule for out-of-cohort accounts

- **Cohort key:**
  - the company public id of the order's company (for order earning), or the user's earliest active company
    membership;
  - otherwise the user public id.
- **Bucket:** `parseInt(sha256("getpack.loyalty.rollout:" + key).hex.slice(0, 8), 16) % 100`.
- **In cohort when any of these holds:**
  - stage `all`;
  - company in `allowlistCompanyIds`;
  - user in `allowlistUserIds`;
  - stage `percent` and `bucket < percent`.
- **Stages `internal` / `uat`:** allowlists only. The difference is the label and the gate review.
- **Out of cohort, the account keeps:**
  - `earn_order` at the **tier multiplier only** (every other factor `"1.00"`);
  - `earn_signup`;
  - `earn_identity_link` with provider `line` (the pre-P1 `earn_line_link`);
  - `earn_review`;
  - `earn_referral`;
  - checkout redemption;
  - issued coupons;
  - expiry.
- **Out of cohort, the account does not get:**
  - any other P1–P3 activity / engagement reward;
  - any `earn_bonus` (first order, win-back, promotion, early pay);
  - campaigns, anniversary, payment-method, reorder or promotion multipliers;
  - perk grants;
  - the gated surfaces (`loyalty.feature_disabled`).
- **Skipped awards:** audit `loyalty.reward_skipped_rollout`.
- **Rollback:** entries already written (pending ones included) are kept and credited as usual.

## Programme budget (D-507)

### Spend of a month (Bangkok calendar month M)

`spent = points + discounts + tierPerks − factoryShare`, each in baht:

| Part | Rule |
|---|---|
| `points` | Σ `baht_value × expected_redemption_rate` (rate version in force at the credit time) of `earn_*` entries credited in M (`coalesce(available_at, created_at)` in M, status `available` / `expired`), minus the same for those reversed in M after credit. `adjust`, `redeem*`, `expire` excluded. |
| `discounts` | Σ (`amount − capped_amount`) of `promotion_redemptions` applied in M whose promotion is `origin` `manual` or `capacity_deal`, or system `quote_recovery.*`; minus those reversed in M. Excludes `reward.*` promotions used with a **catalogue** redemption (already counted as points). |
| `tierPerks` | Same for the system promotion `tier.free_shipping` and for `reward.*` coupons of `source = tier_perk` redemptions. |
| `factoryShare` | Σ `share_amount` of `cofunding_contributions` accrued in M and not reversed (netted or refunded ones stay: a refund is already a reversal of the order's discount). |

- **Budget:** `monthOverrides[M] ?? monthlyBaht` (version in force now).
- **`usedPct`:** `round2(spent / budget × 100)`.
- **State:** `ok` < first alert, `warning` ≥ the first alert below 100, `exhausted` ≥ 100.
- **While exhausted (current month only):**
  - the guards above refuse activations (`budget_exhausted` / `loyalty.budget_exhausted`);
  - `earnForOrder` for orders created in M sets `campaign`, `anniversary`, `reorderCampaign` and `promotion` to `"1.00"`
    and `budgetCapped: true`. `tier`, `paymentMethod` and `earlyPay` (standing rules) stay.
- **Never blocked or revoked:**
  - system promotions (`reward.*`, `tier.*`, `quote_recovery.*`, referral);
  - checkout;
  - issued coupons;
  - earned points;
  - published deals;
  - a reward redemption (it spends points already issued).
- **Capacity-deal approval while exhausted:** the approval stands, the draft stays `draft`
  (`promotion.activation_deferred`), and `admin.promotions.action activate` succeeds once the budget allows.

### GET /v1/admin/loyalty/programme-budget — `admin.programmeBudget.get`

Query `month` (`YYYY-MM`, default the current Bangkok month; ≤ 24 months back, never future + 1).

```json
{ "month": "2026-11",
  "budget": { "monthlyBaht": "200000.00", "override": "250000.00", "effective": "250000.00",
              "settingVersionId": "0192f3a0-7c1e-7d2a-9b1f-0000000d4001" },
  "spent": { "points": "121400.00", "discounts": "78250.00", "tierPerks": "16900.00",
             "factoryShare": "6550.00", "total": "210000.00" },
  "usedPct": "84.00", "state": "warning", "alertPcts": [80, 100],
  "alerts": [ { "thresholdPct": 80, "firedAt": "2026-11-21T10:15:00+07:00", "budget": "250000.00", "spent": "200410.00" } ],
  "pendingOverride": { "approvalId": "0192f3a0-7c1e-7d2a-9b1f-0000000a9101", "amount": "300000.00",
                       "requestedBy": { "id": "0192f3a0-7c1e-7d2a-9b1f-000000000u01", "displayName": "มาลี ส." },
                       "requestedAt": "2026-11-22T09:00:00+07:00" },
  "asOf": "2026-11-22T09:15:00+07:00", "currency": "THB" }
```
- `override` and `pendingOverride` can be null.
- `state` ∈ `ok | warning | exhausted`.
- Cached 60 s. Errors: `validation.failed`.

### POST /v1/admin/loyalty/programme-budget/overrides — `admin.programmeBudget.requestOverride`

Header `Idempotency-Key`. Body:
```json
{ "month": "2026-11", "amount": "300000.00", "reason": "แคมเปญปลายปีได้ผลดี ขอเพิ่มงบเดือนพฤศจิกายน" }
```
- `month` is the current or the next Bangkok month.
- `amount` must be greater than that month's effective budget (422 `validation.failed`, code `must_raise`).
- `reason` is ≥ 10 chars.
- **Effect:** writes a `proposed` version of `loyalty.programme_budget` with `monthOverrides[month] = amount`
  (`effectiveFrom = now`) and opens approval `programme_budget_override` (Finance Manager approval → C-Level approval).
  On approval the version applies (existing settings flow) and the alerts re-arm.
- **202** → `{ "approvalId": "0192f3a0-7c1e-7d2a-9b1f-0000000a9101", "status": "pending" }`.
- **Errors:**
  - `validation.failed` (`must_raise`, `month_out_of_range`);
  - `settings.pending_exists` (409: one open proposal at a time);
  - `idempotency.*`.

## Rollout (D-510)

### GET /v1/admin/loyalty/rollout — `admin.loyaltyRollout.get`

```json
{ "current": { "stage": "percent", "percent": 10,
               "allowlistCompanyIds": ["0192f3a0-7c1e-7d2a-9b1f-0000000c0001"], "allowlistUserIds": [],
               "settingVersionId": "0192f3a0-7c1e-7d2a-9b1f-0000000d5003",
               "effectiveFrom": "2026-11-20T09:00:00+07:00" },
  "cohort": { "companies": 41, "companiesTotal": 402, "usersWithoutCompany": 318, "usersWithoutCompanyTotal": 3120 },
  "gates": [
    { "metric": "redemption_rate", "value": "18.40", "target": "15.00", "direction": "min", "status": "pass", "window": "3m" },
    { "metric": "points_liability", "value": "412800.00", "target": "500000.00", "direction": "max", "status": "pass", "window": "now" },
    { "metric": "margin_after_promotions", "value": "17.10", "target": "18.00", "direction": "min", "status": "attention", "window": "3m" },
    { "metric": "budget_use", "value": "84.00", "target": "100.00", "direction": "max", "status": "pass", "window": "month" }
  ],
  "pendingAdvance": null,
  "history": [ { "settingVersionId": "0192f3a0-7c1e-7d2a-9b1f-0000000d5003", "stage": "percent", "percent": 10,
                 "kind": "advance", "reason": "ผ่านเกณฑ์ UAT สองสัปดาห์",
                 "by": { "id": "0192f3a0-7c1e-7d2a-9b1f-000000000u01", "displayName": "มาลี ส." },
                 "approvedBy": { "id": "0192f3a0-7c1e-7d2a-9b1f-000000000u02", "displayName": "สมชาย ก." },
                 "effectiveFrom": "2026-11-20T09:00:00+07:00" } ] }
```
- **Gates.** `metric` ∈ `redemption_rate | points_liability | margin_after_promotions | budget_use`; `status` ∈
  `pass | attention | unknown` (unknown below 10 customers or no data). Gates are advisory: they never block an
  advance.
  - `redemption_rate`: points redeemed ÷ points earned, last 3 months, in-cohort accounts.
  - `points_liability`: `admin.loyaltyAnalytics.get` `liability.estimatedLiability` now.
  - `margin_after_promotions`: Σ `orders.margin_amount` ÷ Σ net sales of orders placed in the last 3 months, not
    cancelled, after every discount and points (D-504).
  - `budget_use`: `usedPct` this month.
- **`pendingAdvance`:** `{ approvalId, target: { stage, percent, allowlistCompanyIds, allowlistUserIds }, reason, requestedBy,
  requestedAt } | null`.
- **`history[].kind`** ∈ `advance | rollback | seed`. History is the last 10 versions.

### POST /v1/admin/loyalty/rollout/actions/advance — `admin.loyaltyRollout.advance`

Header `Idempotency-Key`. Body = the full target plus a reason:
```json
{ "stage": "percent", "percent": 25, "allowlistCompanyIds": ["0192f3a0-7c1e-7d2a-9b1f-0000000c0001"],
  "allowlistUserIds": [], "reason": "อัตราการแลกและกำไรผ่านเกณฑ์ที่ 10 % มาสองสัปดาห์" }
```
- **Must grow the cohort** (else 422 `validation.failed` code `not_an_advance`). Growing means at least one of:
  - a later stage (`internal < uat < percent < all`);
  - the same stage with a higher `percent`;
  - added allowlist ids.

  A mixed change counts as an advance.
- **Value rules:** `percent` is 1–99 with `stage = percent`, otherwise 0. Unknown company / user ids → 422 code
  `unknown_id`. `reason` is ≥ 10 chars.
- **Effect:** a `proposed` version of `loyalty.rollout` + approval `loyalty_rollout_advance` (Finance Manager approval;
  the requester cannot approve). Events `loyalty.rollout_advance_requested`, then on approval `loyalty.rollout_changed`
  + notification.
- **202** → `{ "approvalId": "0192f3a0-7c1e-7d2a-9b1f-0000000a9201", "status": "pending" }`.
- **Errors:** `validation.failed`, `settings.pending_exists` (409), `idempotency.*`.

### POST /v1/admin/loyalty/rollout/actions/rollback — `admin.loyaltyRollout.rollback`

Header `Idempotency-Key`. Same body; **must not grow** the cohort (422 code `not_a_rollback`).
- **Effect:** writes an approved version effective now (no approval).
- **Pending advance:** an open advance proposal is withdrawn first (`approval.withdrawn`).
- **Audit and events:** audit `setting.changed`, event `loyalty.rollout_changed` + notification.
- **200** → the `admin.loyaltyRollout.get` body.
- **Errors:** `validation.failed`, `idempotency.*`.

### GET /v1/admin/loyalty/rollout/cohort — `admin.loyaltyRollout.cohort`

Query exactly one of `companyId` or `userId`. 200 →
```json
{ "key": "company", "keyId": "0192f3a0-7c1e-7d2a-9b1f-0000000c0007", "bucket": 37,
  "inCohort": false, "reason": "bucket_above_percent" }
```
- `reason` ∈ `stage_all | allowlisted_company | allowlisted_user | bucket_below_percent | bucket_above_percent |
  not_allowlisted`.
- Use it in CS and support to answer "why don't I see deals". Errors: `validation.failed`, `http.not_found`.

## Co-funding (D-506)

### Shapes

`CofundingOfferDto` (admin):
```json
{ "id": "0192f3a0-7c1e-7d2a-9b1f-0000000f7001",
  "promotionId": "0192f3a0-7c1e-7d2a-9b1f-0000000f3001",
  "factory": { "id": "0192f3a0-7c1e-7d2a-9b1f-000000000f01", "name": "โรงงาน ตัวอย่าง" },
  "mode": "pct_of_discount", "sharePct": "40.00", "fixedAmount": null, "capAmount": "20000.00",
  "validFrom": "2026-11-09T00:00:00+07:00", "validTo": "2026-11-15T23:59:59+07:00",
  "respondBy": "2026-11-07T23:59:59+07:00",
  "status": "accepted", "accruedAmount": "4320.00", "capRemaining": "15680.00", "capReached": false,
  "ordersCount": 9,
  "note": "ช่วงโรงงานว่างสัปดาห์ที่ 2 ของเดือน",
  "proposedBy": { "id": "0192f3a0-7c1e-7d2a-9b1f-000000000u01", "displayName": "มาลี ส." },
  "proposedAt": "2026-11-04T08:00:00+07:00",
  "answeredBy": { "id": "0192f3a0-7c1e-7d2a-9b1f-000000000u31", "displayName": "คุณวิชัย" },
  "answeredAt": "2026-11-05T10:12:00+07:00",
  "declineReason": null, "withdrawnAt": null, "withdrawReason": null,
  "rowVersion": 3 }
```
- **Mode:** `mode` ∈ `pct_of_discount | fixed_per_order`. Exactly one of `sharePct` / `fixedAmount` is non-null.
- **Status:** `status` ∈ `proposed | accepted | declined | withdrawn | expired | ended`.
- **`termsText`.** Every offer DTO also carries `termsText` (th): "40 % ของส่วนลดดีล สูงสุด ฿20,000" /
  "฿150 ต่อออเดอร์ สูงสุด ฿20,000". The web shows `termsText` and never composes terms itself.

`CofundingOfferPartnerDto` (partner) = the admin shape without `proposedBy`, `answeredBy`, `withdrawnAt` and
`rowVersion`, plus `deal`:
```json
{ "deal": { "name": "สั่งกล่องลูกฟูกสัปดาห์นี้ ลด 5%", "productTypeCode": "corrugated", "productTypeName": "กล่องลูกฟูก",
            "weekStart": "2026-11-09", "discountPct": "5", "startsAt": "2026-11-09T00:00:00+07:00",
            "endsAt": "2026-11-15T23:59:59+07:00", "status": "active" },
  "nextActions": ["accept", "decline"] }
```
- The deal block comes from `terms_snapshot` plus the live status.
- The partner never sees customers, other factories, other offers, the free-capacity figure or getpack's margin.
- `nextActions` is empty unless the offer is `proposed`, `respondBy` has not passed and the caller has
  `factory_cofunding.decide`.

`funding` (on `admin.capacityDeals.list` items, `admin.promotions.get` `capacityDeal`, the `capacity_deal_publish`
payload):
```json
{ "defaultFunder": "getpack",
  "offers": [ { "offerId": "0192f3a0-7c1e-7d2a-9b1f-0000000f7001", "factoryName": "โรงงาน ตัวอย่าง",
                "status": "accepted", "termsText": "40 % ของส่วนลดดีล สูงสุด ฿20,000",
                "capAmount": "20000.00", "accruedAmount": "4320.00" } ],
  "acceptedCount": 1, "factoryShareToDate": "4320.00" }
```
The approval payload is a snapshot at `request_publish`. An offer accepted later counts and shows in the live views.

### GET /v1/admin/promotions/{promotionId}/cofunding-candidates — `admin.cofundingOffers.candidates`

Active factories with an active capability for the deal's product type. No capacity, utilisation or price figures.
```json
{ "data": [ { "factoryId": "0192f3a0-7c1e-7d2a-9b1f-000000000f01", "name": "โรงงาน ตัวอย่าง",
              "hasLiveOffer": false } ],
  "meta": { "page": 1, "perPage": 50, "total": 1 } }
```
Errors:
- `http.not_found`;
- `cofunding.deal_not_eligible` (422: not a capacity deal);
- `loyalty.feature_disabled` (404, `capacityDeals` off).

### GET /v1/admin/promotions/{promotionId}/cofunding-offers — `admin.cofundingOffers.list`

Query `status`, `page`, `perPage`. → `{ data: CofundingOfferDto[], meta }`. Errors: `http.not_found`.

### POST /v1/admin/promotions/{promotionId}/cofunding-offers — `admin.cofundingOffers.create`

Header `Idempotency-Key`. Body:
```json
{ "factoryId": "0192f3a0-7c1e-7d2a-9b1f-000000000f01",
  "mode": "pct_of_discount", "sharePct": "40.00", "fixedAmount": null, "capAmount": "20000.00",
  "validFrom": "2026-11-09T00:00:00+07:00", "validTo": "2026-11-15T23:59:59+07:00",
  "respondBy": "2026-11-07T23:59:59+07:00", "note": "ช่วงโรงงานว่างสัปดาห์ที่ 2 ของเดือน" }
```
- **Deal:** the promotion is `origin = capacity_deal` and not `ended` / `cancelled`.
- **Window:** within the deal's window (`validFrom ≥ startsAt` or now; `validTo ≤ endsAt`).
- **Respond-by:** `respondBy` ≤ `validTo`, default now + `promotions.cofunding.offerResponseDays`.
- **Terms:** `sharePct` 1–100 (2 dp); `fixedAmount` 1 to `maxFixedPerOrder`; `capAmount` 1 to `maxCapAmount`.
- **Factory:** the factory is a candidate.
- **Effect:** creates the offer `proposed`, snapshots the terms, emits `cofunding.offer_proposed` and notifies the
  factory owners.
- **201** → `CofundingOfferDto`.
- **Errors:**
  - `validation.failed` (codes `out_of_deal_window`, `respond_by_after_end`, `mode_value_mismatch`, `not_a_candidate`,
    `above_max`);
  - `cofunding.deal_not_eligible` (422);
  - `cofunding.offer_exists` (409: a live offer for this deal × factory);
  - `cofunding.disabled` (409: `promotions.cofunding.enabled = false`);
  - `loyalty.feature_disabled` (404);
  - `idempotency.*`.

### POST /v1/admin/cofunding-offers/{offerId}/actions/withdraw — `admin.cofundingOffers.withdraw`

`If-Match`; body `{ "reason": "ดีลถูกยกเลิก ไม่ต้องร่วมสนับสนุน" }` (≥ 10 chars).
- **Who:** allowed from `proposed` or `accepted`.
- **Effect:** stops accrual for orders **placed** after now. Shares already accrued stay and follow their orders.
  Emits `cofunding.offer_withdrawn` and notifies the factory.
- **200** → `CofundingOfferDto`.
- **Errors:** `cofunding.invalid_transition` (409), `concurrency.stale` (412), `http.not_found`.

### GET /v1/partner/cofunding-offers — `partner.cofundingOffers.list`

Query `factoryId` (optional; the caller's factories only, as `partner.payables.listStatements`), `status`, `page`,
`perPage`. → `{ data: CofundingOfferPartnerDto[], meta }`.

### GET /v1/partner/cofunding-offers/{offerId} — `partner.cofundingOffers.get`

→ `CofundingOfferPartnerDto` plus `orders`:
```json
{ "orders": [ { "orderCode": "GP-2611-00123", "jobNumber": "JB-26-00456", "discountAmount": "1200.00",
                "shareAmount": "480.00", "status": "netted", "billingStatementNumber": "BS-26-00088",
                "capped": false } ] }
```
- This is the latest 50 contributions of that offer. Order and job codes are the ones the factory already sees on its
  jobs. There is no customer, address or price data.
- `status` ∈ `accrued | netted | reversed | refunded`.
- Another factory's offer → 404.

### POST /v1/partner/cofunding-offers/{offerId}/actions/accept — `partner.cofundingOffers.accept`

Header `Idempotency-Key`; body `{}`.
- **When:** only `proposed`, not past `respondBy`.
- **Effect:** `accepted`, `answered_by` / `answered_at` = now. Emits `cofunding.offer_accepted` and notifies the
  proposer + Marketing.
- **Counting:** orders placed from `max(answeredAt, validFrom)` to `min(validTo, withdrawnAt)` count when the factory
  accepts their job.
- **200** → `CofundingOfferPartnerDto`.
- **Errors:**
  - `cofunding.invalid_transition` (409);
  - `cofunding.response_closed` (409: past `respondBy`);
  - `http.not_found` (not the caller's factory);
  - `http.forbidden` (no `factory_cofunding.decide`).

### POST /v1/partner/cofunding-offers/{offerId}/actions/decline — `partner.cofundingOffers.decline`

Body `{ "reason": "ช่วงนี้ต้นทุนวัตถุดิบสูง ขอไม่ร่วมรอบนี้" }` (≥ 5 chars). `Idempotency-Key`.
- **Effect:** `declined`. Emits `cofunding.offer_declined` and notifies the proposer + Marketing.
- **200** → `CofundingOfferPartnerDto`.
- **Errors:** same as accept.

### GET /v1/admin/cofunding-contributions — `admin.cofundingContributions.list`

Query `promotionId`, `offerId`, `factoryId`, `status`, `from`, `to`, `page`, `perPage`.
```json
{ "data": [ { "id": "0192f3a0-7c1e-7d2a-9b1f-0000000f8001", "offerId": "0192f3a0-7c1e-7d2a-9b1f-0000000f7001",
              "promotionId": "0192f3a0-7c1e-7d2a-9b1f-0000000f3001",
              "factory": { "id": "0192f3a0-7c1e-7d2a-9b1f-000000000f01", "name": "โรงงาน ตัวอย่าง" },
              "orderCode": "GP-2611-00123", "jobNumber": "JB-26-00456",
              "discountAmount": "1200.00", "shareAmount": "480.00", "capped": false, "status": "netted",
              "accruedAt": "2026-11-10T11:00:00+07:00", "nettedAt": "2026-11-18T16:40:00+07:00",
              "billingStatementNumber": "BS-26-00088", "reversedAt": null, "reverseReason": null,
              "refundedAt": null } ],
  "meta": { "page": 1, "perPage": 50, "total": 1 } }
```

### Contribution rules (D-506)

1. **Accrue** on `production_job.accepted`. All of these must hold:
   - the job's factory has an `accepted` offer on a deal that discounted the job's order;
   - the order was placed in `[max(answeredAt, validFrom), min(validTo, withdrawnAt ?? ∞)]`;
   - the order is not cancelled.

   **Share:**
   - `discount_amount` = Σ (`amount − capped_amount`) of the order's `order_discounts` from that promotion on the
     lines the job produces (all of the order's deal discount when the job has no line);
   - pct: `round2(discount × sharePct / 100)`; fixed: `min(fixedAmount, discount)`;
   - then `min(share, cap − accrued)` under a row lock on the offer, with `capped` when cut;
   - nothing is written when the result is 0.

   **Effects:**
   - `accrued_amount` increases;
   - event `cofunding.contribution_accrued`;
   - when the cap is reached, `cap_reached_at` + `cofunding.cap_reached` (once).
2. **Reverse** (before netting): `production_job.reassigned` away / `production_job.rejected` → `job_reassigned` /
   `job_rejected`; `order.cancelled` → `order_cancelled`; `refund.succeeded` that leaves the order fully refunded →
   `order_refunded`. Status `reversed`, `accrued_amount` decreases (cap room comes back), nothing posted.
3. **Net** at goods receipt (`delivery.reconciled` → `purchasing.service.ts`, same transaction, after the balance
   payable is created):
   - the share is cut to that payable's `openNetAmount` (`capped`);
   - billing statement line `kind: cofunding`, description `ส่วนร่วมส่วนลด (co-funding) — {dealName}`, net `-share`,
     VAT `0.00`, gross `-share`;
   - payable `openNetAmount` and `whtBaseHire` reduced by the share;
   - statement `netAmount` / `grossAmount` include the line;
   - status `netted`;
   - event `cofunding.contribution_netted` → **P20F**.
4. **Refund** (after netting): `order.cancelled` / full refund →
   - a `payable_items` row `source = cofunding_refund`, net = share, VAT 0, WHT bases 0, `eligible` now;
   - status `refunded`;
   - event `cofunding.contribution_refunded` → **P20FR**.

   The payable is paid in the next payout run as kind `balance` (P17). It shows on the statement of account as kind
   `cofunding`.
5. A share is never applied to an order the factory did not produce.
6. Routing never reads offers or contributions.
7. Customers see the full deal discount as today.

### Statement shapes (changed)

```json
{ "lineNo": 4, "kind": "cofunding", "reference": "GP-2611-00123",
  "quantity": null, "description": "ส่วนร่วมส่วนลด (co-funding) — สั่งกล่องลูกฟูกสัปดาห์นี้ ลด 5%",
  "netAmount": "-480.00", "vatAmount": "0.00", "grossAmount": "-480.00" }
```
`totals.cofunding` = `"-480.00"`. In the statement of account, `kind: "cofunding"`, `debit` for P20F, `credit` for
P20FR.

## Analytics — funding split (D-506, Finance read-only)

### GET /v1/admin/loyalty/analytics/funding — `admin.loyaltyAnalytics.funding`

Query `from`, `to` (`YYYY-MM`, ≤ 24 months), `page`, `perPage`.
```json
{ "data": [ { "promotionId": "0192f3a0-7c1e-7d2a-9b1f-0000000f3001", "name": "สั่งกล่องลูกฟูกสัปดาห์นี้ ลด 5%",
              "productTypeName": "กล่องลูกฟูก", "weekStart": "2026-11-09",
              "orders": 31, "discountTotal": "38750.00",
              "factoryShare": "4320.00", "getpackShare": "34430.00", "reversed": "960.00",
              "factoryCount": 1, "offersAccepted": 1 } ],
  "meta": { "page": 1, "perPage": 50, "total": 1,
            "totals": { "discountTotal": "38750.00", "factoryShare": "4320.00", "getpackShare": "34430.00" } },
  "asOf": "2026-11-22T09:15:00+07:00", "currency": "THB" }
```
- Capacity deals only.
- `factoryShare` counts accrued + netted − refunded.
- `getpackShare = discountTotal − factoryShare`.
- Cached 5 minutes.

## Settings keys (new; effective-dated, audited)

`loyalty.programme_budget` (approval `programme_budget_override`) · `loyalty.surfaces` · `loyalty.rollout` (dedicated
endpoints only) · `promotions.cofunding` (`pending_cpa`). Values, owners and validation: `plans/P4-PLAN.md` §2.

## Approval policies (new)

| Key | Subject | Steps | D |
|---|---|---|---|
| `programme_budget_override` | `setting_version` | Finance Manager approval: **finance_manager** → C-Level approval: **c_level** | D-507 |
| `loyalty_rollout_advance` | `setting_version` | Finance Manager approval: **finance_manager** | D-510 |

The requester never approves their own request (engine rule). The web's approvals inbox names the policies:
- `programme_budget_override` "ขอเพิ่มงบโปรแกรมสะสมแต้ม";
- `loyalty_rollout_advance` "ขอเลื่อนขั้นการเปิดใช้โปรแกรมสะสมแต้ม".

The payload is the existing setting change `{ key, versionNo, effectiveFrom, before, after, reason }`.

## Posting (accounting-design §5 note; ⚖ §10 pending CPA)

| Event | Rule | Journal |
|---|---|---|
| `cofunding.contribution_netted` | **P20F** (new) | Dr 2110 trade payables — factory · Cr **4915** factory co-funding of discounts (contra to 4910), at `shareAmount`; dims vendor, factory, order, product type, promotion; source `cofunding_contribution` |
| `cofunding.contribution_refunded` | **P20FR** (new) | Dr 4915 · Cr 2110, at `shareAmount` |
| refund payable paid | P17 (unchanged) | Dr 2110 · Cr 112x (VAT 0, WHT 0) |

- Accrual posts nothing: there is no payable before the goods receipt.
- Treatment `contra_discount` (VAT 0 on the line, WHT base reduced) is the default until the CPA confirms. The open
  options are:
  - a supplier discount (Cr 5110, with a factory credit note / input VAT reduced);
  - a marketing contribution (getpack invoices the factory, output VAT, factory WHT).

## Domain events (new)

`cofunding.offer_proposed`, `cofunding.offer_accepted`, `cofunding.offer_declined`, `cofunding.offer_withdrawn`,
`cofunding.offer_expired`, `cofunding.offer_ended`, `cofunding.cap_reached`, `cofunding.contribution_accrued`,
`cofunding.contribution_reversed`, `cofunding.contribution_netted`, `cofunding.contribution_refunded`,
`programme_budget.threshold_reached`, `promotion.activation_deferred`, `loyalty.rollout_advance_requested`,
`loyalty.rollout_changed`.

## Notification rows

Staff and partner rows, all operational:
- `programme_budget.threshold_reached`: Marketing + Finance, in-app + e-mail;
- `cofunding.offer_proposed`: factory owners, in-app + e-mail;
- `cofunding.offer_answered`: the proposer + Marketing, in-app + e-mail;
- `cofunding.offer_expired`: the proposer, in-app;
- `cofunding.cap_reached`: Marketing + factory owners, in-app;
- `loyalty.rollout_changed`: Marketing + Finance, in-app + e-mail.

Copy: `plans/P4-PLAN.md` §5. There are no customer rows.

## Error codes (new)

| Code | HTTP |
|---|---|
| `loyalty.feature_disabled` | 404 |
| `loyalty.budget_exhausted` | 409 |
| `cofunding.deal_not_eligible` | 422 |
| `cofunding.offer_exists` | 409 |
| `cofunding.invalid_transition` | 409 |
| `cofunding.response_closed` | 409 |
| `cofunding.disabled` | 409 |
| `settings.dedicated_editor` | 409 |

- **New `validation.failed` codes:**
  - budget override: `must_raise`, `month_out_of_range`;
  - rollout: `not_an_advance`, `not_a_rollback`, `unknown_id`;
  - co-funding offer: `out_of_deal_window`, `respond_by_after_end`, `mode_value_mismatch`, `not_a_candidate`,
    `above_max`;
  - `promotions.cofunding` setting: `cofunding_treatment_unimplemented`.
- **New publish-guard rule code** inside `promotions.not_publishable`: `budget_exhausted`.
- **New enums:**
  - `LoyaltyTaskStatus` + `claimed_by_company`;
  - `BillingStatementLineKind` + `cofunding`;
  - `AccountEntryKind` + `cofunding`;
  - `CofundingShareMode`, `CofundingOfferStatus`, `CofundingContributionStatus`, `CofundingReverseReason`,
    `ProgrammeBudgetState`, `LoyaltyRolloutStage`, `RolloutGateMetric`, `RolloutGateStatus`, `CohortReason`;
  - `LoyaltySurface` (`deals | redeem | tierPerks | checklist | capacityDeals`, the `params.surface` of the problem).

## Seed (UAT only, idempotent)

Rollout `uat` with the UAT allowlists; budget ฿30,000 on UAT; on the P3 capacity-deal draft, one offer proposed (factory
A) and one accepted (factory B, 40 %, cap ฿2,000) with one accrued and one netted contribution; one verified company
with two members where member B sees two `claimed_by_company` tasks; the two approval policies; account 4915; posting
rules P20F / P20FR. Details: `plans/P4-PLAN.md` §8.
