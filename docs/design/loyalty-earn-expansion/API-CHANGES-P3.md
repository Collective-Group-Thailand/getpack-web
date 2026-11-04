# API changes — P3 Catalogue, tiers, campaigns, capacity deals (contract both sides build against)

Source: PLAN §2.3 (Phase 3 rows), §3.5.6, §4, §5, §7 Phase 3, §9.7; decisions D-478, D-479, D-485 and
**D-497…D-503**. Plan: `plans/P3-PLAN.md`. Conventions are unchanged:
- money is a decimal string, points are integers;
- dates are Bangkok-offset strings (`+07:00`) and calendar days are `YYYY-MM-DD`; quarters are `YYYY-Qn`;
- operation ids are `<surface>.<tag>.<action>`, three segments only (`OPERATION_ID_PATTERN`);
- realtime payloads are `{ type, id }` only (api-conventions §6);
- errors are `DomainException` codes in the existing namespaces;
- no factory data anywhere (GLOBAL-RULES §1, D-481) — capacity is aggregated per product type;
- customer-facing Thai says "แต้ม" (D-489).

The API agent may adjust paths or ids where the codebase demands it, but must then update this file and say why at
the top (as in P1 / P1.5 / P2). **No e2e in P3 (owner, D-503).**

## Existing endpoints that change shape

| Operation | Change |
|---|---|
| `store.promotions.listPublic` | `tab=points` is real: items are the active reward catalogue items the caller may see, as cards with `kind: "reward"` and a `reward` block (below); `counts.points` = their number. Promotion cards gain `kind: "promotion"`. Other tabs never contain rewards. Anonymous callers see costs, `myStatus: null`. |
| `store.promotions.getPublic` | Unchanged (rewards have no `/deals/{slug}` page; the card links to `/account/points/redeem#<code>`). |
| `store.loyalty.get` | `tier` adds `platinum`; `nextTier` may be `platinum`. Gains `perks[]`, `nextTierPerks[]`, `activeMultipliers[]`, `anniversaryMonth`, `rewardCoupons` (open count). |
| `store.loyalty.ledger`, `admin.loyalty.ledger` | `redeem` / `redeem_reversal` items gain `reward` (`{ redemptionId, code, name }`) when from the catalogue; `earn_order` `multipliers` gains `campaign`, `anniversary`, `earlyPay`. |
| `store.loyalty.campaigns` | Items gain `kind` values `admin_rule` and `anniversary`, plus `name`, `productTypeCodes` (null = all). Only campaigns the caller matches are listed; audience facts are never disclosed. |
| `store.cart.applicableCodes` | `notYet[].reason` adds `capacity` (free rush), `no_design_service` (revision round), `no_sample_line`, `addon_not_selected`, `points_cap` (reward coupon over the D-133 20 % cap with checkout points). Reward coupons held by the caller are listed like any held code. |
| `store.promotions.checkCode`, checkout preview / place (`promotion` extension) | Accept benefit v2 kinds; the order preview gains `perks[]` items `free_rush` (`{ daysSaved, promisedShipDate }`) and `revision_round` (`{ rounds }`). |
| `admin.promotions.create` / `update` / `get` / `list` | `benefit` accepts **v2** (`benefitSchemaVersion: 2`); `PromotionDto` gains `benefitSchemaVersion`, `origin` (`manual | system | capacity_deal`) and, for capacity deals, `capacityDeal` (`{ weekStart, productTypeCode, freePct, approval }`). `list` gains `?origin=`. |
| `admin.promotions.action` | `publish` (visibility → `public` / `unlisted`) of an `origin = capacity_deal` promotion is refused by the publish guard without an approved `capacity_deal_publish` request (rule code `approval_required`). System promotions (`origin = system`, including `reward.*` and `tier.free_shipping`) still never leave `hidden` (D-487). |
| `admin.loyaltyCampaigns.list` | `kind` filter adds `admin_rule`, `anniversary`; items gain `name`, `productTypeCodes`, `audience`, `createdBy`. |
| `admin.companyCredit.get` | Each version gains `origin`, `baseVersionId`, `upliftFactor`, `companyTier`; the credit gains `uplift` (`{ mode, modeReason, baseLimit, companyTier, companySpend12m, target, capped, aboveCapTarget }`). |
| `admin.financialReports.profitAndLoss` | **No change** (D-503): the P2 `pointsLiability` memo already reads 2330, which P11 at catalogue redemption reduces. |

## Benefit schema v2 (`benefitSchemaVersion: 2`)

v2 = every v1 kind plus:

```json
[
  { "type": "free_shipping", "maxAmount": "300.00" },
  { "type": "free_sample", "maxAmount": "500.00" },
  { "type": "free_rush", "daysSaved": 2 },
  { "type": "free_addon", "addonCode": "spot_uv", "maxAmount": "1500.00" },
  { "type": "revision_round", "rounds": 1 }
]
```

| Kind | Applied by the checkout | Money / perk |
|---|---|---|
| `free_shipping` | as v1 (shipping lines of the matching orders); `maxAmount` optional (v1 had none) | money (line discount) |
| `free_sample` | the product and mockup lines of a **sample** order (the `samples` extension runs before promotions); other orders → `notYet` `no_sample_line` | money, ≤ `maxAmount` |
| `free_rush` | perk: when `CapacityService.nextAvailable` can take the order `daysSaved` working days earlier than the standard promise, the order gets `priority_production = true` (`priority_reason = free_rush`) and the shorter promised ship date; otherwise the code is not applied (`notYet` `capacity`) and stays unused | perk, no money |
| `free_addon` | product lines whose configuration selects `addonCode` (a finish / coating option code); discount = line price − the quote engine's price of the same configuration without the addon, ≤ `maxAmount`; other lines → `addon_not_selected` | money |
| `revision_round` | perk on orders with a design service (`design_fee` line): `rounds` extra free revision rounds on that order's design request, so the D-071 extra-revision fee is not charged for them; otherwise `no_design_service` | perk, no money |

- `daysSaved` 1–5, `rounds` 1–3, `addonCode` `^[a-z0-9_]{2,40}$` and must exist as a finish option of at least one
  product type (422 path `benefit.addonCode`, code `unknown_addon`).
- A v1 promotion saved with a v2 kind → 422 `validation.failed`, path `benefitSchemaVersion`, code `version_required`.
- The margin guard applies to every money kind (D-053 unchanged). Perks are recorded in the redemption snapshot.
- Benefit summary texts (th): "ส่งฟรี", "ตัวอย่างฟรี", "ผลิตด่วนฟรี (ตามคิว)", "อัปเกรดงานพิมพ์ฟรี: {addon}", "แก้แบบเพิ่มฟรี {n} รอบ".

## Store — rewards (`store` surface, tag `rewards`; list is public, the rest need a customer)

### GET /v1/store/rewards — `store.rewards.list`

```json
{ "balance": 214, "items": [ {
  "id": "0192f3a0-7c1e-7d2a-9b1f-0000000e0001",
  "code": "free_shipping",
  "kind": "free_shipping",
  "name": "ส่งฟรี 1 คำสั่งซื้อ",
  "description": "ใช้กับคำสั่งซื้อขั้นต่ำ ฿2,000",
  "costPoints": 60,
  "valueText": "ส่งฟรี",
  "conditions": [ "ขั้นต่ำ ฿2,000" ],
  "tierRequired": null,
  "validityDays": 90,
  "canRedeem": true,
  "blockedReason": null,
  "missingPoints": 0,
  "nextAvailableAt": null
} ] }
```
- `kind` ∈ `cash_off | free_shipping | free_sample | free_rush | free_addon | revision_round`.
- `blockedReason` ∈ `insufficient_points | tier | frequency | open_limit | held | null`; `missingPoints` with
  `insufficient_points`; `nextAvailableAt` with `frequency` (free sample: 3 months after the last one).
- Anonymous: `balance`, `canRedeem`, `blockedReason` are null. Texts in the request locale. Cached 60 s for
  anonymous callers only.

### POST /v1/store/rewards/{itemId}/actions/redeem — `store.rewards.redeem`

Header `Idempotency-Key` required. Body `{}` (optional `{ "expectedCostPoints": 60 }` → 409 `rewards.cost_changed`
when the cost changed). In one transaction: row-lock the user's lots, write a `redeem` entry of `-costPoints`
(FIFO by expiry, `meta.rewardRedemptionId`), issue one per-customer coupon (`assigned_user_id`, `usage_limit 1`,
`expires_at = now + validityDays`) on the item's system promotion, insert `reward_redemptions`, emit
`points.redeemed` (context `catalogue`, P11) and `reward.redeemed`.

201 →
```json
{ "id": "0192f3a0-7c1e-7d2a-9b1f-0000000e1001",
  "item": { "code": "free_shipping", "name": "ส่งฟรี 1 คำสั่งซื้อ", "kind": "free_shipping" },
  "source": "catalogue", "pointsSpent": 60, "balanceAfter": 154, "status": "issued",
  "coupon": { "code": "GP-RW-7Q4K-M2XD", "expiresAt": "2027-02-02T23:59:59+07:00" },
  "cancellableUntil": "2026-11-11T14:05:00+07:00", "usedOrderCode": null,
  "createdAt": "2026-11-04T14:05:00+07:00" }
```

| Code | HTTP | When |
|---|---|---|
| `http.not_found` | 404 | item not active / outside its window |
| `rewards.insufficient_points` | 422 | balance < cost (`params.missingPoints`) |
| `rewards.tier_required` | 422 | `tierRequired` above the caller's tier |
| `rewards.frequency_limit` | 422 | free sample within 3 months (`params.nextAvailableAt`) |
| `rewards.open_limit` | 422 | `maxOpenPerItem` unused coupons of the item already held |
| `rewards.account_held` | 422 | a D-477 held review is open on the account |
| `rewards.cost_changed` | 409 | `expectedCostPoints` differs |
| `idempotency.*` | as today | replay returns the first response |

### GET /v1/store/rewards/redemptions — `store.rewards.listMine`

Query `status` (`issued | used | cancelled | expired`), `page`, `perPage`. Items = the redeem response shape plus
`source` (`catalogue | tier_perk`) and `perkPeriod` (`2026-Q4` for perks). Tier-perk coupons have `pointsSpent: 0`
and `cancellableUntil: null`.

### POST /v1/store/rewards/redemptions/{redemptionId}/actions/cancel — `store.rewards.cancel`

Only `issued`, `source = catalogue`, unused and before `cancellableUntil` (7 days). Coupon → `cancelled`,
`redeem_reversal` restores the points to the lots they came from (lots already expired are not revived — ADR-0007
rule), event `points.redemption_reversed` (P11R) and `reward.redemption_cancelled`. 200 → the redemption.
Errors: `rewards.cancel_window_closed` (409), `rewards.coupon_used` (409), `rewards.not_cancellable` (409, tier
perk), `http.not_found`.

### GET /v1/store/promotions?tab=points — `store.promotions.listPublic` (changed)

```json
{ "items": [ {
  "kind": "reward",
  "id": "0192f3a0-7c1e-7d2a-9b1f-0000000e0001",
  "headline": "ส่งฟรี 1 คำสั่งซื้อ",
  "benefitText": "ส่งฟรี",
  "conditions": [ "ขั้นต่ำ ฿2,000" ],
  "reward": { "code": "free_shipping", "costPoints": 60, "tierRequired": null, "canRedeem": true, "blockedReason": null },
  "href": "/account/points/redeem#free_shipping",
  "myStatus": null
} ], "counts": { "all": 6, "for_you": 2, "ending_soon": 1, "points": 8 } }
```

## Store — loyalty (changed)

`GET /v1/store/loyalty` — `store.loyalty.get` adds:
```json
{ "tier": "platinum",
  "perks": [
    { "code": "free_shipping_every_order", "status": "active" },
    { "code": "priority_support", "status": "active" },
    { "code": "priority_production_slot", "status": "active" },
    { "code": "quarterly_free_rush", "status": "granted", "period": "2026-Q4", "redemptionId": "0192f3a0-7c1e-7d2a-9b1f-0000000e1002", "couponExpiresAt": "2027-01-31T23:59:59+07:00" }
  ],
  "nextTierPerks": [],
  "activeMultipliers": [
    { "source": "tier", "multiplier": "2.00" },
    { "source": "anniversary", "multiplier": "2.00", "endsOn": "2026-11-30" },
    { "source": "campaign", "multiplier": "1.50", "name": "สะสมแต้มกล่องลูกฟูก", "endsAt": "2026-11-30T23:59:59+07:00" }
  ],
  "maxCombinedMultiplier": "3.00",
  "anniversaryMonth": 11,
  "rewardCoupons": 2 }
```
- Perk `code` ∈ `quarterly_free_shipping | free_shipping_every_order | priority_support | quarterly_free_rush |
  priority_production_slot`; `status` ∈ `active | granted | used | next_quarter`.
- Customer copy for `priority_production_slot`: "คิวผลิตลำดับพิเศษ" — no date promise, no factory.
- `activeMultipliers` are informational; the web never multiplies (preview `points` carries the numbers).

## Earning (`earnForOrder`, D-499)

`earn_order = ⌊⌊base ÷ ฿500⌋ × min(3.00, tier × payment × reorderCampaign × promotion × campaign × anniversary × earlyPay)⌋`

| Factor | Rule | Setting |
|---|---|---|
| `campaign` | best single active `admin_rule` campaign whose window contains the order's `created_at`, whose `productTypeCodes` (null = any) include a product line's type and whose `audience` (conditions v2 semantics) the customer matches | `loyalty_campaigns` |
| `anniversary` | order placed in the Bangkok calendar month of the account's `created_at`, from the first anniversary on | `loyalty.order_multipliers.anniversary` 2.00 |
| `earlyPay` | the group's receivable is settled in full by one receipt at least `minDaysBeforeDue` days before its due date, on a credit-term (non-instalment) group; applied when the pending entry is credited (`creditDue`) | `loyalty.order_multipliers.earlyPay` 1.20 |
| others | as P2 (D-495) | — |

`meta.multipliers` = `{ tier, paymentMethod, reorderCampaign, promotion, campaign, anniversary, earlyPay, combined,
capped }`. Checkout preview `points.multipliers` gains `campaign` and `anniversary` (`earlyPay` is `"1.00"` in the
preview, offered as `earlyPayBonus: { multiplier: "1.20" } | null` for credit-term checkouts).

## Admin — reward catalogue (`admin` surface; `promotions.read` to read, `promotions.manage` to write)

| Method + path | Operation id |
|---|---|
| `GET /v1/admin/loyalty/rewards` | `admin.rewardCatalog.list` |
| `POST /v1/admin/loyalty/rewards` | `admin.rewardCatalog.create` |
| `GET /v1/admin/loyalty/rewards/{itemId}` | `admin.rewardCatalog.get` |
| `PATCH /v1/admin/loyalty/rewards/{itemId}` | `admin.rewardCatalog.update` (`If-Match`) |
| `POST /v1/admin/loyalty/rewards/{itemId}/actions/{action}` (`activate | pause | archive`) | `admin.rewardCatalog.action` |
| `GET /v1/admin/loyalty/reward-redemptions` | `admin.rewardRedemptions.list` (`loyalty.read`) |
| `POST /v1/admin/loyalty/reward-redemptions/{redemptionId}/actions/cancel` | `admin.rewardRedemptions.cancel` (`loyalty.adjust`) |

Item body:
```json
{ "code": "print_upgrade_spot_uv", "kind": "free_addon",
  "name": { "th": "อัปเกรดเคลือบ Spot UV", "en": "Spot UV upgrade" },
  "description": { "th": "ใช้กับกล่องพิมพ์ที่เลือก Spot UV", "en": "For printed boxes with Spot UV selected" },
  "costPoints": 100,
  "value": { "type": "free_addon", "addonCode": "spot_uv", "maxAmount": "1500.00" },
  "constraints": { "minOrderValue": null, "productTypeCodes": ["folding_carton"], "perUserEveryMonths": null },
  "tierRequired": null, "validityDays": 90,
  "activeFrom": "2026-12-01T00:00:00+07:00", "activeTo": null, "sortOrder": 50 }
```
- `value` must be a benefit v2 of the item's `kind` (`cash_off` → `{ "type": "fixed", "amount": "50.00" }`); cost 1–
  100,000; `validityDays` 7–365; `code` immutable after activation.
- Cash-off items carry `constraints.minOrderValue` ≥ 5 × amount (keeps the D-133 20 % cap: 422 code `cap_floor`).
- Create writes the backing system promotion (`origin = system`, `systemKey = reward.<code>`, `kind = coupon`,
  coupon kind `per_customer`, `visibility = hidden`, stack group `reward:<kind>`, conditions from `constraints`);
  update writes a new promotion version of its benefit / conditions (issued coupons keep their snapshot).
- Errors: `validation.failed` (codes `cap_floor`, `kind_mismatch`, `unknown_addon`), `rewards.code_taken` (409),
  `rewards.item_active` (409: code or kind edit while active), `concurrency.stale` (412).
- Seed (UAT): `cash_off_50` 20, `cash_off_100` 40, `cash_off_250` 100, `free_shipping` 60 (min ฿2,000),
  `free_sample` 80 (every 3 months), `free_rush` 120, `print_upgrade` 100 (`spot_uv`, folding carton), `artwork_round`
  40 (`revision_round` 1).

`admin.rewardRedemptions.cancel` body `{ "reason": "ลูกค้าขอยกเลิก — แลกผิดรายการ" }` (≥ 10 chars): any unused
catalogue redemption, any time; audited; same reversal as the store cancel.

## Admin — loyalty campaigns (`promotions.manage` to write; P2 list unchanged otherwise)

| Method + path | Operation id |
|---|---|
| `POST /v1/admin/loyalty/campaigns` | `admin.loyaltyCampaigns.create` |
| `GET /v1/admin/loyalty/campaigns/{campaignId}` | `admin.loyaltyCampaigns.get` |
| `PATCH /v1/admin/loyalty/campaigns/{campaignId}` | `admin.loyaltyCampaigns.update` (before `startsAt` only; `If-Match`) |
| `POST /v1/admin/loyalty/campaigns/{campaignId}/actions/cancel` | `admin.loyaltyCampaigns.cancel` |

```json
{ "name": "สะสมแต้มกล่องลูกฟูก ×1.5", "kind": "admin_rule", "multiplier": "1.50",
  "startsAt": "2026-12-01T00:00:00+07:00", "endsAt": "2026-12-31T23:59:59+07:00",
  "productTypeCodes": ["corrugated_rsc"],
  "audience": { "tiers": ["silver", "gold", "platinum"] },
  "reason": "year_end_2026" }
```
- `multiplier` 1.01–5.00 (the ×3.00 combined cap still applies at earning); `endsAt` > `startsAt`, window ≤ 92 days;
  `audience` = conditions v2 audience (D-494 validation; `businessTypes` / `inactiveDaysGte` allowed but never shown to
  customers); `reason` `^[a-z0-9_]{3,40}$`.
- Errors: `validation.failed`, `loyalty.campaign_started` (409 on update after start), `concurrency.stale`.
- Anniversary campaigns are not rows: the anniversary factor comes from the setting (listed in `store.loyalty.campaigns`
  as a virtual item `kind: "anniversary"` during the month).

## Admin — credit-limit tier uplift (D-485, D-501)

### Job rule (`b2b.credit_tier_uplift`, nightly, only when `enabled`)

For each active company with an approved permanent `origin = request` version (the **base**) and `uplift_mode = auto`:
1. `companyTier` = tier of the company's own completed spend over 12 months (orders placed for the company; same
   `loyalty.tiers` thresholds).
2. `target` = base × factor (`gold` 1.50, `platinum` 2.00; other tiers 1.00).
3. If base ≥ `capAmount` → nothing automatic. Else `auto = min(target, capAmount)`.
4. If `auto` differs from the limit in force: a new version `status = approved`, `origin = tier_uplift`,
   `effective_from = now`, `term_days` = base's, `base_version_id`, `uplift_factor`, `company_tier`, reason
   `tier_uplift`, created by system `b2b.credit_tier_uplift`, audited; no approval request (D-485 amends D-449/D-451
   for this case only). A downgrade writes the version back to the base amount (never below base).
5. `target > capAmount` → the Finance notification carries `aboveCapTarget`; Finance may file the full amount through
   `admin.companyCredit.requestLimit` (prefilled, reason `tier_uplift`), which follows the `credit_limit` policy as
   today.
6. A new `request` version approved later becomes the new base; the next run re-derives from it.

### PUT /v1/admin/companies/{companyId}/credit/uplift — `admin.companyCredit.setUpliftMode` (`company_credit.manage`)

```json
{ "mode": "frozen", "reason": "รอตรวจงบการเงินปี 2569 ก่อนปรับวงเงิน" }
```
- `auto` — the job manages uplift; `frozen` — the job writes nothing, the limit in force stays; `off` — writes a
  version `origin = tier_uplift_override` back to the base amount now and the job writes nothing.
- 200 → `AdminCompanyCreditDto`. Errors: `validation.failed` (reason ≥ 10 chars), `companies.uplift_not_eligible`
  (422: no approved base), `http.not_found`. Audited; event `company.credit_uplift_mode_changed`.

### GET /v1/admin/credit-uplifts — `admin.creditUplifts.list` (`company_credit.manage` or `companies.read`)

Query `from`, `to`, `companyId`, `aboveCap` (bool), `page`, `perPage`.
```json
{ "items": [ {
  "versionId": "0192f3a0-7c1e-7d2a-9b1f-0000000b1001",
  "company": { "id": "0192f3a0-7c1e-7d2a-9b1f-0000000c0001", "legalName": "บริษัท ตัวอย่าง จำกัด" },
  "companyTier": "platinum", "companySpend12m": "612400.00",
  "baseLimit": "600000.00", "factor": "2.00", "target": "1200000.00",
  "newLimit": "1000000.00", "previousLimit": "900000.00", "capped": true, "aboveCapTarget": "1200000.00",
  "effectiveFrom": "2026-11-05T03:10:00+07:00", "mode": "auto",
  "pendingRequest": null
} ] }
```

### Notification `credit_limit.tier_uplift` (staff, Finance team)

Payload: company, tier, base, previous, new limit, capped, `aboveCapTarget`, link to the company credit panel. Th
subject "ปรับวงเงินเครดิตตามระดับสมาชิก: {company}".

## Admin — capacity deals (D-502)

- **Provider** `CapacityOutlookProvider.weekOutlook(productTypeId, weekStart) → { capacity, booked, freePct } | null`.
  Default `CapacityBookingsOutlook`: Σ over factories of the D-101 weekly capacity (version or override) minus Σ live
  `capacity_bookings`, per product type; null when no capacity is configured. `DisabledCapacityOutlook` when
  `promotions.capacity_deal.enabled = false`. No factory id ever leaves the provider.
- **Worker** `promotions.capacity_deals`: next week (`horizonWeeks`), `freePct ≥ minFreePct` → one draft per product
  type × week: promotion `kind = automatic`, `origin = capacity_deal`, `visibility = hidden`, `status = active`,
  window = now … end of that week's Sunday, conditions `{ productTypeCodes: [type] }`, benefit `{ type: "percent",
  pct: discountPct }`, display headline "สั่ง{productTypeName}สัปดาห์นี้ ลด {discountPct}%" and subline "คิวผลิตว่าง
  รับงานเร็วขึ้นสูงสุด {leadTimeDaysSaved} วัน" only when `nextAvailable` is at least that much earlier than the standard
  promise (otherwise no lead-time text); then an approval request `capacity_deal_publish` (subject `promotion`) and the
  staff notification `capacity_deal.drafted`.
- **Approval** policy `capacity_deal_publish`: one step, role `marketing`; the requester is the system; a display edit
  by a person withdraws the open request and opens a new one with that person as requester (who then cannot approve).
  Approved → the promotion may be published by `admin.promotions.action` (`publish`), still through the P1.5 publish
  guard and wording rules. Rejected → the promotion ends.

### GET /v1/admin/promotions/capacity-deals — `admin.capacityDeals.list` (`promotions.read`)

```json
{ "items": [ {
  "promotionId": "0192f3a0-7c1e-7d2a-9b1f-0000000f3001",
  "productTypeCode": "corrugated_rsc", "productTypeName": "กล่องลูกฟูก",
  "weekStart": "2026-11-09", "freePct": "41.50", "discountPct": "5",
  "visibility": "hidden", "status": "active",
  "approval": { "id": "0192f3a0-7c1e-7d2a-9b1f-0000000a9001", "status": "pending" },
  "createdAt": "2026-11-04T07:20:00+07:00"
} ], "provider": "capacity_bookings" }
```
`freePct` is aggregated per product type; no factory, factory count or per-factory number is returned.

## Settings keys (new or new version; effective-dated, audited)

`loyalty.tiers` (Platinum) · `loyalty.tier_perks` · `loyalty.rewards` · `loyalty.order_multipliers` (anniversary,
early pay) · `promotions.free_rush` · `promotions.capacity_deal` · `b2b.credit_tier_uplift` (disabled by default;
UAT seed enables). Values and owners: `plans/P3-PLAN.md` §2.

## Posting (accounting-design §5 note)

| Event | Rule | Journal |
|---|---|---|
| `points.redeemed` (context `catalogue`) | P11 (new version: dims `rewardRedemption` instead of `orderGroup`) | Dr 2330 · Cr 4930 at points × point value |
| coupon used on an order | P09 (discount `source = points_reward` → 4930) | Dr 4930 · Cr revenue (on the delivery document) |
| `points.redemption_reversed` (catalogue cancel) | P11R | Dr 4930 · Cr 2330 |
| `reward.coupon_expired` | **P12C** (new) | Dr 4930 · Cr 4990 at the redemption's baht value |

Tier-perk coupons spend no points: their discount posts as a normal promotion (4910, P09).

## Realtime (user channel, `{ type, id }` only)

| Type | `id` | Web refetches |
|---|---|---|
| `reward.redeemed` | redemption public id | `store.rewards.list`, `store.rewards.listMine`, `store.loyalty.get` |
| `loyalty.perk_granted` | redemption public id | `store.loyalty.get`, `store.rewards.listMine` |

## Domain events (new)

`reward.redeemed`, `reward.redemption_cancelled`, `reward.coupon_used`, `reward.coupon_expired`, `reward.coupon_expiring`
(notification), `loyalty.perk_granted`, `company.credit_limit_uplifted`, `company.credit_uplift_mode_changed`,
`credit_limit.tier_uplift` (notification), `promotion.capacity_deal_drafted`, `capacity_deal.drafted` (notification),
`order.priority_production_set`.

## Notification rows

`reward.redeemed` (customer, in-app + e-mail, transactional) · `reward.coupon_expiring` (customer, in-app + e-mail +
LINE, transactional) · `loyalty.perk_granted` (customer, in-app + e-mail + LINE) · `credit_limit.tier_uplift` (staff,
Finance) · `capacity_deal.drafted` (staff, Marketing). Copy: `plans/P3-PLAN.md` §5.

## Error codes (new)

| Code | HTTP |
|---|---|
| `rewards.insufficient_points` | 422 |
| `rewards.tier_required` | 422 |
| `rewards.frequency_limit` | 422 |
| `rewards.open_limit` | 422 |
| `rewards.account_held` | 422 |
| `rewards.cost_changed` | 409 |
| `rewards.cancel_window_closed` | 409 |
| `rewards.coupon_used` | 409 |
| `rewards.not_cancellable` | 409 |
| `rewards.code_taken` | 409 |
| `rewards.item_active` | 409 |
| `loyalty.campaign_started` | 409 |
| `companies.uplift_not_eligible` | 422 |

New `validation.failed` codes: `version_required`, `unknown_addon`, `cap_floor`, `kind_mismatch`. New publish-guard rule
code inside `promotions.not_publishable`: `approval_required`. New `notYet` reasons: `capacity`, `no_design_service`,
`no_sample_line`, `addon_not_selected`, `points_cap`.

## Seed (UAT only, idempotent)

8 catalogue items + their hidden system promotions; system promotion `tier.free_shipping` (hidden, automatic,
audience tiers gold + platinum); one Platinum customer with this quarter's perks granted; one Gold company with a
฿200,000 base and `b2b.credit_tier_uplift.enabled = true` on UAT; one admin campaign ×1.5 (corrugated); one capacity
deal awaiting approval; approval policy `capacity_deal_publish`.
