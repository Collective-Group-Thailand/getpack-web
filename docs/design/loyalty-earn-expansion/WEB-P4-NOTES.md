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
