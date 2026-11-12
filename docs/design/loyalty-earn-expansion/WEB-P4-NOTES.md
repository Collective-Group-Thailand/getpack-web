# Web P4 notes — factory co-funding, programme budget, company one-offs, surfaces and rollout

Branch `feat/loyalty-p4-cofunding-controls` (getpack-web). Plan: `plans/P4-PLAN.md`. Contract: `API-CHANGES-P4.md`.
Decisions D-506…D-511. Design: `DESIGN-NOTES.md` (P4 section), `prototypes/p4-partner-cofunding.html`,
`p4-admin-rollout.html`, `p4-admin-budget.html`, `p4-customer-states.html`, `screenshots/P4/` (4 prototypes × 390 +
1440). Nothing pushed or merged. getpack-api builds P4 in parallel: every new P4 call goes through the contract-request
layer with MSW, as P3 did before its integration. **No e2e was written or run (D-511).**

## 1. Checklist (P4-PLAN item 14 and §6, web)

| Item | Where | State |
|---|---|---|
| Prototypes first + screenshots 390/1440 + DESIGN-NOTES P4 + self-review | `prototypes/p4-*.html`, `screenshots/P4/` | done (6fda055b) |
| Contract requests (store, admin, partner) + MSW + `docs/contract-requests.md` rows + readers for fields on published reads | `lib/api/requests/{store,admin,partner}-loyalty-p4.ts`, `mocks/{store,admin,partner}/loyalty-p4.ts`, `mocks/admin/cofunding-state.ts`, `features/shared/loyalty-p4/read.ts` | done (6d6b9985) |
| Surfaces reader + calm unavailable page + nav / entry points hidden (web and LIFF) | `customer/loyalty/surfaces.server.ts`, `customer/shell/FeatureUnavailable.tsx`, the pages in §2 | done (d2ec2eaa) |
| Checklist row "บริษัทของคุณรับแต้มนี้แล้ว" (`claimed_by_company`) | `EarnChecklist.tsx`, `earn-tasks.ts` | done (d2ec2eaa) |
| Admin: co-funding panel on a capacity deal (offers, propose, withdraw, contributions) + co-funders column | `admin/marketing/Cofunding.tsx`, `PromotionEditor.tsx`, `CapacityDeals.tsx` | done (43cd7095) |
| Admin: funding split in the `capacity_deal_publish` approval | `admin/approvals/ApprovalDetail.tsx` (`FundingSplitBlock`) | done (43cd7095) |
| Admin: programme budget page + 80 / 100 % shell banner + override request | `admin/marketing/ProgrammeBudget.tsx`, `AdminShell.tsx`, `/marketing/loyalty/budget` | done (43cd7095) |
| Admin: rollout (stage, gates, advance / rollback, allowlists, cohort lookup, history) | `admin/marketing/LoyaltyRollout.tsx`, `/marketing/loyalty/rollout` | done (43cd7095) |
| Admin: funding split in loyalty analytics (read-only) | `admin/marketing/FundingSplit.tsx` in `LoyaltyAnalytics.tsx` | done (43cd7095) |
| Admin: surface switches + P4 keys in `LoyaltySettings` (budget and rollout read-only with a link; `promotions.cofunding` editable by Finance) | `SurfaceSwitches.tsx`, `LoyaltySettings.tsx` | done (43cd7095) |
| Admin: statement line kind / total `cofunding`; `budget_exhausted` refusal copy | `finance/payables.tsx`, `PromotionDisplay.tsx`, `RewardCatalog.tsx`, `LoyaltyCampaigns.tsx` | done (43cd7095) |
| Partner: offers list + detail with accept / decline; sidebar item | `app/partner/(console)/cofunding/**`, `features/partner/cofunding/*`, `shell/sidebar.ts` | done (12bc738e) |
| Partner: co-funding line on the billing statement; statement-of-account kind | `billing/[statementId]/page.tsx`, `partnerBilling.account.kinds.cofunding` | done (12bc738e) |
| th + en copy, "แต้ม", no factory / budget / rollout word on customer surfaces | `messages/{th,en}/customer/{storefront,account}.json`, `admin/{marketing,approvals,finance}.json`, `partner/{billing,partner}.json` | done |
| Vitest | `shared/loyalty-p4/read.test.ts`, `customer/shell/FeatureUnavailable.test.tsx`, `customer/loyalty/surfaces.server.test.ts`, `EarnChecklist.test.tsx` (+1), `lib/api/loyalty-p4-mocks.test.ts`, `admin/marketing/LoyaltyP4.test.tsx`, `partner/cofunding/Cofunding.test.tsx` | done (36 new tests in 7 files) |
| Storybook | `Customer/Loyalty/P4 states`, `Admin/Marketing/Loyalty P4`, `Partner/Co-funding/Offer ticket` | done; not built here (§4) |
| Playwright e2e | — | **not written, not run** (D-511) |

## 2. Routes

| Route | P4 content |
|---|---|
| `/deals`, `/deals/[slug]` | `FeatureUnavailable` (noindex) when `deals` is closed for the visitor; `/deals?tab=points` also when `redeem` is closed |
| `/account/points/redeem` | `FeatureUnavailable` when `redeem` is closed |
| `/account/points` | "แลกแต้ม" only with `redeem`; checklist only with `checklist`; tier panel only with `tierPerks`; balance, cards and history always |
| `/account` | earn banner only with `checklist`; win-back banner (links to deals) only with `deals` |
| `/account/wallet` | the empty state's "ดูดีล" becomes "เลือกสินค้า" while deals are closed |
| `/` | the deals strip only with `deals` |
| `/liff/deals` | `FeatureUnavailable` (LIFF frame) unless `deals` ∧ `dealsLiff` |
| `/liff/points` | `FeatureUnavailable` when `pointsLiff` is closed; inside, redeem / deals buttons, win-back and checklist follow their flags |
| LIFF bottom bar | the points tab only with `pointsLiff` |
| `sitemap.xml` | `/deals` and the deal pages leave while `publicConfig.loyaltySurfaces.deals` is false |
| admin `/marketing/promotions/[id]` (capacity deal) | co-funding panel under the capacity-deal note |
| admin `/marketing/promotions?origin=capacity_deal` | "ผู้ร่วมสนับสนุน" column |
| admin `/approvals/[id]` (`capacity_deal_publish`) | "แหล่งเงินส่วนลด" block instead of the raw `funding` value |
| admin `/marketing/loyalty/budget` | programme budget (new) |
| admin `/marketing/loyalty/rollout` | rollout (new) |
| admin `/marketing/loyalty/analytics` | "แหล่งเงินส่วนลดดีล" table at the foot |
| admin `/marketing/loyalty` | "การเปิดใช้งานแต่ละส่วน" switches first; `promotions.cofunding`, `loyalty.programme_budget`, `loyalty.rollout` cards |
| admin shell (every page) | budget banner for `loyalty.read` from the first alert |
| admin `/finance/payables/statements/[id]` | line kind and total `cofunding` |
| partner `/cofunding`, `/cofunding/[offerId]` | offers list and detail (new) |
| partner `/billing/[statementId]` | `cofunding` lines after the deductions, total row "ส่วนร่วมส่วนลด (co-funding)" |
| partner `/payouts/statement` | account entry kind `cofunding` worded |

The storefront header, footer and mobile bottom nav have no `/deals` or redeem link today, so there was nothing to hide
there; `AccountNav` has no "แลกแต้ม" item (the redeem page is reached from `/account/points`). The PDP deal box reads the
deals list and shows nothing when the API answers `loyalty.feature_disabled`.

## 3. Contract requests to adopt when getpack-api publishes P4

`pnpm gen:api --adopt --tag vX.Y.Z`; `registry.test.ts` then names what to retire. Open P4 ids (all 2026-11-05,
`docs/contract-requests.md`, listed in `awaiting-triage.ts`):

- **store:** `store.loyalty.surfaces` (1 operation); `store.loyalty.p4-fields` (`publicConfig.loyaltySurfaces`, task status
  `claimed_by_company`).
- **admin:** `admin.cofunding-offers` (4), `admin.cofunding-contributions` (1), `admin.programme-budget` (2),
  `admin.loyalty-rollout` (4), `admin.loyalty-analytics.funding` (1); `admin.loyalty.p4-fields` (capacity-deal / promotion /
  approval `funding`, statement `cofunding`, the four settings).
- **partner:** `partner.cofunding-offers` (4); `partner.loyalty.p4-fields` (statement line kind and total, account entry
  kind `cofunding`).

On adoption:
- delete `store-loyalty-p4.ts`, `admin-loyalty-p4.ts`, `partner-loyalty-p4.ts` (keep the vocabularies as `Schemas` aliases);
- switch the screens to `browserApi` / `serverApi` / `adminBrowserApis().contract`;
- drop `features/shared/loyalty-p4/read.ts` for plain property reads, and the casts in `EarnChecklist` / `earn-tasks`
  (`claimed_by_company`), the statement pages (`cofunding` kind and total) and the mocks
  (`mocks/partner/billing.ts`, `mocks/admin/finance/payables.ts`, `mocks/admin/marketing.ts`, `mocks/admin/loyalty-p3.ts`);
- move the P4 problem titles from `marketing.p4Problems` / `partnerBilling.cofunding.problems` to
  `common/problems.json` and delete `features/shared/loyalty-p4/problems.ts` + `admin/marketing/p4-problems.ts`;
- `pnpm gen:rbac`, then drop `P4_GRANTS` / `P4_PERMISSIONS` from the mock personas and the two permission tests;
- add the two approval policies' names (already worded in `approvals.json`) to the fixture only if the API seed differs.

Assumptions and asks for getpack-api (recorded here, not decided by the web):

1. **Guests and the store guards.** The anonymous `store.loyalty.surfaces` view is closed until stage `all` (contract);
   the mock's store guards close a guest's deals / rewards only by the flag, not by the stage (a call without a cohort
   key). If the API's guard also closes guests before `all`, the web needs no change (the page reads the surfaces first).
2. **Rollout company search** uses the published `admin.companies.list?q=`; accounts without a company are added by their
   id (no user search endpoint in the contract for that).
3. **`If-Match` on withdraw** is sent as `W/"<rowVersion>"` from the list (the list carries `rowVersion`, no ETag per row).
4. **Budget month picker** offers the current and eleven previous Bangkok months; the override is offered for the
   current month only (the API also accepts next month).
5. **Advance / rollback body** is the full target (stage, percent, both allowlists) plus the reason; adding an allowlist
   id is sent as an advance and removing one as a rollback.
6. **`termsText`** is shown as the API composes it on every admin, partner and approval surface; the web composes no terms.
   The partner ticket's stub shows `sharePct` / `fixedAmount` formatted (the figure only).

## 4. Gate results (Linux VM, `$HOME/linuxbind` esbuild + rolldown, nothing installed into the repo)

| Gate | Result |
|---|---|
| `tsc --noEmit` (whole repo) | **SKIPPED** — > 170 s per call here (as P1–P3) |
| `tsc` on every changed TS/TSX file and its import graph (temporary config outside the repo's tracked files, removed; a planted error was reported) | **PASS** |
| ESLint on every changed TS/TSX file | **PASS** (0 problems) |
| Prettier `--write`/check on every changed TS/TSX/JSON | **PASS** |
| Vitest: `src/lib/api` (incl. `registry.test.ts`, `requests/mocks.test.ts`, `loyalty-p4-mocks.test.ts`), `src/i18n`, `mocks`, `src/ui/design-language.test.ts` — 35 files / 387 tests | **PASS** |
| Vitest: `features/admin/{marketing,approvals,finance,shell,console}`, `features/partner` | **PASS** |
| Vitest: `features/customer/{account,rewards,deals,loyalty,liff,shell,cart,checkout}`, `features/shared` — 35 files / 167 tests | **PASS** |
| Vitest: `features/customer` (all), `src/app`, `src/ui`, `src/proxy.test.ts` | see §7 |
| `gen:api --check` | **PASS** (contract 0.75.0; request document regenerated) |
| `tokens:check`, `contrast` (165 pairs × 3 themes) | **PASS** |
| i18n (keys used, th/en parity, ICU, customer wording "แต้ม", hard-coded strings, zone namespaces, problem copy) | **PASS** |
| Wording / confidentiality grep (`โรงงาน\|factory\|กำไร\|margin\|budget\|งบ\|rollout\|cohort\|capacity\|countdown\|นับถอยหลัง\|เงินสด\|cash.?out\|coming soon`) on the P4 customer files, their messages and `p4-customer-states.html` | **PASS** — hits are code identifiers, comments and CSS `margin` only |
| Storybook build, `next build`, Lighthouse, page-level visual compare | **SKIPPED** — need the Mac (Next SWC, Vite native bindings, a browser against `pnpm dev:mock`) |
| Prototype screenshots | **DONE** in the cloud container's headless Chrome (device_bash has no browser) |
| Playwright e2e | **NOT WRITTEN / NOT RUN** — D-511 |

## 5. Deviations and open issues

1. **P4 problem copy** lives in the zones' namespaces until adoption: `src/i18n/problems.test.ts` refuses a code the pinned
   contract does not have, so `loyalty.feature_disabled`, `loyalty.budget_exhausted`, `cofunding.*` and
   `settings.dedicated_editor` cannot enter `common/problems.json` yet (§3).
2. **Permissions** `loyalty.programme.manage` and `factory_cofunding.read|decide` are granted in the mock personas and
   accepted by the two permission tests from a P4 list until `pnpm gen:rbac` (§3). The partner sidebar's role lists name
   `cofunding` for the accountant and sales roles; it shows only where the permission is granted.
3. **`/liff/points` with `pointsLiff` off** shows the unavailable page (P4-PLAN §6.1); the web points page always keeps the
   balance and history.
4. **Tier panel** is hidden whole with `tierPerks` off (P4-PLAN §6.1 lists `TierPerks`); the tier stays in the summary card.
5. **Win-back banner** is hidden with `deals` off on `/account` and `/liff/points` (it links to the deals).
6. **Mock cohort** stands in for the API's hash: at `percent` every persona but `newcomer` is in; at `internal` / `uat`
   only `returning`, `companyadmin`, `companybuyer`. The mock seeds the rollout at `percent 10` (the screen's review case),
   so a guest sees the deals page closed in `pnpm dev:mock` until the rollout reaches `all` (advance on the rollout screen
   and approve as `finance_manager`).
7. **`claimed_by_company`** is seeded for the `companybuyer` persona (`tax_profile`, `brand_kit`).
8. **Statement of account** — the mock has no `cofunding` entry yet (the kind is worded); the billing statement mock nets
   F001's netted shares on its latest statement.
9. Stories that render `next/link` / `@/i18n/navigation` under Vite remain unverified (as P1–P3).

## 6. Commands for the owner (Mac)

```sh
cd getpack-web   # on feat/loyalty-p4-cofunding-controls
pnpm install
pnpm gen:api:check
pnpm typecheck && pnpm lint && pnpm test
pnpm tokens:check && pnpm contrast
pnpm storybook   # Customer/Loyalty/P4 states, Admin/Marketing/Loyalty P4, Partner/Co-funding/Offer ticket
pnpm build
pnpm dev:mock
#   http://localhost:3000/account/points                 (as companybuyer: two "บริษัทของคุณรับแต้มนี้แล้ว" rows)
#   http://localhost:3000/deals                          (signed in: open; as newcomer or a guest: unavailable)
#   http://localhost:3000/liff/deals, /liff/points
#   http://admin.localhost:3000/marketing/loyalty        (switches; turn "แลกแต้ม" off, then /account/points/redeem)
#   http://admin.localhost:3000/marketing/loyalty/budget
#   http://admin.localhost:3000/marketing/loyalty/rollout   (ขอเลื่อนขั้น as marketing, approve as finance_manager)
#   http://admin.localhost:3000/marketing/promotions?origin=capacity_deal   (then the draft: co-funding panel)
#   http://admin.localhost:3000/marketing/loyalty/analytics (แหล่งเงินส่วนลดดีล)
#   http://partner.localhost:3000/cofunding              (owner: accept / decline; accountant: read only)
#   http://partner.localhost:3000/billing                (latest statement: the co-funding line)
# Visual compare at 1440 and 390:
#   prototypes/p4-partner-cofunding.html vs /cofunding and /cofunding/<offer>
#   prototypes/p4-admin-rollout.html     vs /marketing/loyalty/rollout
#   prototypes/p4-admin-budget.html      vs /marketing/loyalty/budget (+ the shell banner)
#   prototypes/p4-customer-states.html   vs /deals (closed) and /account/points (claimed rows)
# No pnpm e2e for P4 (D-511).
# When getpack-api publishes P4:
pnpm gen:api --adopt --tag vX.Y.Z   # registry.test.ts lists the 17 P4 requests to retire
pnpm gen:rbac
```

## 7. Integration (2026-11-05, getpack-api `feat/loyalty-p4-cofunding-controls` b965da5e)

- **Commit message fix.** `6d6b9985`'s body line `MSW: …` parsed as a trailer; `git filter-branch --msg-filter` over
  `14c09bc3..HEAD` rewrote it to "MSW mocks — …" (trees, author and committer unchanged; the P4 commits are now
  `77c51462…002db317`). `git log --format=%(trailers) 14c09bc3..HEAD` is empty.
- **Contract.** `contract/openapi.json` is the API branch's document at b965da5e (1532 paths: 9eee3a52's 17 P4
  operations plus the integration's D-512 `x-required-permissions-any`), pinned unreleased in `contract.lock.json`
  (still labelled 0.75.0 / v0.75.0 so `verifyLock` passes, as P1.5–P3). `pnpm gen:api` regenerated `schema.d.ts`, the
  MSW examples/problems, `problem-codes.ts` and `docs/contract-requests.openapi.json`; `API-CHANGES-P4.md` here is the
  API's copy with its deviation notes. Re-adopt with `pnpm gen:api --adopt --tag vX.Y.Z` once the API tags a release.
- **Adopted (generated client).** All 17 P4 operations and the three `…p4-fields` requests left the registry
  (`store-`, `admin-`, `partner-loyalty-p4.ts` deleted), `awaiting-triage.ts` and the open table of
  `docs/contract-requests.md` (three "Resolved" rows). Screens call `serverApi` / `browserApi` /
  `adminBrowserApis().contract`; types are `Schemas` aliases in `features/shared/loyalty-p4/types.ts`.
  `features/shared/loyalty-p4/read.ts` (and its test) is gone: `loyaltySurfaces`, `claimed_by_company`, capacity-deal
  `funding` and the statement's `cofunding` kind / total are plain property reads. The one open-object read left is
  `approvalFundingOf` (approval payloads are untyped in the contract). The P4 mocks are `mockOperation` handlers
  (`mocks/route.ts`, typed by the generated contract, token / audience / `Idempotency-Key` checks as `mockRequest`).
  No contract request remains open for P4.
- **Problem copy.** `loyalty.feature_disabled` ("ส่วนนี้ยังไม่เปิดให้ใช้งาน", customer-safe), `loyalty.budget_exhausted` and
  the five `cofunding.*` codes moved to `common/problems.json` (th/en); `marketing.p4Problems`,
  `partnerBilling.cofunding.problems`, `shared/loyalty-p4/problems.ts` and `admin/marketing/p4-problems.ts` are gone.
  `useLoyaltyProblem` (shared) gives the problem title, the budget title for a `promotions.not_publishable` refused for
  `budget_exhausted`, else the API's detail. `settings.dedicated_editor` is not documented on any operation in the
  contract, so it has no copy (the API's detail shows) — an ask for getpack-api.
- **Permissions.** `RBAC_SOURCE=../getpack-api-p1/docs/rbac.md pnpm gen:rbac` (rbac.md at add6b181) brought
  `loyalty.programme.manage` and `factory_cofunding.read|decide`; `P4_GRANTS` / `P4_PERMISSIONS` left the personas and
  both permission tests. The accountant and sales sidebars now show "ร่วมสนับสนุนส่วนลด" (`nav.test.ts` follows).
- **API-CHANGES-P4 deviations followed.** (1) `funding.factoryShareSoFar` (panel, approval block, fixtures). (2) D-512:
  the contributions list takes `promotions.read` **or** `payables.read`; the mock follows. (3) `CofundingReverseReason`
  `no_payable` worded ("ไม่มียอดค้างจ่ายโรงงานให้หัก (getpack รับเอง)") and seeded on F001's fixed offer. (4)
  `admin.loyalty.ledger` items are `AdminPointsEntryDto`: the customer's points tab names a `companyClaim`
  ("รับในนามบริษัท …"); the mock answers `companyClaim: null`. (5) `EntryMultipliersDto.budgetCapped`: the checkout mock
  sets it from the budget state; no customer surface words it (no budget word to customers, D-510). (6) The 202s
  (`requestOverride`, `advance`) invalidate the budget / rollout reads, which is the poll. (7) Withdraw reason ≥ 10
  (≤ 800), decline 5–500 — the forms already ask that. (8) Notification audiences: nothing to change in the web. (9)
  Unseeded settings mean "as before P4" — the reader's fallback is unchanged. (10) Budget guard scope: the refusal copy
  covers `activate` and visibility updates. (11) Spend simplification: shown as the API sends it. (12) Claim races: no
  web effect. (13) `store.loyalty.surfaces` caching: `serverApi` per request, cached per render. (14) Funding analytics
  counts read as published. Also: `RolloutHistoryDto.reason` is a string, `pendingAdvance` / `pendingOverride`
  `requestedBy` nullable ("ผู้ใช้ที่ไม่อยู่ในระบบแล้ว"), `CohortDto`.
- **D-512 (Finance reads co-funding).** Decided in getpack-api (head of team); the row is identical in both repos'
  `docs/decisions.md`.
- **Mock rollout.** `loyalty.rollout` now starts at stage `all` (percent 0, history up to "all"), so `pnpm dev:mock`
  shows every surface to every persona and to guests. The 10 % case stays: `resetLoyaltyP4AdminMock({ rollout:
  "percent" })` (used by `loyalty-p4-mocks.test.ts`) and the `Admin/Marketing/Loyalty P4` stories' 10 % fixtures. §5
  item 6 is superseded.
- **Budget screen polish** (prototype and `/marketing/loyalty/budget`). The side card's "ใช้จริง" is "งบที่ใช้เดือนนี้"
  (en "Effective for the month"): monthly budget → this month raised → effective. With a request already pending the
  override button is the neutral `soft` variant, disabled ("มีคำขอรออยู่แล้ว"), never the filled primary; the prototype's
  `.btn:disabled` matches. `screenshots/P4/p4-admin-budget-{390,1440}.png` re-shot (headless Chrome in the cloud
  container, same frames as before).
- **Also fixed.** `LoyaltyAnalytics.test.tsx` answered the funding split's read with the analytics fixture (the section
  crashed); it now answers each operation with its own shape.
- **Gates** (Linux VM, `$HOME/linuxbind` esbuild + rolldown, nothing installed into the repo): `gen:api --check` PASS;
  `tsc` over every file changed since `14c09bc3` and over every file using a changed schema (temporary configs,
  removed) PASS; ESLint on the changed TS/TSX PASS; Prettier PASS; Vitest `src/lib/api` (incl. `registry.test.ts`,
  `loyalty-p4-mocks.test.ts` with three new integration tests), `src/i18n` (problem copy, parity, zones), `mocks`,
  `features/admin/{marketing,approvals,finance,console,customers,shell}`, `features/partner`, `features/shared`,
  `features/customer/{account,rewards,deals,loyalty,liff,shell,cart,checkout}`, `src/app`, `src/proxy.test.ts`,
  `src/ui/design-language.test.ts` PASS. Confidentiality: the only P4 code a store operation documents is
  `loyalty.feature_disabled`, worded without a budget, rollout or factory word. Storybook build, `next build` and e2e:
  SKIPPED (the Mac; no e2e for P4, D-511).

