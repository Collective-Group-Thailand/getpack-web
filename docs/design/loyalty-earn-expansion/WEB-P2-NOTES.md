# Web P2 notes — engagement, lifecycle, segments, analytics

Branch `feat/loyalty-p2-lifecycle` (getpack-web). Plan: `plans/P2-PLAN.md`. Contract: `API-CHANGES-P2.md`. Design:
`DESIGN-NOTES.md` (P2 section), `prototypes/p2-*.html`, `screenshots/P2/` (5 prototypes × 390 + 1440, all present).
Nothing pushed or merged. getpack-api has not published P2: every P2 call goes through the contract-request layer.

## 1. Checklist (P2-PLAN items 13–17, web)

| Item | Where | State |
|---|---|---|
| Prototypes + screenshots (surveys, lifecycle, for-you, bundles, analytics, audience) | `prototypes/p2-*.html`, `screenshots/P2/` | done (24faf8f7) |
| Contract requests + MSW (store + admin) | `lib/api/requests/{store,admin}-loyalty-p2.ts`, `mocks/{store,admin}/loyalty-p2.ts`, `docs/contract-requests.md` | done (1d5fa90b) |
| D-489 "แต้ม" sweep + `customer-wording` test | `src/i18n/customer-wording.test.ts` | done (920fbe52) |
| Survey card + sheet (`/account`, order page, `/liff`), `/account/surveys/[surveyId]` | `features/customer/surveys/*` | done (7767ebc3, ecc2c215) |
| Earn tasks: data refresh, showcase consent, first sample; `/account/confirm-data`, `/account/showcase` | `features/customer/loyalty/{DataRefreshView,ShowcaseConsentForm}.tsx` | done (58cbddc3) |
| Reorder bonus (replenishment, order page), win-back (`/account`, `/account/points`, `/liff/points`), checkout breakdown + QR/transfer hint | `ReorderBonusBadge`, `WinbackBanner`, `PointsBreakdown` | done (3701285a) |
| Reorder bonus on the **cart line** and **`/liff/orders`** | `CartItemCard`, `liff/orders/page.tsx` | **added in this run** |
| Yearly data-refresh **banner** on `/account` | `features/customer/loyalty/DataRefreshBanner.tsx` | **added in this run** |
| "สำหรับคุณ" tab (`/deals`, `/liff/deals`), bundle CTA + sheet | `DealsView`, `LiffDeals`, `BundleSheet`, `DealCard` | done (e50b3549) |
| **Review photos** (review form on the order page) | `features/customer/orders/{OrderReview.tsx,review.ts}` | **added in this run** — the web had no review form at all; the card now covers rating, comment and up to 4 photos |
| Promotion editor: audience (segment picker, estimate, listing), bundle editor | `PromotionAudience`, `SegmentPicker`, `PromotionBundle` | done (75331458) |
| Promotion report per-agent table | `AgentLinksTable` | done (61620079) |
| `/marketing/loyalty/analytics` | `LoyaltyAnalytics`, `MovementChart` | done (cd0771e1) |
| P&L memo line | `features/admin/finance/PointsLiabilityMemo.tsx` | done (ed2450af) |
| `/marketing/surveys` list, publish/retire/new version, results | `SurveysAdmin` | done (cfbfb0ac) |
| `/marketing/surveys` **template editor** (3–5 questions) | `SurveyTemplateEditor`, `survey-template.ts` | **added in this run** |
| Approvals inbox names `showcase_consent_review`; LoyaltySettings P2 fields | `admin/approvals.json`, `LoyaltySettings.tsx` | done (cfbfb0ac) |
| Vitest | SurveyForm, AccountLoyaltyForms, Lifecycle (+ DataRefreshBanner), ForYou (incl. BundleSheet), Audience (SegmentPicker, PromotionAudience, PromotionBundle), AgentLinksTable, LoyaltyAnalytics, PointsLiabilityMemo, SurveysAdmin, **SurveyTemplateEditor**, **OrderReview**, `loyalty-p2/read`, wording | done |
| Storybook | Survey, Lifecycle (+ DataRefreshDue), DealCard bundle/for-you, Admin Loyalty P2 (movement, audience, **agent links**, **P&L memo**), **Customer/Orders/Review** | done; forms that need `useRouter` (BundleSheet, DataRefreshView, ShowcaseConsentForm) have no story, as in P1 |
| Playwright e2e for `/deals` for-you, survey flow, bundle add, analytics | — | **not written** (no browser or Next build here; see §5) |

## 2. Routes

| Route | P2 content |
|---|---|
| `/account` | survey card (shown once), win-back banner, yearly data-confirmation banner (only when due again after an earlier confirmation) |
| `/account/surveys/[surveyId]` | the survey on its own page (closed/expired state) |
| `/account/confirm-data`, `/account/showcase` | data refresh, showcase consent (+ checklist tasks) |
| `/account/points`, `/liff/points` | win-back lot in the balance card |
| `/account/replenishment` | predicted stock-out + reorder bonus |
| `/account/orders/[orderId]` | post-delivery survey card, reorder bonus beside "สั่งซ้ำ", **review card** (delivered, not cancelled): stars, comment, up to 4 photos; then status, photos, reply, the API's reward, "แนบรูปเพิ่ม" |
| `/cart` | "แต้ม ×1.5 · ถึง …" under a reorder line whose order has an open campaign |
| `/checkout` | points breakdown (tier × QR/transfer × reorder × promotion) and the QR/transfer hint |
| `/deals?tab=for_you`, `/liff/deals` | the real "สำหรับคุณ" tab, reason lines, bundle tickets |
| `/deals/[slug]` | bundle CTA "เพิ่มชุดนี้ลงตะกร้า" → sheet → `addBundle` → `/cart` |
| `/liff`, `/liff/orders` | survey card; reorder bonus on the repeated order's card |
| admin `/marketing/loyalty/analytics` | KPIs, monthly movement, earn/redeem by source and tier, retention, programmes |
| admin `/marketing/surveys` | templates, **create / edit draft**, publish / retire / new version, results |
| admin `/marketing/promotions/[id]?tab=audience\|bundle` | segment picker + estimate + listing; bundle items + guard |
| admin `/marketing/campaigns/[id]` | per-agent link table |
| admin `/finance/reports/profit-and-loss` | points-liability memo |

## 3. Contract requests to adopt when getpack-api publishes P2

`pnpm gen:api --adopt --tag vX.Y.Z`; `registry.test.ts` then names what to retire. Open P2 ids (all 2026-11-04,
`docs/contract-requests.md`):

- **store:** `store.promotions.add-bundle`, `store.loyalty.campaigns`, `store.reviews.add-photos`,
  `store.loyalty.data-refresh`, `store.loyalty.showcase-consent`, `store.surveys`, `store.loyalty.p2-fields`
  (new fields on published reads: deals, loyalty summary, tasks, ledger, reorder suggestions, checkout `points`).
- **admin:** `admin.loyalty.analytics`, `admin.loyalty.campaigns`, `admin.promotions.audience`,
  `admin.promotions.agent-performance`, `admin.surveys`, `admin.showcase-consents`, `admin.loyalty.p2-fields`
  (P&L `pointsLiability`).

On adoption: `review.ts` `reviewPhotosOf` and `features/shared/loyalty-p2/read.ts` drop their `safeParse` reads for
the generated types; `loyalty-types.ts` widening goes; the review card may send `photoFileIds` with the submit body
instead of the second call (the two-step flow stays valid either way).

Asks for getpack-api found in this run:

1. **Review reward before submitting.** The form cannot say "+10 แต้ม" before the review exists (the web never
   computes points): it says "แนบรูปจริงรับแต้มเพิ่ม". A `reviewRewardPoints` / `photoRewardPoints` preview on
   `store.reviews.get`'s 404 or on the order (`OrderDto.review`) would let it show the figure, as the survey does.
2. **Review eligibility on the order.** The card shows for delivered, not cancelled orders and asks `store.reviews.get`
   for each; an `order.review` next action (or `reviewable` flag) would avoid the read on orders that cannot be
   reviewed. `reviews.not_delivered` is handled.
3. **Survey template code uniqueness** has no problem code in the contract; the editor shows the API's detail.

## 4. Gate results (Linux VM, `$HOME/linuxbind` esbuild + rolldown, nothing installed into the repo)

| Gate | Result |
|---|---|
| `tsc --noEmit` (whole repo) | **SKIPPED** — > 170 s per call here and background jobs are killed between calls |
| `tsc` on all 108 TS/TSX files changed in P2 and their import graph (temporary config, removed; a planted error is reported) | **PASS** |
| ESLint on the 108 files + `.storybook/main.ts` | **PASS** (one unused-variable warning fixed) |
| Prettier `--check` on all 126 changed TS/TSX/JSON files | **PASS** |
| Vitest: `features/customer/{orders,loyalty,surveys,deals,cart,account,checkout,repeat,liff,fulfilment}`, `features/admin/{marketing,finance,approvals}`, `features/shared`, `src/i18n` (keys used, parity, ICU, problem copy, customer wording), `src/lib/api`, `mocks`, `src/app`, `src/proxy.test.ts`, `design-language.test.ts` — 78 files / 623 tests | **PASS** |
| `gen:api --check` | **PASS** (contract 0.75.0; request document in sync) |
| `tokens:check`, `contrast` (165 pairs × 3 themes) | **PASS** |
| Wording grep (`โรงงาน\|factory\|กำไร\|margin\|coming soon\|ทันที\|countdown`) on lines added in P2 to customer/public/LIFF files, store mocks and customer/common messages, and on the P2 prototypes | **PASS** — only a test asserting "ทันที" is absent and comments saying "never a countdown" |
| "คะแนน" for points in `th` | **PASS** — none in customer, LIFF, checkout, cart, problems or admin marketing. Left by design: ratings (`storefront.trust.reviews.average`, admin content `reviews.rating`), factory/vendor scorecards, and the finance GL names of account 2330 ("หนี้สินคะแนนสะสม", the registered account name, excluded in `customer-wording.test.ts`) |
| Storybook build, `next build`, Playwright e2e, Lighthouse on `/deals`, prototype ↔ page visual compare | **SKIPPED** — need the Mac (Next SWC, browser, Vite native bindings) |

## 5. Deviations and open issues

1. **Review card without its own prototype.** The plan listed a "review photo step" prototype; none was drawn. The
   card follows the order page's panel, the survey's rating radiogroup (stars here, since ratings are the one place
   stars mean something) and the claim form's photo picker. Compare it on the Mac at 390 and 1440 and adjust.
2. **E2E not written** for `/deals` "สำหรับคุณ", the survey flow, bundle add and the analytics page (P2-PLAN §8);
   they need `pnpm dev:mock` and a browser.
3. **Stacked banners on `/account`.** Survey card, earn banner, win-back and the data-confirmation banner can all show
   together for one customer. Each is rare and the data banner only appears a year after a confirmation; if the
   visual review finds the stack heavy, show at most two (survey first).
4. The MSW review is per order but the mock order code and product type are fixed (`OR-2610-0042`, folding carton).
5. Storybook stories that render `@/i18n/navigation` `Link` under Vite remain unverified (as P1 / P1.5).
6. Admin `GET /v1/admin/showcase-consents` and `GET /v1/admin/loyalty/campaigns` are defined and mocked but have no
   screen yet (not in the P2 screen list).

## 6. Commands for the owner (Mac)

```sh
cd getpack-web   # on feat/loyalty-p2-lifecycle
pnpm install
pnpm gen:api:check
pnpm typecheck && pnpm lint && pnpm test
pnpm tokens:check && pnpm contrast
pnpm storybook   # Customer/Account/Survey, Customer/Loyalty/Lifecycle, Customer/Orders/Review,
                 # Customer/Deals/DealCard (Bundle, ForYouReason), Admin/Marketing/Loyalty P2
pnpm build
pnpm dev:mock
#   http://localhost:3000/account                        (survey card, win-back)
#   http://localhost:3000/account/orders/<a delivered order>   (review card: stars, comment, photos)
#   http://localhost:3000/account/replenishment          (×1.5 badge, filled สั่งซ้ำ)
#   http://localhost:3000/cart                           (reorder line with the bonus, after "สั่งซ้ำ")
#   http://localhost:3000/checkout                       (points breakdown, QR/transfer hint)
#   http://localhost:3000/deals?tab=for_you              (reason lines, bundle ticket → sheet → cart)
#   http://localhost:3000/account/confirm-data  /account/showcase  /account/surveys/<id>
#   http://localhost:3000/liff  /liff/points  /liff/deals  /liff/orders
#   http://admin.localhost:3000/marketing/loyalty/analytics
#   http://admin.localhost:3000/marketing/surveys        (สร้างชุดคำถาม, แก้ไข a draft, publish)
#   http://admin.localhost:3000/marketing/promotions/<id>?tab=audience  and  ?tab=bundle
#   http://admin.localhost:3000/finance/reports/profit-and-loss
pnpm e2e
pnpm lhci        # /deals stays ≥ 90/95/100
# Visual compare at 1440 and 390 (light; then 390 dark):
#   prototypes/p2-survey.html             vs /account + the survey sheet
#   prototypes/p2-lifecycle.html          vs /account/replenishment, /account, /checkout
#   prototypes/p2-for-you.html            vs /deals?tab=for_you, /liff/deals
#   prototypes/p2-loyalty-analytics.html  vs /marketing/loyalty/analytics
#   prototypes/p2-promotion-audience.html vs the promotion editor tabs
# When getpack-api publishes P2:
pnpm gen:api --adopt --tag vX.Y.Z   # registry.test.ts lists the P2 requests to retire
```

## 7. Integration (2026-11-04, getpack-api `feat/loyalty-p2-lifecycle` 09338241)

- **Contract.** `contract/openapi.json` is the API branch's document (1501 paths), pinned unreleased in
  `contract.lock.json` (commit 09338241, still labelled 0.75.0 / v0.75.0 so `verifyLock` passes, as the P1.5 pin).
  `pnpm gen:api` regenerated `schema.d.ts`, the MSW examples/problems, `problem-codes.ts` and
  `docs/contract-requests.openapi.json`. Re-adopt with `pnpm gen:api --adopt --tag vX.Y.Z` once the API tags a release.
- **Adopted (generated client).** All 23 P2 operations and both `…p2-fields` requests left the registry
  (`store-loyalty-p2.ts` / `admin-loyalty-p2.ts` deleted), `awaiting-triage.ts` and the open table of
  `docs/contract-requests.md` (four "Resolved" rows). Screens call `browserApi` / `serverApi` /
  `adminBrowserApis().contract`; types are `Schemas` aliases in `features/shared/loyalty-p2/types.ts`. The
  `safeParse` readers (`loyalty-p2/read.ts`, `reviewPhotosOf`) and the `loyalty-types.ts` widening are gone.
- **API-CHANGES-P2 deviations followed.** (1) Data-refresh and survey rewards are written synchronously: the toast and
  "ได้รับ … แต้ม" are credited figures; the confirm reply's `rewardPoints` is the next cycle's (0). (2) `toEarn` never
  includes the payment bonus (`multipliers.paymentMethod` "1.00"); the QR / transfer line is `paymentBonus` +
  `toEarnWithPaymentBonus`. (3) A bundle saves before its items (`display.bundle: null`, the tab says "เผยแพร่ได้เมื่อ
  ชุดมีสินค้าครบ"); the publish guard's `bundle_items` is listed under the preview; the mock's guard does the same.
  (4) addBundle is all or none; `promotions.bundle_unavailable` names the items; `If-Match` optional. (5) Survey
  `order_id` / quarterly opening: nothing on the web. (6) An approved showcase consent can be changed
  ("เปลี่ยนสิ่งที่อนุญาต"): the new request withdraws the approved one; no second reward line. (7) Win-back cycle, (8)
  one promotion bonus per order × promotion: labels only (`bonusReasons.promotion`). (9) Audience estimate rounded to
  tens (mock too). (10) `EntryMultipliersDto`, `B2bCompanyDto`, `TemplateVersionStatus`; also `BonusLotReason` =
  `winback` only, survey seen/dismiss answer 200 `SurveyEnvelopeDto`, template list paginated (`data`), results
  `responses` / `completionRatePct` / `counts` / `texts`, templates `completed` / `opened` / `createdAt`,
  `StoreReorderSuggestionDto`, `ProfitAndLossDto.pointsLiability`, `display.listing` always present. (11)
  `loyalty.analytics` owned by `finance_manager`; Finance reads the analytics through `loyalty.read` (D-496, copied
  verbatim from getpack-api `docs/decisions.md`).
- **Review photos.** `store.reviews.addPhotos` answers the whole `ReviewDto`: the card now replaces its photo list
  instead of appending (the request-era code would have listed new photos twice). The two-step flow stays.
- **The three asks of §3.** (3) Template code uniqueness **is served**: 422 `validation.failed` with `code` · `taken`;
  the editor shows "มีชุดคำถามที่ใช้รหัสนี้แล้ว…" under the code field (`isCodeTaken`). (1) Review reward before
  submitting and (2) review eligibility on the order are **not served**: they stay open as contract requests
  `store.reviews.reward-preview` and `store.orders.reviewable` (rows in `docs/contract-requests.md`; fields on
  published reads, so no registry definition).
- **One banner on `/account` (design decision; resolves §5.3).** `accountBannerOf` (`features/customer/account/
  account-banner.ts`, Vitest) picks at most one: data confirmation → survey due → earn checklist → win-back; each keeps
  its own rule, the rest wait for a later visit (a survey not rendered is not marked seen). The reorder bonus is not an
  `/account` banner.
- **Problem copy.** th/en titles for `promotions.bundle_unavailable` / `not_bundle`, `reviews.photo_limit` /
  `photo_window_closed`, `showcase.*`, `surveys.*`.
- **MSW.** Every P2 handler is plain `http.*` in the generated shapes (store: surveys, campaigns, data refresh,
  showcase, reviews with photos, add-bundle; admin: a small `staff()` wrapper for analytics, campaigns, estimate,
  agent performance, templates with ETag, results, showcase consents). Fixtures gained `bonusLots`, `activeCampaigns`,
  ledger `bonusReason` / `multipliers`, `nextDueAt`, the P&L memo inside `profitAndLoss()`, the export resource
  `promotion_agent_performance`.
- **Gates** (Linux VM, `$HOME/linuxbind` esbuild + rolldown, nothing installed into the repo): `gen:api --check` PASS;
  `tsc` on 123 + 42 files (every changed file, every reader of a changed schema or of the request layer, and their
  import graph; temporary config, removed) PASS; ESLint on the 70 changed TS/TSX files PASS; Prettier PASS; Vitest
  `src/lib/api` (incl. `registry.test.ts`, request mocks), `mocks`, `src/i18n`, `src/app`, `src/proxy.test.ts`,
  `features/customer/{account,loyalty,surveys,orders,deals,cart,checkout,repeat,liff,fulfilment}`,
  `features/admin/{marketing,finance,approvals,customers,console}`, `features/shared` — 94 files PASS. Fixed on the
  way: `dead-ends.test.ts` (P2's `AgentLinksTable` and `SurveysAdmin` empty states, now on the allow-list with their
  reason). Whole-repo `tsc`, Storybook build, `next build` and e2e: SKIPPED (the Mac).
