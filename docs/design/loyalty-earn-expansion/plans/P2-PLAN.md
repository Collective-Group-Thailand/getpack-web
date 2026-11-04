# P2 — Engagement, lifecycle, segments, analytics · plan

Branch `feat/loyalty-p2-lifecycle` (both repos, from `main` with P1 + P1.5). Source: PLAN §2.2, §2.3 (Phase 2 rows),
§3.5.5, §6, §7 Phase 2, §9.3; `LOYALTY-AUTORUN.md` block A "Phase-specific musts" P2; contract `API-CHANGES-P2.md`.
Decisions: D-473…D-487 (unchanged) and **D-488…D-495** (this phase, owner delegated 2026-11-04).

## 0. Decisions applied (owner delegated; rows in `docs/decisions.md`)

| D | Decision |
|---|---|
| D-488 | Activity rewards (no `available_at`) count in the points liability and the analytics: an earning counts from `coalesce(available_at, created_at)` once it is not `pending`. `LoyaltyService.reward` sets `available_at = now` from P2 on. The report query is fixed; the ledger is not backfilled (append-only). |
| D-489 | Customer-facing copy says **"แต้ม"** everywhere. P2 renames the remaining "คะแนน" strings in the points and loyalty UI (web i18n `th`), the API's customer-facing texts (deal benefit summary, `points.expiring` template for new databases) and the admin loyalty screens. Ratings ("คะแนนเฉลี่ย 4.8 จาก 5") stay "คะแนน", because a rating is not points. |
| D-490 | §2.2 earn values: review ฿10 → **฿25**, review photo **+฿25**, first sample **฿50**, survey **฿20** per survey instance, showcase consent **฿100** (Marketing approves), data refresh **฿30** at most once per 12 months. Paying by QR or bank transfer gives **×1.2** on `earn_order`. |
| D-491 | In-app surveys (D-482): templates hold 3–5 questions; each template has one trigger (`post_delivery` or `quarterly`); an instance opens once per trigger key and is shown once; `earn_survey` is paid once per instance. |
| D-492 | Reorder reminder: predicted stock-out = last order date + max(30, ⌊last qty ÷ average daily usage⌋), where daily usage per earlier interval = that order's qty ÷ days to the next order. One reorder marketing message per SKU cycle (`reorder.reminder` or D-288 `reorder.suggestion_due`, never both). A `loyalty_campaigns` row gives ×1.5 on `earn_order` for D-153 reorders of that SKU placed within 7 days. |
| D-493 | First order bonus **+฿300 = 120 points** (`earn_bonus`, reason `first_order`), credited with the first order's earning. Win-back: no order for > 90 days → **+฿100 = 40 points** (`earn_bonus`, reason `winback`), lot expires in 30 days, at most once per 180 days, only for customers who can receive the message. |
| D-494 | Conditions **v2**: `audience` {`newCustomer`, `tiers`, `businessTypes`, `inactiveDaysGte`, `orderedProductTypeCodes`} and `cartProductTypeCountGte`; bundle = `cartProductTypeCountGte ≥ 2` **and** `stackGroup = 'bundle'`, with `display.bundle` presets behind the "เพิ่มชุดนี้ลงตะกร้า" CTA. "สำหรับคุณ" lists the deals the caller matches. Promotion `points_multiplier` / `bonus_points` perks are honoured at earning. |
| D-495 | Order multipliers (tier × payment × reorder campaign × promotion perk) multiply and are capped at ×3.00 combined. They are **not** under the D-476 cap. Survey, data refresh, showcase, first-sample, review-photo, first-order and win-back rewards **are** under it, refused whole and audited. The analytics page and the executive P&L memo line use `loyalty.expected_redemption_rate_pct` (D-480). Per-agent promotion performance comes from `promotion_ref_attributions`. Every new rate or threshold is an effective-dated, audited setting. |

## 1. Scope

| # | Item | Repo |
|---|---|---|
| 1 | **Schema + migrations** (§3). New entry types, `loyalty_campaigns`, `reorder_reminders`, surveys (3 tables), `order_review_photos`, `showcase_consents`, `customer_profiles.data_confirmed_at`; partial unique indexes; conditions schema version 2 allowed. | api |
| 2 | **Settings** (§2), seed + `amendInForce` (review ฿10 → ฿25 only while the value in force is still the seed's), `SETTINGS-REVIEW.md`, `setting-keys.ts`, `shape.ts`. | api |
| 3 | **Liability fix (D-488)**: `POINTS_LIABILITY_REPORT` counts earnings at `coalesce(available_at, created_at)`. `reward()` writes `available_at`. Unit test with an activity reward. | api |
| 4 | **Engagement earn (§2.2)**: review 25 + photo reward (`store.reviews.submit` takes `photoFileIds`, `store.reviews.addPhotos`); `earn_first_sample` on `sample.delivered` (first one); data refresh (`store.loyalty.getDataRefresh` / `confirmDataRefresh`, event `customer.data_refreshed`); showcase consent (`store.loyalty.getShowcaseConsent` / `updateShowcaseConsent`, approval policy `showcase_consent_review`); rules map entries + D-476 cap; tasks list gains `data_refresh`, `showcase_consent`, `first_sample`. | api |
| 5 | **Surveys module** (`src/modules/surveys`): templates (admin CRUD, publish/retire, versioned), instances (post-delivery handler + quarterly worker), `store.surveys.*`, `earn_survey`, results aggregate. | api |
| 6 | **Order multipliers (D-495)**: `earnForOrder` multiplies tier × payment method (setting) × active reorder campaign × promotion perk, capped; `points_preview` shows the breakdown and the QR/transfer bonus; `meta.multipliers` on `earn_order`. | api |
| 7 | **Lifecycle**: first-order bonus handler; win-back worker; reorder reminder worker (`reorder_reminders`, `loyalty_campaigns`, `reorder.reminder`); D-288 `reorder.reminders` skips SKU cycles P2 already reminded; `store.loyalty.campaigns`, `admin.loyaltyCampaigns.list`; `store.reorderSuggestions.list` gains `predictedStockOutOn` + `bonus`. | api |
| 8 | **Conditions v2 + audience + bundle**: `CONDITIONS_SCHEMA_V2`, engine `failedCondition` → `audience` / `product_type_count`, audience facts loaded once per checkout; `for_you` real in `store.promotions.listPublic`; `display.listing` (`everyone` / `matching_only`); `display.bundle` + publish guard (presets must price); `store.promotions.addBundle`; applicable-codes `notYet` reasons. | api |
| 9 | **Agent performance**: `admin.promotions.report` `refAgents[]` gains sign-ups, customers, orders, gross, discount and redemptions; new `admin.promotions.agentPerformance` (per agent × deal). | api |
| 10 | **Analytics + executive P&L**: `admin.loyaltyAnalytics.get` (PLAN §6); `admin.financialReports.profitAndLoss` gains the `pointsLiability` memo block. | api |
| 11 | **Notifications** (§5): 6 matrix rows; customer-facing "แต้ม" in API texts (D-489). | api |
| 12 | **Contract**: OpenAPI regenerated, `API-CHANGES-P2.md` (both repos), confidentiality spec extended to every new store/LIFF response. | api |
| 13 | **Prototypes** (block A 3c): analytics page, segment picker + bundle editor, survey sheet, reorder/win-back surfaces, "สำหรับคุณ" tab, bundle CTA sheet, review photo step, data refresh page, showcase consent form. | web |
| 14 | **Web admin**: `/admin/marketing/loyalty/analytics`; promotion editor Audience tab (segment picker), Bundle tab, listing option; report per-agent table; `/admin/marketing/surveys` (list, editor, results); approvals inbox renders `showcase_consent`; `LoyaltySettings.tsx` fields for every new setting; P&L memo line. | web |
| 15 | **Web customer**: survey card + sheet (`/account`, order detail, `/liff`), `/account/surveys/[surveyId]`; reorder bonus on `/account/replenishment`, order detail and cart; win-back banner on `/account`, `/account/points`, `/liff/points`; "สำหรับคุณ" tab on `/deals` and `/liff/deals`; bundle CTA + sheet; review photos; `/account/confirm-data`; `/account/showcase`; checkout QR/transfer hint and earn breakdown. | web |
| 16 | **Wording (D-489)**: rename "คะแนน" → "แต้ม" in `th` points/loyalty/checkout/cart/LIFF/problems/admin-marketing strings (ratings excluded); add a `customer-wording` rule so "คะแนน" next to points keys fails the test. | web |
| 17 | **Tests** (§8). | both |
| 18 | **Docs**: D-488…D-495 (done with this plan), PROGRESS, REPORT P2 section, `accounting-design.md` §5 note (liability counting, new entry types post like `earn_signup`). | both |

## 2. Settings (all effective-dated, audited, with description and decisions)

| Key | Value (seed) | Owner | Decisions |
|---|---|---|---|
| `loyalty.activity_rewards` (new version) | + `reviewBaht 25.00` (was 10.00), `reviewPhotoBaht 25.00`, `firstSampleBaht 50.00`, `surveyBaht 20.00`, `showcaseConsentBaht 100.00`, `dataRefreshBaht 30.00` | Marketing | D-490, D-135, D-475 |
| `loyalty.data_refresh` | `{ monthsBetween: 12, reminderDaysBefore: 14 }` | Marketing | D-490 |
| `loyalty.order_multipliers` | `{ paymentMethod: { multiplier: "1.20", methods: ["scb_qr","scb_qr_cross_bank","bank_transfer_slip"] }, maxCombined: "3.00" }` | Marketing (Finance informed) | D-490, D-495 |
| `loyalty.lifecycle_bonuses` | `{ firstOrderBaht: "300.00", winback: { enabled: true, bonusBaht: "100.00", inactiveDays: 90, expiryDays: 30, minDaysBetween: 180 } }` | Marketing | D-493 |
| `loyalty.reorder_reminder` | `{ enabled: true, minOrders: 2, floorDays: 30, remindDaysBefore: 14, bonusMultiplier: "1.50", windowDays: 7 }` | Marketing | D-492 |
| `surveys.rules` | `{ enabled: true, postDeliveryDelayDays: 3, minDaysBetweenSurveys: 30, expiryDays: 30, quarterlyActiveWithinDays: 365 }` | Marketing | D-491 |
| `loyalty.analytics` | `{ breakageMinMonths: 12, repeatWindowDays: 180, conversionWindowDays: { reorderReminder: 7, winback: 30, quoteRecovery: 14 } }` | Finance | D-495, D-480 |

Unchanged and read: `loyalty.expected_redemption_rate_pct` (60, `pending_cpa`), `loyalty.activity_cap`, `loyalty.tiers`,
`loyalty.point_value`, `promotions.quote_recovery`. Seeded rewards are UAT-enabled; production values are the same
(no env split). Only `winback.enabled` and `reorder_reminder.enabled` send messages, and real LINE push stays behind the
existing env flags.

## 3. Migrations (hand-written guards, commented DOWN; names follow `20270101000004`)

1. **`20270101000005_loyalty_p2_entry_types`**. This migration only runs `ALTER TYPE points_entry_type ADD VALUE` for
   `earn_review_photo`, `earn_first_sample`, `earn_survey`, `earn_showcase_consent` and `earn_data_refresh`. It is kept
   apart because PostgreSQL refuses to use a new enum value in the same transaction ("unsafe use of new value",
   P1 open issue).
2. **`20270101000006_loyalty_p2_lifecycle`**:
   - **Ledger:**
     - `ck_points_ledger__sign` widened.
     - `ux_points_ledger__one_off_rewards` recreated to also cover `earn_first_sample` and `earn_showcase_consent`.
     - New partial unique indexes:
       - `ux_points_ledger__review_photo_reward` on `review_id` WHERE `earn_review_photo`;
       - `ux_points_ledger__survey_reward` on `((meta->>'surveyInstanceId'))` WHERE `earn_survey`;
       - `ux_points_ledger__first_order_bonus` on `user_id` WHERE `earn_bonus` AND `meta->>'reason' = 'first_order'`;
       - `ux_points_ledger__winback_bonus` on `(user_id, (meta->>'cycle'))` WHERE `earn_bonus` AND reason `winback`.
     - Index `ix_points_ledger__earn_available` on `(coalesce(available_at, created_at))` WHERE `entry_type::text LIKE 'earn%'`.
   - **`loyalty_campaigns`:**
     - Columns: id, public_id, `user_id` (nullable: global campaigns are P3), `kind` enum
       `reorder_bonus | winback | admin` (P2 writes only `reorder_bonus`), `multiplier numeric(4,2)` CHECK 1 < m ≤ 5,
       `applies_to` CHECK = `'earn_order'`, `sku_key text`, `reorder_reminder_id`, `starts_at`, `ends_at` CHECK > `starts_at`,
       `status` `active | ended | cancelled`, `reason`, `setting_version_id`, `created_at`, `created_by`.
     - Unique `(reorder_reminder_id)`.
   - **`reorder_reminders`:**
     - Columns: id, public_id, `sku_key`, `last_order_id` FK, `customer_user_id`, `company_id`, `product_type_id`,
       `order_count`, `avg_daily_usage numeric(12,4)`, `cover_days int` CHECK ≥ 1, `predicted_stock_out_on date`,
       `remind_on date`, `status` `scheduled | sent | skipped | converted | expired`, `skip_reason`, `sent_at`,
       `converted_order_id`, `setting_version_id`.
     - Unique `(sku_key, last_order_id)`: one per SKU cycle.
   - **Surveys:**
     - `survey_templates`: id, public_id, `code`, `version`, `trigger` enum `post_delivery | quarterly`,
       `status` `draft | published | retired`, `title jsonb {th,en}`, `questions jsonb` CHECK array length 3–5,
       `reward_enabled`. Unique `(code, version)`; partial unique: one `published` per `trigger`; published rows are
       immutable (trigger).
     - `survey_instances`: id, public_id, `template_id`, `user_id`, `trigger_key text` (order public id or `2026-Q4`),
       `status` `open | seen | completed | dismissed | expired`, `opened_at`, `seen_at`, `completed_at`, `expires_at`.
       Unique `(user_id, template_id, trigger_key)`.
     - `survey_responses`: PK `instance_id`, `answers jsonb`, `submitted_at`. Append-only trigger.
   - **`order_review_photos`:** `review_id`, `file_id`, `sort`. Unique `(review_id, file_id)`; at most 4 per review (trigger).
   - **`showcase_consents`:**
     - Columns: id, public_id, `user_id`, `company_id?`, `scope text[]` CHECK ⊆
       `{brand_name, logo, packaging_photos, review_quote}`, `status` `requested | approved | rejected | withdrawn`,
       `consent_text_version`, `approval_request_id`, `requested_at`, `decided_at`, `decided_by`, `withdrawn_at`.
     - Partial unique: one `requested|approved` per user.
   - **Other columns:**
     - `customer_profiles.data_confirmed_at timestamptz`.
     - `promotions`: CHECK `conditions_schema_version IN (1, 2)` and `display_schema_version IN (1, 2)`.

   Prisma schema to match. The expression and partial indexes are documented in model comments, as in P1/P1.5.

## 4. Workers (`@ScheduledJob`, Bangkok time, lease + retries as existing jobs)

| Job | Schedule | What |
|---|---|---|
| `loyalty.reorder_reminders` | `40 9 * * *` (after `reorder.suggestions` 02:30, before D-288 `reorder.reminders` 09:30 is moved to 09:50) | Predicts every SKU with ≥ `minOrders` orders, upserts the cycle's `reorder_reminders` row, sends due ones (`reorder.reminder`) and opens the ×1.5 `loyalty_campaigns` row (`starts_at = sent_at`, `ends_at` = +7 days). Rows that are not sendable become `skipped` (opted out, already reminded by D-288, SKU dismissed, new order placed). |
| `reorder.reminders` (existing) | moved to `50 9 * * *` | Skips a suggestion whose current cycle (same `last_order_id`) has a `sent` P2 reminder. |
| `loyalty.campaigns_end` | hourly | `active` → `ended` past `ends_at`; marks the reminder `converted` when a qualifying reorder was placed in the window. |
| `loyalty.winback` | `30 10 * * *` | Finds customers whose last placed (not cancelled) order is more than 90 days old, who have no win-back in the last 180 days and are under the cap, with marketing consent on e-mail or LINE (D-487 (4) rule). Grants the 40-point lot (expires in 30 days) and sends `loyalty.winback_bonus`. |
| `surveys.open_due` | `0 8 * * *` | Opens a post-delivery instance `postDeliveryDelayDays` after an order is delivered (at most one per customer per `minDaysBetweenSurveys`). On the first run of each quarter it opens quarterly instances for customers active within 365 days. Expires instances past `expires_at`. Signals `survey.available`. |
| `loyalty.data_refresh_remind` | `0 11 * * *` | Sends `loyalty.data_refresh_due` once per cycle when the last confirmation (or the account's creation) is older than `monthsBetween` − `reminderDaysBefore`. |

Existing `loyalty.remind_expiring` skips lots of `earn_bonus` reason `winback`, because their own message already
gives the expiry date.

## 5. Notification matrix rows (th/en templates; marketing rows get D-144 consent + quiet hours)

| Event | Audience | Channels | Category | Copy (th) |
|---|---|---|---|---|
| `reorder.reminder` | customer | email, line | marketing | "ใกล้ถึงเวลาสั่ง {{payload.productTypeNameTh}} อีกครั้ง" / "สั่งซ้ำภายใน {{payload.windowDays}} วัน รับแต้ม ×{{payload.multiplier}} (ถึง {{payload.endsOn}})" · link "สั่งซ้ำ" |
| `loyalty.winback_bonus` | customer | email, line | marketing | "เราเก็บ {{payload.points}} แต้มไว้ให้คุณ" / "ใช้เป็นส่วนลดได้ถึง {{payload.expiresOn}}" · link "ดูแต้มของฉัน" |
| `survey.available` | customer | email, line | marketing | "ขอเวลา 1 นาที บอกเราหน่อย" / "ตอบแบบสอบถามสั้น ๆ รับ {{payload.points}} แต้ม" · link "ตอบแบบสอบถาม" |
| `loyalty.data_refresh_due` | customer | email, line | marketing | "ข้อมูลบริษัทและที่อยู่ยังถูกต้องไหม" / "ตรวจและยืนยันข้อมูล รับ {{payload.points}} แต้ม" |
| `showcase_consent.submitted` | staff_team (marketing) | in-app, line group | — | "คำขอแสดงผลงานลูกค้ารอตรวจ" |
| `showcase_consent.decided` | customer | email | transactional | "ผลการพิจารณาการแสดงผลงานของคุณ" (approved / rejected variants by `payload.outcome`) |

`points.expiring` seed text becomes "แต้มสะสมใกล้หมดอายุ" for new databases. The seed never overwrites a template, so
REPORT lists the one-line admin edit for existing ones (D-489).

## 6. Screens (prototype first, getpack tokens, Anuphan, light theme without dark surfaces, 390 + 1440)

| Screen | Where | Notes |
|---|---|---|
| **Loyalty analytics** | `/admin/marketing/loyalty/analytics` (MarketingNav tab "วิเคราะห์") | Period picker (months). The KPI row shows the liability at the D-480 rate with a "รอ CPA ยืนยัน" chip, outstanding points, actual vs assumed breakage ("ข้อมูล 7 จาก 12 เดือน" until reliable), and the redemption rate. Then: monthly movement table + stacked bars (earned by source / redeemed / expired, dataviz rules); earn vs redeem by source and by tier; retention (repeat rate for redeemers vs non-redeemers); conversion of reorder reminder, win-back, quote recovery and survey; link to the promotions report. Ledger 2330 reconciliation line for Finance. CSV through the existing exports. |
| **Segment picker** | Promotion editor, new "กลุ่มลูกค้า" tab | Chips plus a builder: ลูกค้าใหม่ · ระดับสมาชิก (multi) · ประเภทธุรกิจ (packaging-profile categories) · ไม่ได้สั่ง ≥ n วัน · เคยสั่งประเภทสินค้า (multi). Shows a live "ตรงกับลูกค้าประมาณ N ราย" count (rounded, k ≥ 10) and the listing option "แสดงเฉพาะลูกค้าที่ตรงกลุ่ม". |
| **Bundle editor** | Promotion editor, new "ชุดสินค้า" tab | 2–4 items (product type + configuration preset chosen in the configurator + quantity). The publish guard reports items that do not price. `stackGroup` is locked to `bundle`. |
| **Surveys admin** | `/admin/marketing/surveys` | Template list (trigger, version, status, response rate), editor (3–5 questions: rating 1–5, single choice, multi choice, short text), publish/retire, results (counts, average, free text with customer masked). |
| **Survey sheet** | `/account` card, order detail after delivery, `/liff` home, `/account/surveys/[surveyId]` | One question per step on phone, all questions on desktop; progress "2/4"; reward line "+8 แต้ม เมื่อตอบครบ"; dismiss "ไว้ทีหลัง" (it stays reachable by link until it expires). PDPA purpose text. |
| **Reorder surfaces** | `/account/replenishment`, order detail "สั่งซ้ำ", cart reorder line, `/liff/orders` | "คาดว่าจะใช้หมดประมาณ 18 พ.ย." and, during an active campaign, the badge "สั่งซ้ำภายใน 7 วัน รับแต้ม ×1.5 · ถึง 12 พ.ย." (static date, no countdown, D-481). |
| **Win-back surfaces** | `/account` banner, `/account/points` summary, `/liff/points` | "มี 40 แต้มโบนัส ใช้ได้ถึง 4 ธ.ค." with a link to `/deals`. Lot expiry shown in the history. |
| **"สำหรับคุณ" tab** | `/deals`, `/liff/deals` | The tab is real. Signed out: a sign-in prompt card plus new-customer deals. Empty state: "ยังไม่มีดีลเฉพาะคุณตอนนี้" + link to all deals. Cards carry a short reason line ("สำหรับลูกค้าที่เคยสั่งกล่องลูกฟูก"); a reason never names an internal attribute (no inactivity, no business-type wording). |
| **Bundle CTA** | DealCard (bundle), `/deals/[slug]` | Primary button "เพิ่มชุดนี้ลงตะกร้า". A sheet lists the items (product, preset summary, quantity, unit price from the API) with a design option per item (default "ใช้ไฟล์ของฉัน"); confirm → `store.promotions.addBundle` → cart, where the bundle discount appears through the engine. |
| **Review photos** | review form on order detail | Up to 4 photos, "+10 แต้ม เมื่อแนบรูป", image upload through presign/complete (purpose `image`, scrubbed). |
| **Data refresh** | `/account/confirm-data` (+ checklist task, + yearly banner) | Read-only summary of the company, tax profiles and addresses with "แก้ไข" links; one "ยืนยันว่าข้อมูลถูกต้อง" button; reward line; next due date after confirming. |
| **Showcase consent** | `/account/showcase` (+ checklist task) | Scope checkboxes, PDPA consent text (versioned), status (รอตรวจสอบ / อนุมัติแล้ว / ไม่อนุมัติ), withdraw. |
| **Checkout** | payment step + summary | "ชำระด้วย QR หรือโอนเงิน รับแต้ม ×1.2". Points-to-earn shows the breakdown (ระดับสมาชิก ×1.25 · QR ×1.2 · สั่งซ้ำ ×1.5). |
| **P&L memo** | `/admin/finance/reports/profit-and-loss` | Memo line under the statement: "ภาระแต้มสะสม (ประมาณการ ที่อัตราใช้แต้ม 60% รอ CPA)" vs ledger 2330. |

## 7. Web wording sweep (D-489)

Rename "คะแนน" → "แต้ม" in `th` keys of `customer/account.json` (points, referral, home), `customer/checkout.json`,
`customer/cart.json`, `customer/liff.json`, `common/problems.json` (`insufficient_points`) and `admin/marketing.json`.
Not renamed: `customer/storefront.json` review rating ("คะแนนเฉลี่ย") and any other rating or score wording. A test
fails on "คะแนน" in any key under `*.points*`, `*.loyalty*`, `checkout.points*` or `referral*`. The `en` strings
are unchanged ("points").

## 8. Tests

- **Unit (api):**
  - `points-math.spec.ts`: combined multiplier, cap ×3, rounding down, property test.
  - `reorder-prediction.spec.ts`:
    - the formula, with worked cases:
      - qty 1,000, then 1,000 after 40 days, last qty 1,500 → 25/day → 60 days;
      - floor 30 days;
      - only 1 order → none;
      - zero-day interval ignored.
    - `remind_on`, and the skip rules.
  - `winback.spec.ts`: 90/180-day boundaries, consent, cap refusal.
  - `surveys.spec.ts`: 3–5 questions, one published per trigger, once per trigger key, reward once.
  - `audience.spec.ts`: each audience key, AND semantics, missing packaging profile.
  - `bundle.spec.ts`: v2 schema rules, stackGroup lock.
  - `activity-rewards.spec.ts`: new entries in the rules map, cap counting of the P2 types, multipliers not counted.
  - `operations-reports.spec.ts`: an activity reward appears in earned and closing (D-488).
  - `loyalty-analytics.spec.ts`: breakage, liability at rate, source mapping.
  - `posting-rules.spec.ts`: the new types post like `earn_signup` (P10).
- **e2e (api):**
  - `loyalty-p2.e2e-spec.ts`:
    - review 25 + photo 25;
    - first sample once;
    - data refresh once per 12 months;
    - showcase approve → reward, reject → none;
    - first order bonus;
    - payment ×1.2;
    - cap refusal.
  - `surveys.e2e-spec.ts`: open → seen → submit → reward; repeat refused; dismiss; expiry.
  - `reorder-reminder.e2e-spec.ts`:
    - prediction;
    - single message per cycle (with D-288);
    - campaign ×1.5 only for a D-153 reorder of that SKU in the window;
    - opt-out.
  - `winback.e2e-spec.ts`.
  - `deals.e2e-spec.ts` extended:
    - `for_you`;
    - `matching_only` never served to anonymous or non-matching callers;
    - bundle `addBundle`;
    - applicable-codes = checkCode for v2 conditions.
  - `loyalty-analytics.e2e-spec.ts`, P&L memo.
- **Confidentiality:** `storefront-factory-confidentiality.spec.ts` covers the surveys, campaigns, data-refresh,
  showcase, reorder-suggestion and deal (`bundle`, `forYouReason`) responses. The `forYouReason` enum never exposes
  `inactive_days` or `business_type`.
- **Web:**
  - vitest for `SurveySheet`, `SegmentPicker`, `BundleEditor`, `BundleSheet`, `ReorderBonusBadge`, `WinbackBanner`,
    `LoyaltyAnalytics`, the wording test;
  - Storybook stories;
  - MSW mocks;
  - e2e for `/deals` "สำหรับคุณ", survey flow, bundle add, analytics page;
  - prototype comparison and responsive sweep;
  - Lighthouse on `/deals` stays ≥ 90/95/100.
- **Anti-abuse (gate 9 additions):**
  - survey reward once per instance (DB + handler);
  - data refresh twice within 12 months refused;
  - win-back twice within 180 days refused;
  - first-order bonus once (DB);
  - multipliers capped;
  - `matching_only` deal never in any anonymous response or sitemap.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Two reorder messages for one SKU (D-288 + P2) | One-message-per-cycle rule both ways; jobs ordered 09:40 / 09:50; e2e. |
| Multipliers inflate liability | Combined cap ×3.00 (setting); the analytics page shows earn by source and the liability at rate; Finance sees the P&L memo. |
| Audience data from the packaging profile (internal) leaks through deal copy or reasons | `forYouReason` enum limited to `new_customer`, `tier`, `ordered_product_type`; publish guard blocks audience words in display text; confidentiality spec. |
| Win-back targeting customers without consent | Grant only with marketing consent on e-mail or LINE (D-487 rule); no silent lots. |
| Survey fatigue | One open survey at a time, 30-day spacing, shown once, dismiss is final for the feed. |
| Bundle presets go stale (product retired, price change) | Priced at add time through the quotation engine; the publish guard re-checks on activate; `promotions.bundle_unavailable` names the item. |
| `contract:build` / full `tsc` memory on the Linux VM | As in P1/P1.5: targeted typecheck + no-check emit here, full run on the Mac. |
| Review reward raised 10 → 25 on existing databases | `amendInForce` only while the value in force is the seed's 10.00; never overrides a Marketing edit. |
| Liability report numbers change for past months after the D-488 fix | Expected and correct; REPORT tells Finance; 2330 reconciliation line shows the gap that the GL already carries. |
