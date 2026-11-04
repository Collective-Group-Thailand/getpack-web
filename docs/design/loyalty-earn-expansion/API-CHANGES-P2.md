# API changes — P2 Engagement, lifecycle, segments, analytics (contract both sides build against)

Source: PLAN §2.2, §2.3 (Phase 2), §3.5.5, §6, §7 Phase 2, §9.3; decisions D-480, D-482, D-487 and **D-488…D-495**.
Conventions are unchanged:
- money is a decimal string, points are integers;
- dates are Bangkok-offset strings (`+07:00`) and calendar days are `YYYY-MM-DD`;
- operation ids are `<surface>.<tag>.<action>`, three segments only (`OPERATION_ID_PATTERN`);
- realtime payloads are `{ type, id }` only (api-conventions §6);
- errors are `DomainException` codes in the existing namespaces;
- no factory data anywhere (GLOBAL-RULES §1, D-481);
- customer-facing Thai says "แต้ม" (D-489).

The API agent may adjust paths or ids where the codebase demands it, but must then update this file and say why at
the top (as in P1 / P1.5).

## Existing endpoints that change shape

| Operation | Change |
|---|---|
| `store.promotions.listPublic` | `tab=for_you` is real: the deals whose `audience` the caller matches, plus deals whose product types the caller has ordered. Anonymous callers get new-customer deals. Items gain `forYou`, `forYouReason`, `bundle`. `myStatus = not_eligible` adds the reason `audience`; `counts.for_you` is per caller. `matching_only` deals are left out for anonymous and non-matching callers (also in `all`). The cache stays 60 s for anonymous callers only. |
| `store.promotions.getPublic` | Same item additions. A `matching_only` deal answers 404 to anonymous and non-matching callers (it stays out of the sitemap and JSON-LD). |
| `store.cart.applicableCodes` | `notYet[].reason` adds `audience` and `product_type_count` (reasonText "เพิ่มสินค้าอีก 1 ประเภทเพื่อรับส่วนลดชุด"). |
| `admin.promotions.create` / `admin.promotions.update` / `admin.promotions.get` / `admin.promotions.list` | `conditions` accepts **v2** (`conditionsSchemaVersion: 2`). `display` accepts `listing` and `bundle` (`displaySchemaVersion: 2`). New 422 rules; `PromotionDto` echoes both versions. v1 rows keep working unchanged. |
| `admin.promotions.report` | `refAgents[]` items gain `signups`, `customers`, `orderGroups`, `grossAmount`, `discountAmount`, `redemptions`. |
| `store.reviews.submit` | Body gains `photoFileIds` (0–4). `ReviewDto` gains `photos[]`, `photoRewardPoints`; `rewardPoints` = review + photo reward. |
| `store.reviews.get`, `admin.reviews.list`, `store.reviews.listPublic` | `photos[]` (public list: only scrubbed photos of published reviews). |
| `store.loyalty.tasks` | `code` adds `data_refresh`, `showcase_consent`, `first_sample`; each task gains `nextDueAt` (non-null only for `data_refresh` when done). |
| `store.loyalty.get` | Gains `bonusLots[]` (win-back lots: points, expiresAt) and `activeCampaigns` count. |
| `store.loyalty.ledger`, `admin.loyalty.ledger` | `entryType` adds the 5 new types; items gain `bonusReason` (`first_order | winback | promotion | null`) and `multipliers` (on `earn_order`, else null). |
| `store.reorderSuggestions.list` | Items gain `predictedStockOutOn` and `bonus` (`{ multiplier, endsAt } \| null`). |
| `admin.financialReports.profitAndLoss` | Gains a `pointsLiability` memo block. |
| Checkout preview (`points_preview` extension: `store.checkout.preview`, `admin.checkout.preview`) | `preview.points` gains `multipliers`, `toEarnWithPaymentBonus`, `paymentBonus`. |
| Report `points_liability` (`admin.reports.preview` / `export`, key `points_liability`) | Earnings count at `coalesce(available_at, created_at)` (D-488). Columns are unchanged; past months now include activity rewards. |

## Schema (summary; details in `plans/P2-PLAN.md` §3)

- **Ledger:**
  - `points_entry_type` adds `earn_review_photo`, `earn_first_sample`, `earn_survey`, `earn_showcase_consent`,
    `earn_data_refresh`.
  - `earn_bonus.meta.reason` ∈ `first_order | winback | promotion`.
  - `earn_order.meta.multipliers` = `{ tier, paymentMethod, reorderCampaign, promotion, combined, capped }`.
  - New rewards carry `available_at`.
- **New tables:** `loyalty_campaigns`, `reorder_reminders`, `survey_templates`, `survey_instances`,
  `survey_responses`, `order_review_photos`, `showcase_consents`.
- **New columns:** `customer_profiles.data_confirmed_at`.
- **Promotions:** `promotions.conditions_schema_version` ∈ {1, 2}; `display_schema_version` ∈ {1, 2}.

All new `earn_*` types post exactly like `earn_signup` (P10, account 2330 at the D-480 rate). P10 does not switch on
the entry type.

## Conditions v2 (`conditionsSchemaVersion: 2`)

v2 = every v1 key plus:

```json
{
  "productTypeCodes": ["folding_carton", "corrugated_rsc"],
  "audience": {
    "newCustomer": false,
    "tiers": ["silver", "gold"],
    "businessTypes": ["food", "cosmetics"],
    "inactiveDaysGte": 90,
    "orderedProductTypeCodes": ["corrugated_rsc"]
  },
  "cartProductTypeCountGte": 2
}
```

- **Audience semantics:**
  - Every audience key that is present must hold (AND); inside a key, any listed value matches (OR).
  - `newCustomer: true` = no paid order yet (the engine's `segment = new`).
  - `tiers` ⊆ `LoyaltyTier`.
  - `businessTypes` ⊆ packaging-profile `productCategories` (`food | beverage | cosmetics | apparel | electronics |
    ecommerce | industrial | other`); a customer with no packaging profile never matches.
  - `inactiveDaysGte` = whole Bangkok days since the last paid order; a customer with no order never matches.
  - `orderedProductTypeCodes` = product types of the caller's paid orders (the company's, when ordering for a company).
- **`cartProductTypeCountGte`:** distinct product types among the product lines (2–10).
- **v1 `segments` in v2:** still accepted, but the admin editor writes `audience` instead. `segments` and `audience`
  together → 422 path `conditions.segments`, code `exclusive`.
- **Bundle rule (D-494):** a promotion has `cartProductTypeCountGte ≥ 2` **if and only if** `stackGroup = 'bundle'`.
  Otherwise 422 `validation.failed`, path `conditions.cartProductTypeCountGte` or `stackGroup`, code `bundle_pair`.
  Inside the `bundle` group only the best promotion applies (existing engine rule).
- **Engine reasons:** new `failedCondition` reasons `audience` and `product_type_count`. The audience facts are loaded
  once per checkout and cached on the draft.
- **Publish guard additions (`promotions.not_publishable`, 422, `errors[]`):**
  - `bundle_unpriceable` (a preset does not price today);
  - `bundle_items` (fewer than 2 or more than 4 items, or fewer distinct types than `cartProductTypeCountGte`);
  - `audience_words` (display text names an audience attribute: ไม่ได้สั่ง, ห่างหาย, inactive, ประเภทธุรกิจ…).

## Display v2 (`displaySchemaVersion: 2`)

Adds to the P1.5 display:

```json
{
  "listing": "everyone",
  "bundle": {
    "items": [
      { "productTypeCode": "corrugated_rsc", "configuration": { "lengthMm": 300, "widthMm": 200, "heightMm": 150, "flute": "B", "print": "1c_outside" }, "quantity": 500 },
      { "productTypeCode": "sticker_label", "configuration": { "shape": "circle", "diameterMm": 50, "material": "pp_white" }, "quantity": 1000 }
    ]
  }
}
```

- `listing` ∈ `everyone` (default) | `matching_only`. A `matching_only` deal must have an `audience` (422 code
  `listing_requires_audience`) and is never `featured`.
- `bundle` is required when the conditions are a bundle and refused otherwise. Each `configuration` is validated by the
  product type's specification schema (the same as `store.quotes.calculate`).

## Store

### GET /v1/store/promotions — `store.promotions.listPublic` (changed)

Query unchanged (`tab`, `productTypeCode`, `ref`). Items gain:

```json
{
  "forYou": true,
  "forYouReason": "ordered_product_type",
  "bundle": {
    "items": [
      { "productTypeCode": "corrugated_rsc", "productTypeName": "กล่องลูกฟูก", "summary": "30 × 20 × 15 ซม. · ลอน B · พิมพ์ 1 สี", "quantity": 500, "unit": "ใบ", "unitPrice": "14.79" },
      { "productTypeCode": "sticker_label", "productTypeName": "สติกเกอร์", "summary": "วงกลม 5 ซม. · PP ขาว", "quantity": 1000, "unit": "ดวง", "unitPrice": "1.20" }
    ],
    "estimatedSaving": "640.00"
  },
  "myStatus": "not_eligible",
  "notEligibleReason": "audience"
}
```

- `forYouReason` ∈ `new_customer | tier | ordered_product_type | null`. Deals that match only on `businessTypes` or
  `inactiveDaysGte` give `null`: they are in the tab, but the reason is never disclosed.
- `bundle` is `null` for non-bundle deals.
  - `unitPrice` is VAT-inclusive (D-220), priced today from the preset (cached with the list).
  - `estimatedSaving` is VAT-exclusive, before the margin guard.
- **Signed-out callers:**
  - `tab=for_you` = `audience.newCustomer` deals plus deals with no audience;
  - `counts.for_you` matches;
  - the web shows a sign-in prompt above.

### POST /v1/store/promotions/{promotionId}/actions/add-bundle — `store.promotions.addBundle` (customer)

Saves one quotation per bundle item from its preset (same engine as `store.quotes.save`) and adds each option to
my cart in one transaction. Accepts `If-Match` of the cart (as `store.cart.addItem`).

Request:
```json
{ "items": [ { "designOption": "own_file" }, { "designOption": "hired_design", "designNote": "ใช้โลโก้เดิม" } ] }
```
`items` has one entry per bundle item, in order (optional; the default is `own_file` for each).

201 → `CartDto` plus header `X-Added-Item-Ids` (comma-separated cart item ids). Errors:

| Code | HTTP | When |
|---|---|---|
| `http.not_found` | 404 | not shown to the caller (hidden, ended, `matching_only` mismatch) |
| `promotions.not_bundle` | 422 | the promotion has no bundle |
| `promotions.bundle_unavailable` | 422 | an item no longer prices (`errors[]` names `items[i]`) |
| `cart.item_exists`, `cart.design_option_unavailable`, `cart.mockup_price_unavailable`, `quotes.not_live` | as today | from the cart |
| `concurrency.stale` | 412 | stale `If-Match` |

The engine decides the discount at checkout (no price is promised by the add).

### GET /v1/store/loyalty/campaigns — `store.loyalty.campaigns` (customer)

```json
{ "items": [ {
  "id": "0192f3a0-7c1e-7d2a-9b1f-0000000c2001",
  "kind": "reorder_bonus",
  "multiplier": "1.50",
  "startsAt": "2026-11-05T09:40:00+07:00",
  "endsAt": "2026-11-12T09:40:00+07:00",
  "productTypeCode": "corrugated_rsc",
  "productTypeName": "กล่องลูกฟูก",
  "reorderOfOrderId": "0192f3a0-7c1e-7d2a-9b1f-0000000a0101",
  "reorderOfOrderCode": "OR-2610-0042"
} ] }
```
Only `active` campaigns of the caller (and of companies where the caller may order).

### GET /v1/store/reorder-suggestions — `store.reorderSuggestions.list` (changed)

Items gain `"predictedStockOutOn": "2026-11-18"` (the P2 formula, null with fewer than 2 orders) and
`"bonus": { "multiplier": "1.50", "endsAt": "2026-11-12T09:40:00+07:00" }` or null.

### Reviews (changed + new)

`POST /v1/store/orders/{orderId}/review` — `store.reviews.submit`:
```json
{ "rating": 5, "comment": "กล่องสวย ส่งตรงเวลา", "photoFileIds": ["0192f3a0-7c1e-7d2a-9b1f-0000000f0301"] }
```
- **Photo files:** uploaded first through the existing presign/complete, purpose `image`, owned by the caller. Their
  metadata is stripped (D-442); a file whose strip failed is refused (422, path `photoFileIds[i]`, code
  `file_not_ready`). At most 4 photos.
- **Rewards:**
  - `earn_review` = `reviewBaht` (25.00 → 10 points);
  - `earn_review_photo` = `reviewPhotoBaht` (25.00 → 10 points), once per review, when the first photo is attached.
  - Both are under the D-476 cap and refused whole when over it; `rewardPoints` then shows what was written.

`POST /v1/store/orders/{orderId}/review/photos` — **`store.reviews.addPhotos`** (new): `{ "photoFileIds": [...] }`
within 30 days of the review, up to 4 in total. 201 → `ReviewDto`. Errors: `http.not_found`, `reviews.photo_limit`
(422), `reviews.photo_window_closed` (422).

`ReviewDto` additions:
```json
{ "photos": [ { "id": "0192f3a0-7c1e-7d2a-9b1f-0000000f0301", "url": "/v1/store/catalog/images/0192f3a0-7c1e-7d2a-9b1f-0000000f0301" } ],
  "rewardPoints": 20, "photoRewardPoints": 10 }
```

### Data refresh

`GET /v1/store/loyalty/data-refresh` — **`store.loyalty.getDataRefresh`**:
```json
{ "due": true, "lastConfirmedAt": null, "nextDueAt": null, "rewardPoints": 12,
  "company": { "id": "0192f3a0-7c1e-7d2a-9b1f-0000000c0001", "legalName": "บริษัท ตัวอย่าง จำกัด" },
  "taxProfiles": [ { "id": "0192f3a0-7c1e-7d2a-9b1f-0000000c0101", "label": "สำนักงานใหญ่" } ],
  "addresses": [ { "id": "0192f3a0-7c1e-7d2a-9b1f-0000000c0201", "label": "คลังสินค้า บางนา", "isDefault": true } ] }
```
`rewardPoints` is 0 when the reward is not available now (already paid within 12 months, or the cap is reached).

`POST /v1/store/loyalty/data-refresh/actions/confirm` — **`store.loyalty.confirmDataRefresh`**:
- **Body:** `{ "confirmed": true }`.
- **Effect:** stamps `customer_profiles.data_confirmed_at`, emits `customer.data_refreshed`, and earns
  `earn_data_refresh` (`dataRefreshBaht` 30.00 → 12 points) when the last one is more than `monthsBetween` (12)
  months old.
- **Response:** 200 → the GET shape (`due: false`, `nextDueAt`).
- **Errors:** `validation.failed`. Confirming again early is accepted and stamps the date, but earns nothing.

### Showcase consent

`GET /v1/store/loyalty/showcase-consent` — **`store.loyalty.getShowcaseConsent`**:
```json
{ "status": "requested", "scope": ["brand_name", "packaging_photos"], "consentTextVersion": "2026-11-v1",
  "requestedAt": "2026-11-04T15:00:00+07:00", "decidedAt": null, "rewardPoints": 40 }
```
`status` is `none` when nothing was requested.

`PUT /v1/store/loyalty/showcase-consent` — **`store.loyalty.updateShowcaseConsent`**:
- **Grant:** `{ "granted": true, "scope": [...], "consentTextVersion": "2026-11-v1" }` → creates an approval request
  under policy `showcase_consent_review` (Marketing; subject `showcase_consent`).
- **Withdraw:** `{ "granted": false }` → status `withdrawn`. Withdrawing never reverses the reward.
- **Rewards:** `earn_showcase_consent` (100.00 → 40 points) is written when Marketing approves, once per account
  (one-off index), under the cap.
- **Errors:**
  - `showcase.consent_pending` (409): granting while a request is open;
  - `showcase.text_outdated` (422): an old consent text version;
  - `validation.failed`.

### Surveys (`store` surface, tag `surveys`; customer)

| Method + path | Operation id | Notes |
|---|---|---|
| `GET /v1/store/surveys/next` | `store.surveys.next` | The one `open` instance to show now (oldest first), or `{ "survey": null }`. Read-only. |
| `GET /v1/store/surveys/{surveyId}` | `store.surveys.get` | Any of my instances that are not expired (deep link). |
| `POST /v1/store/surveys/{surveyId}/actions/seen` | `store.surveys.markSeen` | `open` → `seen`; after this, `next` no longer returns it ("shown once"). Idempotent. |
| `POST /v1/store/surveys/{surveyId}/actions/dismiss` | `store.surveys.dismiss` | → `dismissed` (final). |
| `POST /v1/store/surveys/{surveyId}/responses` | `store.surveys.submit` | Answers → `completed`; earns `earn_survey` once per instance. |

Instance shape:
```json
{ "survey": {
  "id": "0192f3a0-7c1e-7d2a-9b1f-0000000d0001",
  "trigger": "post_delivery",
  "orderCode": "OR-2610-0042",
  "status": "open",
  "expiresAt": "2026-12-04T08:00:00+07:00",
  "rewardPoints": 8,
  "title": "คำสั่งซื้อล่าสุดเป็นอย่างไรบ้าง",
  "questions": [
    { "key": "overall", "kind": "rating", "label": "ความพึงพอใจโดยรวม", "min": 1, "max": 5, "required": true },
    { "key": "quality", "kind": "single", "label": "คุณภาพงานพิมพ์ตรงกับที่คาดไหม", "options": [ { "key": "better", "label": "ดีกว่าที่คาด" }, { "key": "as_expected", "label": "ตรงตามที่คาด" }, { "key": "worse", "label": "ต่ำกว่าที่คาด" } ], "required": true },
    { "key": "improve", "kind": "multi", "label": "อยากให้เราปรับปรุงเรื่องใด", "options": [ { "key": "lead_time", "label": "ระยะเวลาผลิต" }, { "key": "price", "label": "ราคา" }, { "key": "design", "label": "การออกแบบ" } ], "required": false },
    { "key": "comment", "kind": "text", "label": "อยากบอกอะไรเพิ่มเติม", "maxLength": 500, "required": false }
  ]
} }
```
- `rewardPoints` is 0 when the template has no reward or the cap is reached.
- `orderCode` is present only for `post_delivery`.
- Texts come in the request locale.

Submit body: `{ "answers": { "overall": 5, "quality": "as_expected", "improve": ["lead_time"], "comment": "" } }`.
201 → `{ "status": "completed", "rewardPoints": 8 }`. Errors:
- `surveys.not_open` (409): completed, dismissed or expired;
- `validation.failed` (unknown key, missing required answer, out of range);
- `http.not_found`.

### Loyalty summary and ledger (changed)

`store.loyalty.get` adds:
```json
{ "bonusLots": [ { "points": 40, "reason": "winback", "expiresAt": "2026-12-04T23:59:59+07:00" } ], "activeCampaigns": 1 }
```

`earn_order` ledger items add:
```json
{ "multipliers": { "tier": "1.25", "paymentMethod": "1.20", "reorderCampaign": "1.50", "promotion": "1.00", "combined": "2.25", "capped": false } }
```

### Checkout preview (`preview.points`, changed)

```json
{ "balance": 120, "pointValue": "2.50", "minimumPoints": 4, "maximumPoints": 120, "redeemedPoints": 0,
  "toEarn": 22,
  "multipliers": { "tier": "1.25", "paymentMethod": "1.00", "reorderCampaign": "1.50", "promotion": "1.00", "combined": "1.88", "capped": false },
  "paymentBonus": { "multiplier": "1.20", "methods": ["scb_qr", "scb_qr_cross_bank", "bank_transfer_slip"] },
  "toEarnWithPaymentBonus": 27 }
```
- `toEarn` uses the declared payment method (none declared → no payment bonus).
- `paymentBonus` is null when the setting's multiplier is 1.
- The web never computes points.

## Admin

### GET /v1/admin/loyalty/analytics — `admin.loyaltyAnalytics.get` (permission `loyalty.read`)

Query: `from=YYYY-MM`, `to=YYYY-MM` (≤ 24 months). Cached 5 minutes.

```json
{
  "from": "2026-01", "to": "2026-10", "asOf": "2026-11-04T10:00:00+07:00",
  "liability": {
    "outstandingPoints": 182400, "faceValue": "456000.00",
    "expectedRedemptionRatePct": "60", "rateConfirmation": "pending_cpa", "rateSettingVersionId": "418",
    "estimatedLiability": "273600.00", "ledgerBalance2330": "270150.00", "difference": "3450.00"
  },
  "movement": [ {
    "month": "2026-10", "openingPoints": 176000,
    "earned": { "order": 9800, "activity": 2100, "referral": 400, "bonus": 640 },
    "redeemed": 5200, "returned": 80, "reversed": 300, "expired": 1120, "adjusted": 0, "closingPoints": 182400
  } ],
  "breakage": {
    "windowMonths": 12, "issuedPoints": 210000, "expiredPoints": 80220,
    "actualPct": "38.20", "assumedPct": "40.00", "monthsOfData": 7, "reliable": false
  },
  "earnVsRedeem": {
    "bySource": [ { "source": "order", "earned": 98000 }, { "source": "activity", "earned": 21000 }, { "source": "referral", "earned": 4000 }, { "source": "bonus", "earned": 6400 } ],
    "byTier": [ { "tier": "gold", "members": 12, "earned": 31000, "redeemed": 14000, "redemptionPct": "45.16" } ]
  },
  "retention": {
    "repeatOrderRate": { "windowDays": 180, "redeemersPct": "42.10", "nonRedeemersPct": "18.30", "redeemers": 95, "nonRedeemers": 610 },
    "programmes": [
      { "programme": "reorder_reminder", "sent": 140, "converted": 37, "ratePct": "26.43", "windowDays": 7 },
      { "programme": "winback", "sent": 88, "converted": 9, "ratePct": "10.23", "windowDays": 30 },
      { "programme": "quote_recovery", "sent": 64, "converted": 11, "ratePct": "17.19", "windowDays": 14 },
      { "programme": "survey", "sent": 210, "converted": 96, "ratePct": "45.71", "windowDays": 30 }
    ]
  },
  "currency": "THB"
}
```

- **Liability:**
  - `estimatedLiability` = outstanding points × point value of each lot × the D-480 rate in force at `asOf`.
  - `faceValue` is the same at 100 %.
  - `difference` = estimate − the GL balance of 2330, sign as a liability (credit positive).
- **Earned sources:**
  - `order` = `earn_order`;
  - `activity` = sign-up, identity/LINE link, review, review photo, every P1 onboarding type, survey, data refresh,
    showcase, first sample;
  - `referral` = `earn_referral`;
  - `bonus` = `earn_bonus`.
  - Earnings count at `coalesce(available_at, created_at)` (D-488).
- **Breakage:**
  - `breakage.actualPct` = expired ÷ issued over the trailing 12 months ending `to`.
  - `assumedPct` = 100 − `expected_redemption_rate_pct`.
  - `reliable` becomes true once `monthsOfData` ≥ `loyalty.analytics.breakageMinMonths` (12).
- **Retention:**
  - Conversion: reorder = a D-153 reorder of the SKU placed in the window; win-back = any order placed within 30 days;
    quote recovery = the quotation ordered within 14 days of the last message; survey = completed / opened.
  - Aggregates with fewer than 10 customers return `null` rates (k-anonymity, as `admin.analytics.*`).
- **Errors:** `validation.failed`.

### GET /v1/admin/loyalty/campaigns — `admin.loyaltyCampaigns.list` (permission `loyalty.read`)

Query: `status`, `kind`, `customerId`, `page`, `perPage`. Items:
```json
{ "id": "0192f3a0-7c1e-7d2a-9b1f-0000000c2001", "kind": "reorder_bonus", "status": "active", "multiplier": "1.50",
  "customer": { "id": "…", "displayName": "คุณสมชาย" }, "productTypeCode": "corrugated_rsc",
  "startsAt": "…", "endsAt": "…", "convertedOrderCode": null, "reason": "reorder_reminder" }
```
Read-only in P2. Admin campaign editing is P3.

### Promotions (changed)

- `admin.promotions.create|update`:
  - accept `conditions` v2, `display.listing` and `display.bundle` (rules above);
  - `PromotionDto` adds `conditionsSchemaVersion`, and `display.listing`, `display.bundle` echoed.
- **`GET /v1/admin/promotions/{promotionId}/audience-estimate`** — **`admin.promotions.estimateAudience`** (new,
  `promotions.read`):
  - query = the editor's unsaved `audience` (JSON in `?audience=`) or the saved one;
  - → `{ "customers": 120, "rounded": true }`; below 10 → `{ "customers": null, "rounded": true }`.
- `admin.promotions.report` `refAgents[]`:
  ```json
  { "agentCode": "AGT0042", "visitors": 12, "visits": 30, "signups": 3, "customers": 2, "orderGroups": 2, "grossAmount": "38400.00", "discountAmount": "1920.00", "redemptions": 2 }
  ```
  - `signups`: visitors whose account was created after their first visit.
  - `customers` / `orderGroups` / `grossAmount`: paid order groups placed after the first visit, within
    `agents.rules.linkCookieDays`.
  - `redemptions`: of this promotion.
- **`GET /v1/admin/promotions/agent-performance`** — **`admin.promotions.agentPerformance`** (new,
  `promotions.read`):
  - query `from`, `to`, `agentCode?`, `promotionId?`, `page`, `perPage`;
  - items = the row above plus `promotionId`, `promotionName`, `agentName`;
  - CSV through `admin.exports.create` (resource `promotion_agent_performance`).

### Surveys admin (`admin` surface, tag `surveys`; permission `promotions.manage` to write, `promotions.read` to read — the Marketing role's existing grants)

| Method + path | Operation id |
|---|---|
| `GET /v1/admin/surveys/templates` | `admin.surveys.listTemplates` |
| `POST /v1/admin/surveys/templates` | `admin.surveys.createTemplate` |
| `GET /v1/admin/surveys/templates/{templateId}` | `admin.surveys.getTemplate` |
| `PATCH /v1/admin/surveys/templates/{templateId}` | `admin.surveys.updateTemplate` (draft only; `If-Match`) |
| `POST /v1/admin/surveys/templates/{templateId}/actions/{action}` (`publish \| retire \| new-version`) | `admin.surveys.templateAction` |
| `GET /v1/admin/surveys/templates/{templateId}/results` | `admin.surveys.results` |

Template body:
```json
{ "code": "post_delivery_v1", "trigger": "post_delivery", "rewardEnabled": true,
  "title": { "th": "คำสั่งซื้อล่าสุดเป็นอย่างไรบ้าง", "en": "How was your latest order?" },
  "questions": [ { "key": "overall", "kind": "rating", "label": { "th": "ความพึงพอใจโดยรวม", "en": "Overall satisfaction" }, "min": 1, "max": 5, "required": true } ] }
```
- **Validation:**
  - 3–5 questions; `kind` ∈ `rating | single | multi | text`; keys unique; `single`/`multi` need 2–6 options;
    `text` ≤ 500 chars.
  - Errors: 422 `validation.failed`, plus `surveys.template_published` (409) on editing a published one,
    `surveys.trigger_taken` (409) on publishing while another template of the trigger is published.
  - Retire does not close open instances.
- **Results:**
  - per question: counts per option, the average for ratings, completion rate;
  - free text is listed with the customer masked (`คุณส•••`) and the order code;
  - fewer than 10 responses → counts only.

### Approvals (`showcase_consent_review`)

New approval policy (subject `showcase_consent`, one Marketing step). The existing `admin.approvals.*` serve it. The
subject payload holds the customer, the scope, the consent text version and recent orders (codes only). Approve →
`earn_showcase_consent` + `showcase_consent.decided` (`approved`); reject → `showcase_consent.decided` (`rejected`),
no reward.

`GET /v1/admin/showcase-consents` — **`admin.showcaseConsents.list`** (`promotions.read`): approved or withdrawn
consents with their scope, for Marketing before it uses any material. A withdrawn consent is flagged
"ห้ามใช้".

### Executive P&L — `admin.financialReports.profitAndLoss` (changed)

Adds, for the month `to`:
```json
{ "pointsLiability": {
  "asOf": "2026-10-31", "outstandingPoints": 182400, "faceValue": "456000.00",
  "expectedRedemptionRatePct": "60", "rateConfirmation": "pending_cpa",
  "estimatedLiability": "273600.00", "ledgerBalance2330": "270150.00",
  "pointsExpenseInPeriod": "4860.00", "source": "loyalty.expected_redemption_rate_pct"
} }
```
- It is a memo block: it never changes `lines` or `totals`.
- `pointsExpenseInPeriod` = account 6120 in the period.
- The rate is the version in force at `asOf`.

## Settings keys (new or new version; effective-dated, audited)

`loyalty.activity_rewards` (+ `reviewBaht 25.00`, `reviewPhotoBaht`, `firstSampleBaht`, `surveyBaht`,
`showcaseConsentBaht`, `dataRefreshBaht`) · `loyalty.data_refresh` · `loyalty.order_multipliers` ·
`loyalty.lifecycle_bonuses` · `loyalty.reorder_reminder` · `surveys.rules` · `loyalty.analytics`. Values and owners:
`plans/P2-PLAN.md` §2. They are read through `admin.settings.get` / `changeValue` like every setting; `LoyaltySettings.tsx`
edits them.

## Earn rules (handlers; D-476 cap applies to every row marked "cap")

| Entry | Trigger | Value | Once | Cap |
|---|---|---|---|---|
| `earn_review` | `store.reviews.submit` | `reviewBaht` 25.00 | per review | cap |
| `earn_review_photo` | first photo on a review | `reviewPhotoBaht` 25.00 | per review | cap |
| `earn_first_sample` | `sample.delivered` (first paid sample of the account) | `firstSampleBaht` 50.00 | per account | cap |
| `earn_survey` | `survey.completed` | `surveyBaht` 20.00 | per instance | cap |
| `earn_showcase_consent` | approval `showcase_consent_review` approved | `showcaseConsentBaht` 100.00 | per account | cap |
| `earn_data_refresh` | `customer.data_refreshed` | `dataRefreshBaht` 30.00 | per 12 months | cap |
| `earn_bonus` `first_order` | `order.fact_recorded` `completed`, the account's first completed standard order | `firstOrderBaht` 300.00 (120 points) | per account | cap |
| `earn_bonus` `winback` | `loyalty.winback` worker | `winback.bonusBaht` 100.00 (40 points), lot expires +30 days | per 180 days | cap |
| `earn_bonus` `promotion` | an applied promotion `bonus_points` perk, at the order's earning | the perk's points | per order × promotion | **not** capped (order-linked, promotion budget) |
| `earn_order` multipliers | `earnForOrder` | tier × payment (1.20 for listed methods when every non-store-credit payment of the group used one) × reorder campaign (1.50 when the order is a D-153 reorder of the campaign's SKU placed in its window) × promotion `points_multiplier` (best one) | — | **not** capped; combined ≤ `maxCombined` 3.00 |

- **First-order bonus:** created `pending` with the `available_at` of that order's `earn_order`, and credited by the
  hourly job. A refund or cancellation of the order before then reverses it; after credit it stays.
- **Held rewards:** the D-477 hold applies to the P2 activity types as in P1.

## Realtime (user channel, `{ type, id }` only)

| Type | `id` | Web refetches |
|---|---|---|
| `loyalty.points_awarded` (existing) | points entry public id | `store.loyalty.tasks`, `store.loyalty.get` (also sent for every P2 reward and bonus) |
| `survey.available` | survey instance public id | `store.surveys.next` |
| `loyalty.campaign_started` | campaign public id | `store.loyalty.campaigns`, `store.reorderSuggestions.list` |

## Domain events (new)

- **Data and surveys:** `customer.data_refreshed`, `survey.instance_opened`, `survey.completed`, `survey.dismissed`.
- **Showcase:** `showcase_consent.requested`, `showcase_consent.submitted` (staff notification),
  `showcase_consent.decided`, `showcase_consent.withdrawn`.
- **Reviews:** `review.photos_added`.
- **Campaigns and reminders:** `loyalty.campaign_started`, `loyalty.campaign_ended`, `reorder.reminder` (notification
  event, aggregate `reorder_reminder`).
- **Bonuses:** `loyalty.winback_bonus` (notification event; the points use the existing `points.issued`),
  `loyalty.data_refresh_due`, `survey.available`.

## Notification rows

`reorder.reminder`, `loyalty.winback_bonus`, `survey.available`, `loyalty.data_refresh_due` (customer, marketing,
e-mail + LINE); `showcase_consent.submitted` (staff, Marketing team); `showcase_consent.decided` (customer,
e-mail, transactional). Copy: `plans/P2-PLAN.md` §5.

## Error codes (new)

| Code | HTTP |
|---|---|
| `promotions.not_bundle` | 422 |
| `promotions.bundle_unavailable` | 422 |
| `reviews.photo_limit` | 422 |
| `reviews.photo_window_closed` | 422 |
| `surveys.not_open` | 409 |
| `surveys.template_published` | 409 |
| `surveys.trigger_taken` | 409 |
| `showcase.consent_pending` | 409 |
| `showcase.text_outdated` | 422 |

New publish-guard rule codes inside `promotions.not_publishable`: `bundle_unpriceable`, `bundle_items`,
`audience_words`. New `validation.failed` codes: `exclusive`, `bundle_pair`, `listing_requires_audience`,
`file_not_ready`.

## Seed (UAT only, idempotent)

- 1 published post-delivery template and 1 published quarterly template (4 questions each).
- 1 bundle deal (corrugated box + label), `hidden`, labelled "UAT".
- 1 `matching_only` deal for Silver/Gold members, `hidden`.
- 1 customer with an active reorder campaign.
- 1 customer with a win-back lot.
- 1 pending showcase consent.
