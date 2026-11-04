# Web P3 notes — reward catalogue, tiers and perks, campaigns, credit uplift, capacity deals

Branch `feat/loyalty-p3-catalogue-tiers` (getpack-web). Plan: `plans/P3-PLAN.md`. Contract: `API-CHANGES-P3.md`.
Design: `DESIGN-NOTES.md` (P3 section), `prototypes/p3-redeem.html`, `p3-deals-points.html`, `p3-tier-perks.html`,
`screenshots/P3/` (3 prototypes × 390 + 1440). Nothing pushed or merged. getpack-api builds P3 in parallel: every new
P3 call goes through the contract-request layer with MSW, as P2 did before its integration. **No e2e was written or
run (owner, D-503).**

## 1. Checklist (P3-PLAN item 12 and §6, web)

| Item | Where | State |
|---|---|---|
| Prototypes first + screenshots 390/1440 + DESIGN-NOTES P3 + self-review | `prototypes/p3-*.html`, `screenshots/P3/` | done (f696d56a, d7e62254) |
| Contract requests (store + admin) + MSW + `docs/contract-requests.md` rows + readers for fields on published reads | `lib/api/requests/{store,admin}-loyalty-p3.ts`, `mocks/{store,admin}/loyalty-p3.ts`, `features/shared/loyalty-p3/read.ts` | done (6e19bd27) |
| `/account/points/redeem` — reward tickets, confirm sheet, success with the coupon, คูปองของฉัน + cancel | `features/customer/rewards/*`, `app/[locale]/(storefront)/account/points/redeem` | done (32ae6ad7) |
| `/deals?tab=points` — reward tickets, guest sign-in card | `RewardsTab.tsx`, `deals/page.tsx` | done (a65eb941) |
| Tier panel with Platinum, multipliers in force, perks list, next tier's perks; "แลกแต้ม" on `/account/points` and `/liff/points` | `TierPerks.tsx`, `account/points/page.tsx`, `liff/points/page.tsx` | done (7a605eb9, e7508c4e) |
| Admin reward catalogue editor + redemptions with staff cancel | `RewardCatalog.tsx`, `RewardItemForm.tsx`, `reward-item.ts`, `/marketing/loyalty/rewards{,/new,/[itemId]}` | done (5331cdc2) |
| Admin loyalty campaigns — create / edit before start / cancel (`admin_rule`) | `LoyaltyCampaigns.tsx`, `loyalty-campaign.ts`, `/marketing/loyalty/campaigns` | done (a4a06c8a) |
| Capacity-deal drafts + approval (maker-checker in the approvals inbox) | `CapacityDeals.tsx`, `/marketing/promotions?origin=capacity_deal`, `approvals.json` policy name | done (413e4944) |
| Benefit kinds v2 in the promotion editor (+ read-only system / capacity promotions) | `benefit-v2.ts`, `PromotionEditor.tsx` | done (008a31a3) |
| Finance credit-limit uplift review + override (mode, full request) | `finance/CreditUpliftList.tsx`, `companies/CreditUplift.tsx`, `CompanyWorkspace.tsx`, `/finance/credit-uplifts` | done (f9dcbce0) |
| th + en copy with "แต้ม", no cash-out / factory / countdown words | `messages/{th,en}/customer/{account,deals,liff}.json`, `admin/{marketing,companies,finance,approvals}.json` | done |
| Vitest | `rewards/{Rewards.test.tsx,model.test.ts}`, `loyalty-p3/read.test.ts`, `lib/api/rewards-mocks.test.ts`, `admin/marketing/LoyaltyP3.test.tsx` | done (46 new tests in 5 files) |
| Storybook | `Customer/Loyalty/Rewards` (card, grid, rows, confirm, success, my coupons, tier Platinum / Gold, points tab signed in / guest), `Admin/Marketing/Loyalty P3` (new / active reward, campaign form, uplift capped / frozen) | done; not built here (§4) |
| Playwright e2e | — | **not written, not run** (owner instruction for P3, D-503) |
| Admin loyalty settings fields for P3 keys (`loyalty.tier_perks`, `loyalty.rewards`, `promotions.capacity_deal`, `b2b.credit_tier_uplift`) | — | **not done** — not in the P3 screen list (§6); the keys are edited through the generic settings screen until then (open issue 4) |

## 2. Routes

| Route | P3 content |
|---|---|
| `/account/points/redeem` | balance strip (available, nearest expiry, open coupons) · rewards in two groups "ส่วนลดค่าสินค้า" / "สิทธิพิเศษ" (tickets ≥ 768 px, rows below) · confirm sheet (dialog 440 px / bottom sheet) · success with code, copy, "ใช้กับตะกร้า" · คูปองของฉัน by status with "ยกเลิกการแลก" inside the window · how it works. `#<code>` scrolls to that reward and opens its sheet when it can be redeemed |
| `/account/points` | "แลกแต้ม" is the page's primary; the tier panel replaces the progress line (Platinum, multipliers in force with the ×3 note, perks, next tier's perks); the tier summary card reads Platinum |
| `/liff/points` | "แลกแต้ม" (outline) to the redeem page; the tier card reads Platinum |
| `/deals?tab=points` | the reward catalogue as tickets; signed in: balance line, "แลก" → `/account/points/redeem#<code>`; guest: one sign-in card, no action on the tickets; the type filter is not offered on this tab |
| admin `/marketing/loyalty/rewards` | catalogue table, activate / pause; `?tab=redemptions` with staff cancel |
| admin `/marketing/loyalty/rewards/new`, `/[itemId]` | the item editor (ticket preview, lifecycle in the aside) |
| admin `/marketing/loyalty/campaigns` | every points campaign; admin rules: create, edit before start, cancel |
| admin `/marketing/promotions?origin=capacity_deal` | capacity-deal drafts with approval state and link |
| admin `/marketing/promotions/[id]` | benefit v2 kinds; system promotions read-only; a capacity deal's note (week, free share, approval) with benefit and conditions read-only |
| admin `/finance/credit-uplifts` | uplift versions, capped filter, "ขออนุมัติวงเงินเต็ม" → `/companies/{id}?tab=credit&uplift=request` |
| admin `/companies/[id]?tab=credit` | uplift panel (tier, base, target, in force, mode with reason, full request prefilled into the existing form) and an origin badge on versions |

## 3. Contract requests to adopt when getpack-api publishes P3

`pnpm gen:api --adopt --tag vX.Y.Z`; `registry.test.ts` then names what to retire. Open P3 ids (all 2026-11-04,
`docs/contract-requests.md`, listed in `awaiting-triage.ts`):

- **store:** `store.rewards` (list, redeem, my coupons, cancel — 4 operations); `store.loyalty.p3-fields` (Platinum,
  `perks`, `nextTierPerks`, `activeMultipliers`, `maxCombinedMultiplier`, `anniversaryMonth`, `rewardCoupons` on the
  published `store.loyalty.get`).
- **admin:** `admin.reward-catalog` (5), `admin.reward-redemptions` (2), `admin.loyalty.campaign-rules` (4),
  `admin.credit-uplift` (2), `admin.capacity-deals` (1); `admin.loyalty.p3-fields` (benefit v2 / `benefitSchemaVersion` /
  `origin` / `capacityDeal` on promotions and `?origin=`, campaign list fields and kinds, credit version `origin` …
  and `uplift`).

On adoption: delete `store-loyalty-p3.ts` / `admin-loyalty-p3.ts` (keep the vocabularies as `Schemas` aliases), switch
the screens to `browserApi` / `serverApi`, drop `features/shared/loyalty-p3/read.ts` for plain property reads, remove
the casts in `PromotionEditor` (`benefitBody` v2, `withSchemaVersion`), `mocks/store/orders.ts` (tier) and
`mocks/admin/loyalty-p2.ts` (admin rule rows), and move the MSW handlers to plain `http.*` in the generated shapes.

Assumptions and asks for getpack-api (recorded here, not decided by the web):

1. **The `/deals` points tab reads `store.rewards.list`,** not `store.promotions.listPublic?tab=points`'s reward cards:
   the rewards read carries `missingPoints` and `nextAvailableAt`, which the cards need for the blocked reason. The tab
   is offered from `listPublic`'s `counts.points` as before. If the API prefers one read, `listPublic` may keep its
   reward cards; the web does not depend on them.
2. **`cancelWindowDays` on `store.rewards.list`** (added to the request as optional): the confirm sheet and "how it works"
   state the window ("ยกเลิกได้ภายใน 7 วัน"); a setting is never written into the UI, so without the field the sentence
   has no number.
3. **Balance after, before the redeem.** The confirm sheet says "ใช้ 60 แต้ม · คงเหลือ 1,190 แต้ม" from the list's
   `balance` minus the item's `costPoints` (two integers the API sent; never below 0). The success state shows the
   API's own `balanceAfter`. A `balanceAfter` per item on the list would remove the subtraction.
4. **Coupon expiry before the redeem** is worded in days ("คูปองใช้ได้ 90 วันนับจากวันที่แลก"): the web adds no days to a
   date; the coupon's date comes from the redeem answer.
5. **`store.rewards.listMine`** is assumed to answer the standard page envelope `{ data, meta }` (api-conventions §3);
   the web reads one page of 100.
6. **Redeem idempotency:** one key per opening of the confirm sheet; `expectedCostPoints` is always sent (409
   `rewards.cost_changed` is worded).
7. **Admin campaign status `scheduled`:** the published list has `active | ended | cancelled`; the web shows "รอเริ่ม"
   for an active campaign whose `startsAt` is ahead and offers edit only then (the API refuses after the start).
8. **Capacity-deal approval in the inbox:** the web names the policy (`capacity_deal_publish`) and links each draft to
   `/approvals/{id}`; approve / reject are the inbox's existing actions. The mock exports `decideCapacityDeal` but the
   approvals mock does not yet hold the capacity request (open issue 3).
9. **Credit uplift full request:** "ขออนุมัติวงเงินเต็ม" opens the published `admin.companyCredit.requestLimit` form
   prefilled with `aboveCapTarget` and the reason "ปรับวงเงินตามระดับสมาชิก (tier_uplift)"; the basis is the
   company's eligibility reason. No new endpoint.

## 4. Gate results (Linux VM, `$HOME/linuxbind` esbuild + rolldown, nothing installed into the repo)

| Gate | Result |
|---|---|
| `tsc --noEmit` (whole repo) | **SKIPPED** — > 170 s per call here (as P1–P2) |
| `tsc` on every changed TS/TSX file and its import graph (temporary config, removed; a planted error was reported) | **PASS** |
| ESLint on every changed TS/TSX file + `.storybook/main.ts` | **PASS** |
| Prettier `--write`/check on every changed TS/TSX/JSON | **PASS** |
| Vitest: `src/i18n`, `src/lib/api` (registry, request mocks, rewards mocks), `mocks`, `design-language.test.ts` — 34 files / 375 tests | **PASS** |
| Vitest: `features/customer/{rewards,account,deals,loyalty,liff,cart,checkout,shell}`, `features/shared` — 33 files / 165 tests | **PASS** except the pre-existing `customer/shell/dead-ends.test.ts` finding (open issue 5; fails identically on `4f824e1b`, checked in a temporary worktree) |
| Vitest: `features/admin/{marketing,finance,companies,approvals,console}` — 14 files / 65 tests | **PASS** |
| Vitest: `src/app`, `src/proxy.test.ts`, `src/ui/components` — 20 files / 147 tests | **PASS** (`src/app/server-imports.test.ts` timed out once under load beside the others and passes alone, as noted in P1.5) |
| `gen:api --check` | **PASS** (contract 0.75.0; request document regenerated) |
| `tokens:check`, `contrast` (165 pairs × 3 themes) | **PASS** |
| i18n (keys used, th/en parity, ICU, customer wording "แต้ม", hard-coded strings, zone namespaces, problem copy) | **PASS** |
| Wording grep (`โรงงาน\|factory\|กำไร\|margin\|coming soon\|ทันที\|countdown\|นับถอยหลัง\|เงินสด\|cash.?out\|ถอน\|โอนแต้ม`) on the P3 customer / public / LIFF files, their messages and the P3 prototypes | **PASS** — hits are code comments ("never a countdown", "no cash-out") and the existing payment line "QR หรือโอนเงิน" (a payment method, not a points transfer); "ส่วนลดเงินสด" from the plan was renamed "ส่วนลดค่าสินค้า" |
| Storybook build, `next build`, Lighthouse, page-level visual compare | **SKIPPED** — need the Mac (Next SWC, Vite native bindings, a browser against `pnpm dev:mock`) |
| Playwright e2e | **NOT WRITTEN / NOT RUN** — owner instruction (D-503) |

## 5. Deviations and open issues

1. **Points tab source** — `store.rewards.list` instead of `listPublic`'s reward cards (§3.1).
2. **Confirm-sheet subtraction** — the one place the web computes a figure (two API integers) (§3.3).
3. **Approvals mock** does not hold a `capacity_deal_publish` request: the link from a draft opens the inbox page for
   an id the mock does not know. Wire it into `mocks/admin/platform.ts` (`openApproval`, `onApprovalDecided` →
   `decideCapacityDeal`) when the API's shape is known.
4. **P3 setting keys** (`loyalty.tier_perks`, `loyalty.rewards`, `loyalty.order_multipliers` v+1, `promotions.free_rush`,
   `promotions.capacity_deal`, `b2b.credit_tier_uplift`) are not in `LoyaltySettings.tsx` / the Finance settings
   screen — they were not in the §6 screen list; the generic settings screen edits them meanwhile.
5. **Pre-existing failures, not touched:** `src/features/customer/shell/dead-ends.test.ts` lists
   `app/[locale]/liff/deals/page.tsx`, `customer/deals/LiffDeals.tsx` and `shared/errors/PageError.tsx` as empty
   states without an action — the same files and lines as before this branch.
6. **Tier names**: the customer zone says ซิลเวอร์ · โกลด์ · แพลทินัม (its existing tier copy); admin says Silver · Gold
   · Platinum (its existing copy). The prototypes follow the customer words.
7. **No eyebrow labels**: the prototype's "ระดับสมาชิก" eyebrow was removed (design-language gate); the tier name is the
   heading.
8. Stories that render `@/i18n/navigation` `Link` under Vite remain unverified (as P1–P2).

## 6. Commands for the owner (Mac)

```sh
cd getpack-web   # on feat/loyalty-p3-catalogue-tiers
pnpm install
pnpm gen:api:check
pnpm typecheck && pnpm lint && pnpm test
pnpm tokens:check && pnpm contrast
pnpm storybook   # Customer/Loyalty/Rewards, Admin/Marketing/Loyalty P3
pnpm build
pnpm dev:mock
#   http://localhost:3000/account/points                 (tier panel, แลกแต้ม)
#   http://localhost:3000/account/points/redeem          (redeem 60 → คงเหลือ; cancel in คูปองของฉัน)
#   http://localhost:3000/account/points/redeem#free_shipping   (opens the confirm sheet)
#   http://localhost:3000/deals?tab=points               (signed in, then signed out)
#   http://localhost:3000/liff/points
#   http://admin.localhost:3000/marketing/loyalty/rewards        (+ ?tab=redemptions, /new, a row)
#   http://admin.localhost:3000/marketing/loyalty/campaigns
#   http://admin.localhost:3000/marketing/promotions?origin=capacity_deal   (then open the draft)
#   http://admin.localhost:3000/marketing/promotions/new           (benefit: ผลิตด่วนฟรี, อัปเกรดงานพิมพ์ฟรี …)
#   http://admin.localhost:3000/finance/credit-uplifts             (→ ขออนุมัติวงเงินเต็ม)
# Visual compare at 1440 and 390 (light; then 390 dark):
#   prototypes/p3-redeem.html        vs /account/points/redeem (+ the confirm and success sheets)
#   prototypes/p3-deals-points.html  vs /deals?tab=points
#   prototypes/p3-tier-perks.html    vs /account/points
# No pnpm e2e for P3 (D-503).
# When getpack-api publishes P3:
pnpm gen:api --adopt --tag vX.Y.Z   # registry.test.ts lists the 18 P3 requests to retire
```

## 7. Integration (2026-11-05, getpack-api `feat/loyalty-p3-catalogue-tiers` 2f0248f9)

- **Contract.** `contract/openapi.json` is the API branch's document at 2f0248f9 (1516 paths: P3's 18 operations from
  5ea8927f plus the integration's `store.rewards.preview`), pinned unreleased in `contract.lock.json` (still labelled
  0.75.0 / v0.75.0 so `verifyLock` passes, as P1.5 / P2). `pnpm gen:api` regenerated `schema.d.ts`, the MSW
  examples/problems, `problem-codes.ts` and `docs/contract-requests.openapi.json`; `API-CHANGES-P3.md` here is the API's
  copy with its deviation notes. Re-adopt with `pnpm gen:api --adopt --tag vX.Y.Z` once the API tags a release.
- **Adopted (generated client).** All 18 P3 operations and both `…p3-fields` requests left the registry
  (`store-loyalty-p3.ts` / `admin-loyalty-p3.ts` deleted), `awaiting-triage.ts` and the open table of
  `docs/contract-requests.md` (two "Resolved" rows). Screens call `browserApi` / `serverApi` /
  `adminBrowserApis().contract`; types are `Schemas` aliases in `features/shared/loyalty-p3/types.ts`. The readers of
  `features/shared/loyalty-p3/read.ts` (and its test) are gone: `store.loyalty.get`, `PromotionDto`, credit versions,
  `admin.companyCredit.get` and the campaign list are read as published. The one open-object read left is
  `benefitV2FieldsOf` (`daysSaved` / `addonCode` are not declared on `PromotionBenefitDto`). No contract request
  remains open for P3.
- **API-CHANGES-P3 deviations followed.** (1) `notYet` `rush_unavailable` — the web shows the API's `reasonText`, so no
  code change. (2–4) Capacity deals are drafted `status: draft` with `approval: null`; Marketing asks with
  `admin.promotions.action` **`request_publish`** ("ขออนุมัติเผยแพร่" in the editor's capacity-deal note; offered on a
  draft whose request is not pending or approved); the approval activates the draft, a rejection ends it; the mock
  refuses `activate` before approval (`approval_required`). (5) Admin lists are `{ data, meta }`
  (`rewardCatalog.list`, `rewardRedemptions.list`, `creditUplifts.list`, `capacityDeals.list`; `meta.provider` is not
  in the contract and is not read), as is `store.rewards.listMine`. (6) Deal cards carry `kind` / `benefitText` /
  `reward` / `href` (fixtures and the editor preview). (7) Early pay is an `earn_bonus` with `bonusReason: early_pay`
  ("โบนัสชำระก่อนกำหนด"); `EntryMultipliersDto` gains `campaign` / `anniversary` / `earlyPay`, named in the points
  breakdown when not ×1; the checkout preview's `earlyPayBonus` is null in the mock. (10) `nextTierPerks` is a list of
  perk codes — the tier panel reads them as perks with nothing granted. Also: `AdminRewardItemDto` (localized names
  with optional `en`, `description` always an object, `value` open, `valueTextTh`, no `openCoupons` — the column is
  gone), `AdminRedemptionDto` (`customer` = `UserRefDto` without a code, `coupon` object, `bahtValue`), campaign status
  `active | ended | cancelled` ("รอเริ่ม" stays the web's reading of a future `startsAt`), campaign cancel reason
  optional (the form still asks ≥ 10 characters), `setUpliftMode` answers the whole `AdminCompanyCreditDto`,
  `CreditUpliftDto.previousLimit` / `companySpend12m` nullable, `ConversationDto.prioritySupport`,
  `ApprovalStatus` `expired`.
- **No points math in the web (§3.3 resolved).** The confirm sheet reads `store.rewards.preview` when it opens
  (`{ costPoints, balanceAfter, eligible, reason }`, added to getpack-api at this integration with a unit test,
  regenerated contract and `contract:lint`): "คงเหลือ" is the API's `balanceAfter`; until the preview answers (or if
  it fails) the sentence states the cost alone; a preview that is not eligible words the reason with the redeem's own
  problem copy and disables the confirm. `balanceAfter()` left `model.ts`. `expectedCostPoints` is the preview's cost.
- **`cancelWindowDays` (§3.2 resolved).** Every `RewardItemDto` carries it (`loyalty.rewards`); the sheet and "how it
  works" use the item's / the first item's value.
- **D-505 (coupon return on order cancel).** Decided in getpack-api (an order cancelled before production gives its
  catalogue / perk coupon back, same expiry; past its end the redemption is reversed). No shape change: "คูปองของฉัน"
  shows it under "ยังไม่ใช้" again. D-504 and D-505 are copied verbatim into `docs/decisions.md` (D-497…D-505 identical
  in both repos).
- **Settings (open issue 4 resolved).** `LoyaltySettings` now lists `loyalty.rewards`, `loyalty.tier_perks`,
  `loyalty.order_multipliers`, `promotions.free_rush`, `promotions.capacity_deal` and `b2b.credit_tier_uplift`. Nested
  values are edited leaf by leaf (labels from the segments, "แพลทินัม · คูปองรายไตรมาส · 1 · จำนวน"; array lengths and
  word fields such as `spendBasis` / `best` fixed; booleans as เปิด / ปิด). Each card shows only for its owner role's
  change button (D-063), as before; the settings mock holds the six keys with the API seed's values.
- **Approvals mock (open issue 3 resolved).** `approval-policies.json` has `capacity_deal_publish` (Marketing, one
  step); the seeded capacity draft's request is opened by the Marketing persona at start-up, `request_publish` opens a
  new one, and `onApprovalDecided` → `decideCapacityDeal` activates or ends the draft.
- **`dead-ends.test.ts` (open issue 5 resolved).** The LIFF deals empty states were real dead ends from P1.5 / P2:
  "ไม่มีดีล" now offers "ดูสินค้าและราคา", and "คูปองของฉัน" / "สำหรับคุณ" empty offer "ดูดีลทั้งหมด". `PageError`
  (shared, 2026-10-30) is drawn only by partner console pages — pre-existing and outside the customer zone — and is on
  the allow-list with that reason.
- **Problem copy.** th/en titles for `rewards.*` (11 codes), `loyalty.campaign_started`,
  `companies.uplift_not_eligible`.
- **Gates** (Linux VM, `$HOME/linuxbind` esbuild + rolldown, nothing installed into the repo): `gen:api --check` PASS;
  `tsc` over `src/features/**`, `src/lib/**`, `src/app/**`, `src/ui/**`, `src/i18n/**`, `mocks/**` in five temporary
  configs (removed) PASS; ESLint on the 50 changed TS/TSX files PASS; Prettier PASS; Vitest `src/lib/api` (incl.
  `registry.test.ts`, `rewards-mocks.test.ts` with the preview), `src/i18n`, `mocks`, `src/ui/design-language`,
  `features/customer/{rewards,account,deals,loyalty,liff,shell,cart,checkout,orders,repeat,surveys}`,
  `features/shared`, `features/admin/{marketing,finance,companies,approvals,console,customers,inbox}`, `src/app`,
  `src/proxy.test.ts` — 90 files / 681 tests PASS. Storybook build, `next build` and e2e: SKIPPED (the Mac; no e2e for
  P3, D-503).
