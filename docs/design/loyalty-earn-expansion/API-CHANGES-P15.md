# API changes — P1.5 Deals surface (contract both sides build against)

Source: PLAN §3.5, §7 Phase 1.5, §8 Phase 1.5; D-481 (DEC-9), D-484, D-486. Money as decimal strings; dates +07:00;
no factory data anywhere (GLOBAL-RULES §1). The API agent may adjust paths or ids where the codebase demands it
(e.g. operation-id rules), but must then update this file and say why at the top.

## Schema

- `promotions.visibility` enum `public | unlisted | hidden`, **default `hidden`** (existing rows unaffected).
- `promotions.display jsonb` + `display_schema_version int`, holding `{ headline:{th,en}, subline:{th,en}, badge:{th,en}|null, terms:{th,en}, heroImageKey|null, featured:boolean, slug }`.
  The slug is unique among non-hidden promotions.
- `conditions` stays v1 in P1.5 (v2 audience/bundle is P2).
- Shown = `visibility = public` ∧ `status = active` ∧ now ∈ [startsAt, endsAt).
- Agent attribution: `promotion_ref_attributions` (or the existing attribution store if one exists) holding
  agentCode, session/customer and first-seen time.
- Quote recovery state: per quotation, how many reminders were sent and when, and whether it stopped (and why).

## Store (public unless noted)

### GET /v1/store/promotions — `store.promotions.listPublic`

Query: `?productTypeCode=` (PDP badge), `?tab=all|for_you|ending_soon|points` (`for_you` = all in P1.5, real in P2;
`points` returns `[]` until P3), `?ref=` (agent code → sets attribution and is echoed in `shareUrl`).
Cached 60 s for anonymous requests. A signed-in caller gets a per-customer `myStatus`.

```json
{ "items": [ {
  "id": "uuid", "slug": "box10-corrugated", "featured": true,
  "headline": "กล่องลูกฟูก 1,000 ใบขึ้นไป ลด 10%", "subline": "เฉพาะกล่องลูกฟูกฝาชน",
  "badge": "ดีลเด่น",
  "benefit": { "kind": "percent|amount|free_shipping|points_multiplier", "value": "10", "maxDiscount": "1500.00", "summary": "ลด 10% สูงสุด ฿1,500" },
  "conditions": [ { "label": "ขั้นต่ำ", "value": "1,000 ใบ" }, { "label": "ใช้ร่วมกับ", "value": "คูปองส่งฟรี" } ],
  "productTypeCodes": ["RSC"],
  "code": "BOX10",
  "startsAt": "…", "endsAt": "2026-11-30T23:59:59+07:00", "endingSoon": false,
  "terms": "…", "heroImageUrl": null,
  "myStatus": "claimable|saved|used|not_eligible|null", "notEligibleReason": "first_order_only|null",
  "shareUrl": "https://getpack.co/deals/box10-corrugated"
} ], "counts": { "all": 12, "for_you": 12, "ending_soon": 2, "points": 0 } }
```

- `code` appears only for single-code (`CouponKind.single`) promotions. Automatic promotions return `code: null`.
- `endingSoon` = less than 72 h left. It is a static label, never a countdown (D-481).
- Text comes from `display` in the request locale (`Accept-Language` th|en, fallback th).

### GET /v1/store/promotions/{slug} — `store.promotions.getPublic`

The same item shape plus `faq: [{q,a}]`, built from `display.terms` and global FAQ strings. Returns 404 when the
promotion is not shown.

### POST /v1/store/promotions/{id}/actions/save — `store.promotions.save` (customer)

Writes `customer_saved_coupons`. Returns 201 `{ myStatus: "saved" }`, or 409 `promotion.already_saved` /
`promotion.not_saveable`.

### GET /v1/store/cart/applicable-codes — `store.cart.applicableCodes` (customer)

Codes I hold (saved, plus personally issued) that pass the same `checkCode` as manual entry against the current cart:

```json
{ "applicable": [ { "code": "BOX10", "promotionId": "uuid", "headline": "…", "benefitSummary": "ลด 10% กล่องลูกฟูก", "saving": "1331.00", "stackGroup": "product", "conflictsWith": ["LABEL8"], "best": true } ],
  "notYet": [ { "code": "MATTEFREE", "headline": "…", "reason": "min_quantity", "reasonText": "สั่งกล่องเพิ่มอีก 1,000 ใบ" } ],
  "maxCodes": 3 }
```

The `saving` value must equal what `checkCode` / apply computes (gate 9). `best` marks the highest saving.

### GET /v1/store/quotations/{id}/ladder — `store.quotations.ladder` (customer, own quotation)

Also `GET /v1/store/pricing/ladder?…spec` if the configurator has no quotation yet (agent decides; reuse the
existing tier/`tierHint` data, **no new pricing**):

```json
{ "unit": "ใบ", "current": 500, "rows": [ { "quantity": 300, "unitPrice": "16.20" }, { "quantity": 500, "unitPrice": "14.79", "current": true }, { "quantity": 1000, "unitPrice": "13.31", "savingPct": "10" } ], "promoHint": { "promotionId": "uuid", "text": "ลดเพิ่ม 10% เมื่อสั่ง ≥ 1,000 ใบ", "estimatedTotal": "11979.00" } }
```

Prices are VAT-inclusive (D-220). Ladder values equal the quotation options (gate).

## Admin (Marketing)

- `PATCH /v1/admin/promotions/{id}` accepts `visibility` and `display`. A change to `public` is refused unless the
  promotion is active, has a slug and Thai headline/terms, and contains no blocked words (โรงงาน/factory/กำไร/
  margin/ทันที countdown wording). Every visibility change is written to the audit log.
- `POST /v1/admin/promotions/{id}/hero-image`: through the existing assets/S3 path.
- Promotion report rows gain `views`, `saves`, `uses` and `refAgent` where available.

## Quote recovery (worker `promotions.quote_recovery`, daily)

- Setting `promotions.quote_recovery` `{ day1: 3, day2: 6, coupon: "free_shipping", couponValidityDays: 7, enabled }`.
  The default is **enabled on UAT only** (seed by env), disabled elsewhere.
- Locked quotation (D-051) not ordered:
  - day 3: notification `quotation.recovery_1` ("ราคานี้ล็อกให้ถึงวันที่ X");
  - day 6: `quotation.recovery_2` plus a single-use per-customer free-shipping coupon (D-484), 7-day validity.
- Max 2 messages per quotation. It stops on order, expiry or opt-out.
- Two new notification-matrix rows. Real LINE push stays behind the existing env flags.

## Seed

UAT promotions (6–8, matching the Stitch copy), **all `hidden`**, labelled "UAT".

## Realtime / events

`promotion.saved`, `promotion.visibility_changed`, `quotation.recovery_sent`.
