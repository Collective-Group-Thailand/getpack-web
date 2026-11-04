# getpack Points, Deals & Promotions — Expansion Plan

**Owner:** Superball · **Prepared by:** Claude (business team / tech lead) · **Date:** 2026-11-02, revised 2026-11-03 · **Status:** **Approved — all decisions taken 2026-11-04** (owner delegated the calls to Claude as head of team; owner agrees with all recommendations). Ready to build Phase 1 after `/deals` mockups.

> Goal: ทำให้แต้ม + ดีล เป็นเครื่องมือดัน 4 อย่าง — (1) ข้อมูลลูกค้าครบ, (2) สั่งซ้ำ, (3) บอกต่อ, (4) ยอดต่อออเดอร์สูงขึ้น — โดยต่อยอดจาก loyalty + promotion engine ที่มีอยู่แล้ว (D-053, D-130…D-136) ไม่สร้างใหม่

---

## 0. สถานะปัจจุบัน (code audit 2026-11-02/03)

### 0.1 Loyalty

| Area | Status | Where |
|---|---|---|
| Points ledger (append-only, FIFO lots, expiry, reversal) | ✅ Done | `prisma/schema/commerce.prisma`, migration `20261008000001_commerce_loyalty` |
| Earn: order spend, sign-up, LINE link, review, referral | ✅ Done | `src/modules/loyalty/loyalty.service.ts` |
| Earn: `earn_bonus` enum | ⚠️ Enum only — no producer | — |
| Reversal on refund / claim / cancel | ✅ Done | `onRefund`, `onOrderCancelled` |
| Tiers (member / silver / gold, nightly) | ✅ Done | `recalculateTiers`, setting `loyalty.tiers` |
| Redeem at checkout (cap 20 %, min ฿10, margin floor) | ✅ Done | `points-checkout.extension.ts` |
| Jobs: credit due, expire, remind 30 d, tiers | ✅ Done | `loyalty.jobs.ts` |
| Accounting P10 / P11 / P12, account 4930 | ✅ Done — `expected_redemption_rate_pct` **pending CPA** | `posting-rules-customer.ts`, `settings.ts` |
| Admin: ledger, manual adjust, settings UI | ✅ Done | `loyalty.controller.ts`, `LoyaltySettings.tsx` |
| Customer: `/account/points`, `/liff/points`, `/account/referral`, checkout balance | ✅ Done | `app/[locale]/(storefront)/account/points/page.tsx` |
| Earn from profile / tax profile / address / brand kit / first design / team invite | ❌ Missing | events exist: `customer.profile_updated`, `customer.tax_profile_created`, `customer.address_created`, `customer.identity_linked` |
| Social link reward for Google / Apple | ❌ Missing (LINE only) | `onIdentityLinked` filters `provider === 'line'` |
| "Earn checklist" on customer pages | ❌ Missing | — |
| Reward catalogue (free shipping, sample, rush, upgrade) | ❌ Missing (cash-off only) | coupon engine reusable |
| Campaign multipliers (reorder, early pay, anniversary) | ❌ Missing | only tier multiplier |
| Loyalty analytics (liability, breakage, earn vs redeem) | ❌ Missing | — |
| Points owner: user vs company | ⚠️ Decision | `loyalty_memberships.user_id` |

### 0.2 Promotions

| Area | Status | Where |
|---|---|---|
| Promotion engine: coupon / automatic / referral, campaigns, conditions (product type, qty), stacking, budget, usage limits, dates | ✅ Done | `src/modules/promotions/`, `Promotion` model |
| Cart code entry (max 3, D-452), `store.promotions.checkCode`, `store.promotions.listMine` | ✅ Done | `promotion-codes.controller.ts`, `store-promotions.controller.ts` |
| `/account/wallet` — store credit + codes held | ✅ Done | `account/wallet/page.tsx` |
| `customer_saved_coupons` table | ✅ Table only — no save UI | `commerce.prisma` |
| Admin promotions / campaigns / report | ✅ Done | `promotions.controller.ts` |
| **Public list of active promotions** | ❌ Missing | admin-only `/promotions` |
| **`/deals` storefront page**, home strip, PDP badge, cart coupon picker, LIFF | ❌ Missing | grep: no promo in home / products / cart |
| Promotion display fields (visibility, headline, banner, terms) | ❌ Missing | — |
| Audience / segment conditions | ❌ Missing (product type + qty only) | `conditions` jsonb v1 |
| Volume ladder shown before cart | ⚠️ `CartItemDto.tierHint` exists, not surfaced in configurator | D-452 (4) |
| Saved-quotation follow-up | ❌ Missing | D-051 lock exists |

---

## 1. Decisions (taken 2026-11-04, to be numbered D-5xx in `decisions.md`)

| # | Decision | **Decided** | Why |
|---|---|---|---|
| **DEC-1** | Points owner | **User-level** (Phase 1); company roll-up view later | Company-level = ledger FK migration + approval rules; defer until B2B team usage proves demand |
| **DEC-2** | Earn rate / point value | **Keep D-130/D-131** (1 pt / ฿500, 1 pt = ฿2.50 → 0.5 % back) | Wired to P10 and CPA review; add generosity through activity rewards and campaigns instead |
| **DEC-3** | Activity reward values | **§2.1 table as written** | Sized by data value to getpack |
| **DEC-4** | Non-transactional earning cap | **฿1,500 equiv. (600 pts) per account per rolling 12 m** (activity + bonus) | Anti-abuse; order / referral not capped |
| **DEC-5** | One-off rewards once per account; duplicate phone / tax ID → held for Marketing review | Reuse D-136 matcher | Already exists for referrals |
| **DEC-6** | Platinum tier (≥ ฿500,000 / 12 m, ×2) + tier perks | **Yes, Phase 3** | Perks are coupon-based → catalogue first |
| **DEC-7** | Reward catalogue items | **§4 as written** | Needs new coupon benefit kinds |
| **DEC-8** | `loyalty.expected_redemption_rate_pct` | **60 % provisional**, setting stays `confirmation: pending_cpa`; §6 breakage report replaces the assumption once 12 m of data exist | 100 % overstates liability on the executive P&L |
| **DEC-9** | Public deals: what may be shown | Public deals never name a factory, lead time promises are getpack's; margin guard at checkout unchanged; no countdown-style flash sales or spin-the-wheel mechanics (B2B brand) | Owner's factory-confidentiality rule; brand positioning |

---

## 2. Earn matrix (target state)

Values in baht; setting `loyalty.activity_rewards` (extended), converted at `loyalty.point_value`.

### 2.1 Onboarding (once per account) — Phase 1

| Entry type | Trigger event | Baht | Pts | Notes |
|---|---|---|---|---|
| `earn_signup` (exists) | `customer.registered` (not via CS) | 50 | 20 | — |
| `earn_line_link` → generalise to `earn_identity_link` | `customer.identity_linked` provider ∈ {line, google, apple} | 20 each | 8 | Once per provider; `points_ledger.meta jsonb` {provider} + partial unique index |
| `earn_phone_verified` | `customer.phone_verified` (emit from OTP flow if absent) | 20 | 8 | — |
| `earn_profile_completed` | `customer.profile_completed` (new, once; `customer_profiles.profile_completed_at`) | 50 | 20 | Required: display name, business type, product category, phone verified |
| `earn_tax_profile` | `customer.tax_profile_created` (first) | 100 | 40 | Highest-value data; DEC-5 hold on duplicate tax ID |
| `earn_address` | `customer.address_created` (first) | 20 | 8 | — |
| `earn_brand_kit` | `studio.brand_kit_created` (first logo / brand kit) | 50 | 20 | Confirm event name in `src/modules/studio` |
| `earn_first_design` | `design.saved` (first) | 20 | 8 | — |
| `earn_team_invite` | `company.member_accepted` (first distinct verified user) | 50 | 20 | — |
| `earn_packaging_profile` | `customer.packaging_profile_completed` (new form: monthly box volume, product category, ship-to provinces, peak season) | 100 | 40 | Data used for demand mapping and factory recruitment (internal use only, never published) |
| `earn_line_oa_friend` | LINE OA follow webhook | 20 | 8 | Only if OA integration exposes follow events |

### 2.2 Engagement — Phase 2

| Entry type | Trigger | Baht | Pts | Notes |
|---|---|---|---|---|
| `earn_review` (exists) | review on delivered order | 10 → **25** | 10 | +25 with photo (`earn_review_photo`) |
| `earn_first_sample` | first sample order completed | 50 | 20 | — |
| `earn_survey` | survey completed | 20 | 8 | Channel: in-app vs external webhook — open question |
| `earn_showcase_consent` | customer opts in to showcase (Marketing approves) | 100 | 40 | — |
| `earn_data_refresh` | yearly confirmation / update of company + addresses (`customer.data_refreshed`) | 30 | 12 | Keeps data fresh; PDPA self-review; once per 12 m |
| `earn_payment_method` | order paid by QR / bank transfer (not card) | ×1.2 on `earn_order` | — | Card fees 2–3 % > point cost 0.5 % |

### 2.3 Transaction bonuses & lifecycle — Phase 2/3 (campaign engine)

| Rule | Multiplier / bonus | Mechanism | Phase |
|---|---|---|---|
| First order | +฿300 equiv (120 pts) | `earn_bonus` reason `first_order` | 2 |
| **Reorder reminder + bonus** — predicted stock-out date from last order qty + cadence → LINE "สั่งซ้ำภายใน 7 วัน รับแต้ม ×1.5" | ×1.5 on `earn_order` for D-153 reorders within the window | `loyalty_campaigns` row auto-created per customer; `reorder.reminder` notification | 2 |
| **Win-back** — no order > 90 d | +฿100 equiv (40 pts), lot expires in 30 d | `earn_bonus` reason `winback`, custom `expires_at` | 2 |
| Paid in full before due date (non-instalment) | ×1.2 | — | 3 |
| Account anniversary month | ×2 | campaign | 3 |
| Admin ad-hoc campaign | ×N by date range / product type / segment | `loyalty_campaigns` table | 3 |

---

## 3. Earn checklist (customer driver) — Phase 1

**API** `GET /loyalty/tasks` →
```json
{ "tasks": [
  { "code": "tax_profile", "title": {"th": "...", "en": "..."}, "points": 40,
    "status": "todo|done|held", "href": "/account/tax-profiles/new", "doneAt": null }
], "earnedPoints": 36, "availablePoints": 60, "capRemainingPoints": 564 }
```
Derived from settings + ledger (no new table); `held` when DEC-5 applies; highest points first, done last.

**Web** — `/account/points` checklist card (between `SummaryCards` and `TierProgress`); `/account` home banner "รับแต้มเพิ่ม X แต้ม"; `/liff/points`; realtime toast "+40 แต้ม — เพิ่มข้อมูลผู้เสียภาษี". Thai copy first; Anuphan only; light theme has no dark surfaces.

---

## 3.5 Deals & promotions surface — **Phase 1.5**

### 3.5.1 Schema
- `promotions.visibility` enum `public | unlisted | hidden` (default `hidden` — existing rows unaffected).
- `promotions.display jsonb` `{headline, subline, badge, terms, heroImageKey, themeColor}`; `display_schema_version`.
- `conditions` v2 adds `cartProductTypeCount ≥ n` (bundles, Phase 2) and `audience` (Phase 2, §3.5.5).
- Show = `visibility=public` ∧ `status=active` ∧ now ∈ [startsAt, endsAt].

### 3.5.2 API (`store` surface)
- `GET /v1/store/promotions` (public, cached 60 s): card per promotion — name, benefit summary ("ลด 10% สูงสุด ฿500"), main conditions, ends-at, code when `CouponKind.single`, per-customer status `claimable | saved | used | not_eligible` when signed in; `?productTypeCode=` filter for PDP badge; `?ref=AGENT` accepted and forwarded to attribution.
- `POST /v1/store/promotions/:promotionId/actions/save` → `customer_saved_coupons` (409 if already saved / not saveable).
- `GET /v1/store/cart/applicable-codes` — codes I hold that pass `checkCode` against the current cart (reuses `PromotionCodes.check`).
- `GET /v1/store/quotations/:id/ladder` — surfaces `tierHint` style next-cheaper options for the configurator (no new pricing).

### 3.5.3 Storefront
| Surface | What | Notes |
|---|---|---|
| `/deals` | Hero deal + card grid; tabs ทั้งหมด / สำหรับคุณ / ใกล้หมดเวลา / แลกด้วยแต้ม (tab wired in Phase 3); card: badge, headline, benefit, conditions, ends-at, **เก็บโค้ด** (signed in) or **คัดลอก**; "เหลือ < 72 ชม." label (no live countdown, DEC-9) | indexable; JSON-LD `Offer`; FAQ block "getpack มีโปรโมชันอะไรบ้าง" (AEO) |
| Home | 3-card deal strip + "ดูดีลทั้งหมด" | hidden when < 1 public deal |
| PDP / configurator | badge "มีโปร: ลด 10% เมื่อสั่ง ≥ 1,000 ใบ" from promotions matching product type; **volume ladder** next to price: "สั่ง 2,000 ใบ ราคาต่อใบลดอีก 12%" | ladder = pricing data, zero promo cost |
| Cart | replace bare code field with **คูปองที่ใช้ได้กับตะกร้านี้** picker (+ manual entry kept) | `applicable-codes` |
| `/liff/deals` | same cards, LIFF sizing; LINE OA rich message template on new public deal | — |
| `/account/wallet` | unchanged; empty state links to `/deals` | — |
| Agent | every public deal has share URL `/deals/{slug}?ref={agentCode}`; landing stores attribution cookie → lead management | ties to agent.getpack.co |

### 3.5.4 Saved-quotation recovery (B2B abandoned cart)
- Quotation locked (D-051) but not ordered: day 3 LINE/email "ราคานี้ล็อกให้ถึงวันที่ X"; day 6 same + small per-customer coupon (free shipping) issued through the promotion engine (`kind=coupon`, `per_customer`, `usageLimitPerCustomer=1`, 7-day validity).
- Setting `promotions.quote_recovery` `{day1: 3, day2: 6, coupon: 'free_shipping', enabled}`; worker `promotions.quote_recovery` daily; stops when ordered / expired / customer opted out.
- Notification matrix rows `quotation.recovery_1`, `quotation.recovery_2`.

### 3.5.5 Phase 2 additions
- **Audience segments** in `conditions.audience`: `new_customer`, `tier ∈ […]`, `business_type ∈ […]`, `inactive_days ≥ n`, `ordered_product_type ∈ […]` → makes "สำหรับคุณ" real; admin segment picker in promotion editor.
- **Bundle deals**: condition `cartProductTypeCount ≥ 2` + `stack_group=bundle`; card CTA "เพิ่มชุดนี้ลงตะกร้า" pre-fills configurations.
- **Agent-shareable links** (above) with per-agent performance in the promotions report.

### 3.5.6 Phase 3 addition — capacity-driven deals
- Factory ERP production planner exposes weekly utilisation per capability; when free capacity next week > threshold (setting `promotions.capacity_deal` `{minFreePct: 30, discountPct: 5, leadTimeDaysSaved: 3}`), worker drafts an `automatic` promotion for matching product types with `display` copy "สั่งสัปดาห์นี้ ผลิตเสร็จเร็วขึ้น 3 วัน + ลด 5%"; Marketing approves (maker-checker) before it goes public. Never references any factory. Depends on planner data being stable.

---

## 4. Reward catalogue — Phase 3

| Reward | Cost (pts) | Mechanism | Constraint |
|---|---|---|---|
| ฿50 / ฿100 / ฿250 cash-off (existing checkout redemption stays) | 20 / 40 / 100 | existing extension | D-133 caps |
| Free shipping (1 order) | 60 | coupon benefit `free_shipping`, per-customer code | min order ฿2,000 |
| Free sample / mockup | 80 | `free_sample` | one per 3 months |
| Free rush production | 120 | `free_rush` | capacity permitting; never names a factory |
| Print upgrade (matte / spot UV) | 100 | `free_addon` with addon code | supported product types |
| Extra artwork revision round | 40 | coupon on D-071 fee | — |

Tables: `reward_catalog_items` (code, kind, costPoints, value, constraints jsonb, tierRequired, active window) · `reward_redemptions` (userId, itemId, pointsEntryId, couponCodeId, status). Redeem = negative `redeem` ledger entry consuming lots + per-customer `coupon_codes` row; unused coupon cancelled within 7 d → `redeem_reversal`. Page `/account/points/redeem` (also the "แลกด้วยแต้ม" tab on `/deals`) + admin editor under `/admin/marketing/loyalty`.

**Never**: cash-out, bank transfer, transferable points.

---

## 5. Tiers — Phase 3

| Tier | 12-m spend | Multiplier | Perks |
|---|---|---|---|
| Member | 0 | ×1 | — |
| Silver | ≥ ฿50,000 | ×1.25 | 1 free-shipping coupon / quarter |
| Gold | ≥ ฿200,000 | ×1.5 | free shipping every order; priority support tag; **credit limit uplift** (admin-set per-company limit auto-raised by tier factor, D-4xx flexible credit limits) |
| Platinum (new) | ≥ ฿500,000 | ×2 | Gold + 1 free rush / quarter; **priority production slot** (1–2 days shorter promised ship date, planner flag); 30-day terms; named account manager |

Nightly `recalculateTiers` grants perk coupons at quarter start (idempotent `tier_perk_grants` keyed by user, tier, period) and writes the credit-limit uplift as a new effective-dated limit version with reason `tier_uplift` (audited; Finance can override).

---

## 6. Loyalty & promotion analytics — Phase 2 (admin)

`/admin/marketing/loyalty/analytics` + feed into executive P&L:
- Points liability outstanding (pts × value × DEC-8 rate), monthly movement (earned / redeemed / expired / reversed).
- **Breakage rate** actual (expired ÷ issued, trailing 12 m) vs DEC-8 assumption — the number the CPA needs.
- Earn vs redeem by source (order / activity / referral / bonus) and by tier.
- Retention: repeat-order rate for redeemers vs non-redeemers; reorder-reminder conversion; win-back conversion; quote-recovery conversion.
- Promotions: existing `/promotions/report` extended with per-deal views, saves, uses, revenue, margin after discount, per-agent attribution.

---

## 7. Technical work breakdown

### Phase 1 — Onboarding earn + checklist (6–8 dev-days)
1. **Schema**: extend `points_entry_type`; add `points_ledger.meta jsonb`; replace `ux_points_ledger__one_off_rewards` with partial unique index on (`user_id`, `entry_type`, `coalesce(meta->>'provider','')`) for all one-off types; update `ck_points_ledger__sign`; `customer_profiles.profile_completed_at`, `packaging_profiles` table. Migration `2026xxxx_loyalty_activity_rewards`.
2. **Settings**: extend `loyalty.activity_rewards`; add `loyalty.activity_cap` `{bahtPer12m: '1500.00'}`; `shape.ts`, `LoyaltySettings.tsx`, tests.
3. **Events**: emit `customer.profile_completed`, `customer.phone_verified`, `customer.packaging_profile_completed`, `studio.brand_kit_created`, `design.saved`, `company.member_accepted` — verify names against existing emitters first.
4. **Handlers**: generic `onActivity(entryType, event)` with rules map `{entryType → {event, filter, bahtKey, oncePer}}`; cap (DEC-4); DEC-5 hold → `status: pending`, `reason: 'held_duplicate_identity'`, Marketing review queue (reuse referrals queue).
5. **API**: `GET /loyalty/tasks`; packaging profile CRUD; OpenAPI + `contract.lock.json`.
6. **Web**: `EarnChecklist` (`features/customer/account/`), packaging-profile form, wiring into `/account/points`, `/account`, `/liff/points`; realtime toast.
7. **Tests**: unit (rules map, cap, hold); e2e extend `loyalty.e2e-spec.ts`; web vitest + Storybook; UAT seed customer with 3 tasks done.
8. **Docs**: D-5xx rows in `decisions.md`; `accounting-design.md` §5 note; this plan.

### Phase 1.5 — Deals surface (4–5 dev-days)
1. Schema §3.5.1 + migration; admin promotion editor gains Visibility + Display tab (image upload via existing S3 assets).
2. API §3.5.2 (public list, save, applicable-codes, ladder) + contract bump.
3. Web: `/deals` (+ `[slug]` detail for share links), home strip, PDP badge + volume ladder, cart coupon picker, `/liff/deals`; JSON-LD + FAQ; agent `?ref` attribution cookie.
4. Quote recovery worker + notifications + setting (§3.5.4).
5. Tests: e2e `deals.e2e-spec.ts` (visibility, eligibility, save, applicable-codes), `quote-recovery.e2e-spec.ts`; Storybook for `DealCard`, `CouponPicker`, `VolumeLadder`; Lighthouse budget on `/deals`.
6. Claude Design mockups first for `/deals` and PDP badge (owner review before build).

### Phase 2 — Engagement, lifecycle, segments, analytics (8–10 dev-days)
- §2.2 earn types; reorder reminder + win-back (`loyalty_campaigns` minimal: userId?, multiplier, bonusBaht, window, reason); audience segments + bundle condition + agent links (§3.5.5); analytics (§6); survey channel decision.

### Phase 3 — Catalogue, tiers, campaigns, capacity deals (10–12 dev-days)
- Coupon benefit kinds + catalogue tables + redeem page + admin editor; full `loyalty_campaigns` (date/product/segment multipliers) in `earnForOrder`; Platinum + perk grants + credit-limit uplift + priority slot flag; capacity-driven deals (§3.5.6); executive P&L points liability with DEC-8 rate.

### Cross-cutting
- TH/EN copy in `messages/*.json`; Anuphan only; light theme no dark surfaces; no "coming soon" UI.
- Audit rows for every manual / held reward decision and every promotion visibility change.
- Nothing customer-facing names, counts or hints at partner factories.
- Every new public page: technical SEO + JSON-LD + AEO/GEO block.

---

## 8. Acceptance criteria

**Phase 1**
- Completing all §2.1 tasks earns exactly the configured total once; repeats earn nothing (DB index + guard).
- Duplicate tax ID / phone → `pending` entry in Marketing queue; approve credits, reject reverses.
- 601st activity point in rolling 12 m refused with audit note.
- Checklist updates within 1 s (realtime); deep links land on the right form.
- P10 journal for activity rewards identical in shape to today's sign-up reward.

**Phase 1.5**
- A `hidden` promotion never appears on any store surface or public API; `public` appears within 60 s of activation and disappears at `endsAt`.
- Cart picker shows only codes that `checkCode` accepts for that cart; applying one yields the same totals as manual entry.
- PDP badge appears only for promotions whose conditions match the product type; ladder values equal quotation options.
- Quote recovery sends at most 2 messages per quotation, none after order / expiry / opt-out; coupon single-use.
- `/deals` passes Lighthouse performance budget and has valid `Offer` JSON-LD.
- Share link with `?ref=` attributes the resulting lead to the agent.

---

## 9. Decisions on the open questions (2026-11-04, Claude as head of team; owner agrees)

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Points owner | User-level now (DEC-1) | — |
| 2 | Activity values | §2.1 approved | — |
| 3 | Survey channel | **In-app**: `surveys` module with 3–5 question templates, shown once per trigger (post-delivery, quarterly); no external webhook | Keeps data in-system, no HMAC/PDPA transfer, reuses forms + realtime |
| 4 | LINE OA follow events | **Available** — `line-webhook.service.ts` already handles `follow`; `earn_line_oa_friend` emits `customer.line_oa_followed` when the LINE user maps to a customer account | Verified in code |
| 5 | Expected redemption rate | 60 % provisional, `pending_cpa` (DEC-8) | — |
| 6 | Quote-recovery coupon | **Free shipping**, single-use, 7-day validity | Perceived value high, cost = reference shipping rate; no price-anchor erosion on product |
| 7 | Tier credit-limit uplift | **Automatic** effective-dated limit version: Gold ×1.5, Platinum ×2 of the company's base limit, capped at **฿1,000,000** without manual approval; Finance notified (`credit_limit.tier_uplift`) and may override; above the cap → normal credit-limit approval policy (D-449/D-451) | Tier is earned by paid spend, so exposure grows with proven payment history; cap keeps maker-checker for large exposure |

### Immediate next steps
1. Claude Design mockups: `/deals` (desktop + phone), PDP badge + volume ladder, cart coupon picker, `/account/points` checklist card — owner review.
2. Add D-5xx rows to `decisions.md` (DEC-1…9 + §9).
3. Build Phase 1 (branch `feat/loyalty-activity-rewards`), then Phase 1.5 (`feat/deals-surface`); merge to main per part when green.
