# Update 2026-09-29 — gap analysis (packio-web)

> Session 0 of every U-F session (`docs/prompts/U1-update-2026-09-29.md`). One row per requirement → `met | partial | missing`, with evidence and the planned change. `met` rows are not touched. Each session appends its own section.

## U-F2 — Art direction tokens (D-180) — 2026-09-29

Source of truth: `docs/prompts/design-system.md` §Art direction. Evidence is from `main` at `94aa968`.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1.1 | Palette values for light and dark per §Art direction | missing | `src/ui/tokens/primitives.ts:59-71` — cool neutral (h 255) and the BoxStudio teal (h 183); `src/ui/tokens/semantic.ts:73-103` — bg white, fg neutral-900 | Art primitives authored as the spec's hex values; semantic slots remapped (the key set stays, so components are untouched) |
| 1.2 | High-contrast theme follows the new palette | partial | `semantic.ts:140-168` exists, with the old hues | Rebuilt on the warm ink and dark teal ramps; the black/white structure stays |
| 1.3 | Contrast gate: every semantic text/UI pair passes WCAG 2.2 AA in all three themes | partial | `scripts/check-contrast.ts:31-63` + `src/ui/tokens/contrast.test.ts` run in `pnpm test`; no pairs for text on `bg-subtle`, which becomes the paper band, and none for a promotions tone | Pairs added: muted and primary on `bg-subtle`, the accent tone, kraft decorative ranges |
| 1.4 | A failing proposed value is adjusted minimally and recorded | missing | Pre-check of the proposed values: dark `primary-700` `#0D7A66` gives 3.26:1 under the dark button label and 3.49:1 as hovered link text on `bg`. All other proposed pairs pass; the tightest is light primary on paper-100 at 4.52:1 | Dark `primary-hover` moved to the nearest teal that passes both; ratios recorded in PROGRESS |
| 1.5 | Amber only for promotions | missing | No promotions token; `warning` is the amber-400 fill (`semantic.ts:98`) | New `accent` tone (`accent`, `-fg`, `-subtle`, `-subtle-fg`); `warning` becomes the spec's `#B45309` with a white label (5.02:1), so a warning no longer looks like a promotion |
| 1.6 | Kraft tones are decoration only, never text | missing | No kraft tokens | Semantic `kraft` / `kraft-strong`, gated as decorative ranges, not text pairs |
| 2.1 | Anuphan display, Noto Sans Thai UI, JetBrains Mono codes | met | `src/ui/fonts/index.ts:25-76`, `src/ui/tokens/scale.ts:80-84`, `src/ui/styles/base.css:39-48` | — |
| 2.2 | Tabular figures for prices and quantities | met | `PriceSummary.tsx:41,55,143-153`, `DataTable.tsx:246`, `QuoteDock.tsx:68-104`, `ProductCard.tsx:88`, `base.css:55-61` | — |
| 2.3 | Thai line-height ≥ 1.6 | met | `scale.ts:61-66`, `base.css:35` | — |
| 2.4 | h1 `clamp(2rem, 5vw, 3.25rem)` | missing | No token; the storefront hero uses `text-4xl md:text-5xl` (`src/app/[locale]/(storefront)/page.tsx:60`) | `--text-display` token, applied to the storefront hero h1 (U-F3 owns the rest of the hero) |
| 2.5 | Radius 12 px controls, 16 px cards/media, pill CTA on the storefront only | partial | Card is already 16 px (`Card.tsx:5`); Button and Input are 8 px (`Button.tsx:17`, `Input.tsx:11`); Dialog is 24 px; no zone marker on `<html>` | Semantic radii `control` (12), `card` (16), `cta` (= control; pill under `[data-zone="customer"]`); `data-zone` stamped by the three root layouts |
| 2.6 | Two elevation levels only | missing | `scale.ts:25-31` has four; 25 usages in `src` (sm 6, md 2, lg 13, xl 4) | `SHADOW = { none, card, overlay }` with the spec values; sm/md → card, lg/xl → overlay |
| 2.7 | Motion 150–200 ms ease-out for hovers, 250 ms for sheets | partial | `scale.ts:33-43` — 120/200/320 ms; literal `duration-200` / `duration-300` in three places | fast 150, base 200, slow 250, standard easing → ease-out; the literals move to tokens |
| 2.8 | `prefers-reduced-motion` respected | met | `base.css:167-176` | — |
| 2.9 | Carousels never auto-advance faster than 6 s, pause on hover/focus | met (n/a) | No auto-advancing carousel exists (`ImageGallery.tsx` has no timer) | — |
| 2.10 | Optional flat SVG section divider, `aria-hidden` | missing | — | `SectionDivider` in `src/ui` with a story; placing it on pages is U-F3 |
| 3 | Token-usage rules: teal = actions, amber = promotions, kraft never text (lint where feasible) | missing | ESLint has no colour rule; raw primitive palette utilities have 0 uses today | Lint: kraft text utilities banned everywhere; `accent` / `kraft` utilities only inside `src/ui`; raw primitive palette utilities banned outside `src/ui`. "Teal = actions only" cannot be linted and is documented in Storybook |
| 4 | Storybook docs and visual snapshots for all zones; admin keeps its density | partial | `src/ui/docs/Tokens.stories.tsx` shows the old scale; 17 darwin baselines in `e2e/__screenshots__/darwin`, admin/designer only — no customer or partner shots | Tokens docs gain an art-direction section; customer and partner stories join `e2e/visual.spec.ts`; baselines regenerated for review |
| 5 | axe clean on all shells | met (verified after the change) | `e2e/a11y.spec.ts`, `e2e/shells.spec.ts` and every per-screen axe case pass (PROGRESS §U-F2 Verification) | — |

**Side effect found.** `src/features/designer/canvas-colors.ts:25-46` reads `PRINT` and `PALETTES`. Print marks (cut, fold, safe, bleed) reach the print PDF, so they are frozen to their current values and do not move with a UI rebrand. The designer's artwork defaults (`text`, `shapeFill`, `shapeStroke`) are frozen for the same reason. The designer chrome (`selection`, `panelLabel`) follows the new palette.

## U-F0.1 — Adopt & reconcile the tagged contract — 2026-09-29

Sources: `docs/prompts/U1-update-2026-09-29.md` §U-F0.1; packio-api tag `v0.2.0` (`6b12ccd`, contract sha256 `90cb8752…`) and its `docs/contract-requests-triage.md` (133 ids, triaged against packio-web `9cbd99a`). Evidence is from `main` at `81cce53`.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1.1 | `pnpm gen:api --adopt` against the **tagged** release | partial | `scripts/gen-api.ts` `adopt()` copies `localSource` — packio-api's working tree, which is untagged `HEAD` with U-B6 corrugate work (+331 contract lines) on top of `v0.2.0` | `--adopt --tag vX.Y.Z` reads the contract at the tag (`git show <tag>:contract/openapi.json` in the packio-api checkout, or a downloaded release asset through `API_CONTRACT_SOURCE`) and refuses when the tag is missing or `info.version` is not the tag's version; adopt `v0.2.0` |
| 1.2 | `contract.lock.json` `source` points at the release asset (no sha256-only pin) | partial | Lock pins `0.1.0` by sha256 with `source …/v0.1.0/openapi.json` — a tag that was never made. The vendored document already equals `v0.2.0` except `info.version` (0 operations or schemas differ) | Lock gains `tag` and `commit`; `source` names the `v0.2.0` asset; sha256 stays as integrity. `--check` also fails without a tag, when `source` does not name it, or when the vendored `info.version` differs from the lock |
| 2.1 | Every `docs/contract-requests.md` row is `published as` / `published differently` / `open — packio-api U-B0.N` / `rejected` | missing | 137 rows; every open row says "Open — mocked" | `src/lib/api/requests/triage.ts`, generated by `pnpm gen:triage` from packio-api's triage (per-operation verdict, operationId, group); the Status cells are rewritten from it |
| 2.2 | Rows added after the triage | missing | `analytics.journey-events`, `admin.analytics-journeys` (U5.0, after `9cbd99a`) | `open — awaiting packio-api triage` |
| 2.3 | `contract-requests.openapi.json` carries only the still-open requests | missing | `scripts/requests-openapi.ts` renders every registry entry (294 operations, 116 ids) | Only operations whose verdict is `implement here` or that are untriaged; published ones stay in the registry for their call sites until U-F0.2–0.4 |
| 2.4 | The registry, the markdown and the triage cannot drift | partial | `registry.test.ts` checks each entry has a row and that the migration list only shrinks (≤ 86) — met | Tests: every entry has a verdict; every published operationId exists in the contract at its method and path; each markdown status agrees with `triage.ts`; the requests document is exactly the open set |
| 3.1 | BFF forwards the client IP (`X-Forwarded-For`, counted by the API's `TRUST_PROXY`) | missing | `src/lib/bff/handler.ts:48` allow-list omits it; `handler.test.ts:227-234` asserts it is dropped | `src/lib/security/client-ip.ts` derives the client from the incoming chain with `TRUSTED_PROXY_HOPS` (default 0 → nothing is sent) and forwards that one address, never the browser's chain; applied to the BFF and to the server-side calls a visitor triggers (`serverApi`, the auth actions, token refresh) |
| 3.2 | Admin menu entry `ops` | missing | packio-api `menu.catalog.ts:34` (`ops`, `/admin/ops`, `ops.read`); `src/features/admin/shell/menu.ts` has no icon or group and there is no page (the link would hit `[...rest]` → 404) | Icon, `system` group, th/en label, mock persona grant; a read-only `/ops` screen on `admin.ops.signals` |
| 4.1 | Base handlers generated from the contract's examples | met | `gen-api.ts` `buildHandlers` → `mocks/generated/handlers.ts` (all 931 operations) | Regenerated only |
| 4.2 | Error-path handlers from each operation's documented problem codes | missing | Only success examples are generated | `mocks/generated/problems.ts`: operationId → method, path and `{ code: { status, example } }` (265 codes) |
| 4.3 | Scenario switcher `?mock=<operationId>:<code>` for dev and Storybook | missing | — | Dev (`API_MOCKS=1` only): `src/proxy.ts` keeps the scenario in a dev cookie, the BFF and `serverApi` pass it on as `x-packio-mock-scenario`, and generated handlers placed first answer that operation with its problem. Storybook (no MSW there, no story fetches — user's choice 2026-09-29): an args-driven "API problems" story on the same catalogue |
| 4.4 | th/en copy for every problem code the UI can receive; lint: no unmapped code for an operation the UI calls | missing | Screens show the API's `detail`; `PROBLEM_CODES` (`src/lib/api/problem.ts:16`) names one code | `common/problems.json` (th, en) seeded from packio-api's own catalogue; `problemCopy()` falls back to `detail`; a gate test scans the typed call sites and fails on any documented code without th and en copy, and on copy for codes the contract no longer has |

Out of scope here: moving call sites off `awaiting-migration.ts` and the CS calculators (U-F0.2–0.4), the `CONTRACT-DEFECT` narrowings (wait for packio-api U-B0.3), `e2e:integration` (U-F0.5). `store.checkout`'s `scheduleKey` stays **open** (user, 2026-09-29) although the triage proposes not adding it (D-020).

## U-F0.2 — Migrate the customer zone (`store.*`) — 2026-09-30

Sources: `docs/prompts/U1-update-2026-09-29.md` §U-F0.2–0.4; packio-api `docs/contract-requests-triage.md` §Details (U-B0.1) at `45ef64e`; contract `v0.2.0`. Evidence is from `main` at `601191d`. **User decision (2026-09-30): migrate all 79 published store operations literally** — the screen follows v0.2.0 where it carries less, nothing is invented, and a capability the contract cannot serve yet is named (`CONTRACT-GAP <id>`) and waits for packio-api.

Scope: 79 store operations are published (32 at the requested path — `awaiting-migration.ts` — and 47 "published differently" elsewhere); 34 are `implement` in U-B0.1 and stay requests. Every published operationId exists in `contract/openapi.json` at the triage's path (checked). Status is `missing` for all 79: every call site still goes through `requests.call` / `requests.read`.

| # | Request id (ops) | Status | Evidence (call sites) | Planned change — and what v0.2.0 does not carry |
|---|---|---|---|---|
| 1 | `store.loyalty` (3), `store.wallet` (1) | met (U-F0.2) | `account/points/page.tsx:26-27`, `account/page.tsx:28`, `liff/points/page.tsx:24-25`, `liff/page.tsx:29`, `account/referral/page.tsx:25`, `account/wallet/page.tsx:23`, `features/customer/account/api.server.ts` | `store.loyalty.get` / `.ledger`, `store.referral.get`, `store.documents.storeCredit`. Lost: tier progress, ledger order link, referral rules / monthly count / friend list, wallet promo codes |
| 2 | `store.order-by-code` (1) | met (U-F0.2) | `search/SearchDialog.tsx:67`, `search/lookup.server.ts:23` | `store.orders.getByCode` → `OrderDto` (`orderId` → `id`) |
| 3 | `store.profile` (1) | met (U-F0.2) | `auth/onboarding.ts:46,66`, `ProfileStep.tsx:36` | `store.customerProfile.get` + `.update` (If-Match). E-mail is not writable (triage open question 4) — the step asks name and customer type; "already asked" is remembered in a first-party cookie |
| 4 | `store.address-book` (10) | met (U-F0.2) | `account/addresses/page.tsx:19-20`, `AddressBook.tsx:43,45`, `AddressForm.tsx:120,124`, `TaxProfileForm.tsx:74,78`, `cart/api.server.ts:16-17`, `CartView.tsx:185` | `store.addresses.*`, `store.taxProfiles.*` (paged lists, If-Match on edits, `taxId`/`branch` read-only). **Create is blocked**: store geo DTOs carry no `id` while `AddressInputDto` requires uuid `provinceId` — new row `store.geo-ids` |
| 5 | `store.quotes` (6) | met (U-F0.2) | `configurator/useQuoteActions.ts:65,93,104`, `ConfiguratorDock.tsx:203-257`, `account/quotes/page.tsx:28`, `configurator/api.server.ts:13`, `catalog/api.server.ts:221` | `store.quotes.save` (`configuration` = the calculate body, `quantities[]` → `options[]`), `.list`, `.get`, `.share`, `.getShared` (`/quotes/shared/{token}`), `.requestPdf` + `.getPdf` (async). Lost: product name / specs / unit, promotion, quote code until shared or PDF |
| 6 | `store.cart` (6) | met (U-F0.2) | `cart/CartView.tsx:180,261,281,311,328`, `cart/api.server.ts:15`, `useQuoteActions.ts:77`, `rfq/RfqQuotes.tsx:65` | `store.cart.*` with If-Match (serialised mutation helper), `quoteOptionId` + `designOption` on add, reprice → confirm-reprice. Lost: product display, `readyForCheckout` + blockers, `designOptions[]` |
| 7 | `store.reorder` (1 of 2) | met (U-F0.2) | `fulfilment/ReorderView.tsx:74` | `store.claims.reorder` → `CartDto`; the preview `GET …/reorder` stays a request |
| 8 | `store.companies`, `-members` (3 of 4), `-branches`, `-approvals`, `-credit` (2 of 3) | met (U-F0.2) | `business/api.server.ts:23-44`, `CompanySignup.tsx:87`, `CompanySettings.tsx:41`, `MembersManager.tsx:92,226`, `BranchesManager.tsx:52,73`, `ApprovalsList.tsx:44-50`, `CreditPanel.tsx:175`, `checkout/CheckoutView.tsx:131` | Company-scoped: `companyId` from `store.companies.listMine`. Approval request → `checkout.place` with `companyId`. Lost: `can{}` (derived from roles in one module), credit eligibility, receivables / notices, signatory, member contacts, decided approvals, statement aging. Apply and add-branch **blocked** by `store.geo-ids` |
| 9 | `store.checkout` (2) | met (U-F0.2) | `checkout/CheckoutView.tsx:99-161` | `store.checkout.preview` / `.place` (`expectedGrossAmount`; codes applied to the cart). Lost: payment methods + fees, points bounds, company block. `scheduleKey` cannot be sent (`forbidNonWhitelisted`) — the picker is read-only; row `store.checkout-schedule-choice` stays open (user, 2026-09-29) |
| 10 | `store.payments` (3) | met (U-F0.2) | `PaymentPanel.tsx:62,81,240`, `PayInstalmentButton.tsx:56`, `checkout/api.server.ts:13` | `store.payments.initiate` per order group, `.get` (`qrPayload`), `.uploadSlip`. Lost: receiver bank account, `failureReason`, `returnUrl`. **Backend returns 2C2P to `/payments/{id}/return`** (`payments.service.ts:259`) — route added here |
| 11 | `store.orders` (3) | met (U-F0.2) | `orders/api.server.ts:14,22`, `account/page.tsx:27`, `liff/**`, `OrderStages.tsx:8`, `ShipmentCard.tsx:9`, `DocumentLink.tsx:41` | Group-first list, lean `OrderDto` + sub-resources, documents via `/documents/{id}/pdf`. Lost: product / unit, `nextActions` (U-B0.3 — interim module keyed on status), receipt dates, `toleranceOutcome`, estimated delivery. **`OrderDto` has no group reference** — new row `store.order-group-ref` |
| 12 | `store.tracking`, `store.receipt`, `store.claims` (3 of 4) | met (U-F0.2) | `catalog/api.server.ts:284`, `ConfirmReceipt.tsx:30`, `ClaimForm.tsx:74`, `ClaimThread.tsx:21,42` | `store.tracking.get` (`/track/{token}`), `store.orders.confirmReceipt`, `store.claims.submit` / `.get` / `.respondInfo`. Lost: order code / product / promised dates on tracking, `respondBy`, free claim thread |
| 13 | `store.artwork`, `store.proofs`, `store.design-service` | met (U-F0.2) | `artwork/api.server.ts:15`, `ArtworkWorkspace.tsx:104,141`, `ProofViewer.tsx:238-326`, `DesignServicePanel.tsx:94,244,276`, `designer/OrderAction.tsx:91` | Composed from `orders.get` + `artwork.list` + `listProofs` + `listTemplates` + `designServices.get`; proof actions at `/proofs/{id}`. Lost: file rules, approval checklist, dieline dimensions, proof page images, approver name |
| 14 | `store.rfqs` (6) | met (U-F0.2) | `rfq/api.server.ts:14,22-23`, `RfqForm.tsx:121`, `RfqThread.tsx:18,46`, `RfqQuotes.tsx:22,46` | `store.rfqs.*` (messages embedded, accept by `rfqQuoteId`). Lost: files, `nextActions`, routed-from |
| 15 | `store.designs` (7 of 10), `store.design-assets` | met (U-F0.2) | `designer/data/api.ts:54-128`, `persistence.ts:114-295`, `customer/designer/api.server.ts:14,23`, `design/[id]/page.tsx:48-85` | `DesignDocumentDto` (`title`, `catalogProductId`, `{spec, content}` + `schemaVersion: 2`). Lost: asset URLs, thumbnails, order link, save kind / material, version labels. **No product reference on store DTOs** — new row `store.catalog-product-ref` |
| 16 | Registry closes the zone | met (U-F0.2) | `registry.test.ts:37-46` (bound ≤ 86) | Bound → ≤ 54; a gate that no `/v1/store/` request remains unless its verdict is `implement` |
| 17 | `CONTRACT-GAP` markers are accounted for | met (U-F0.2) | — | `gaps.test.ts`: every `CONTRACT-GAP <id>` names a row in `contract-requests.md` or a triage id |

Not here: admin and partner zones (U-F0.3, U-F0.4), CS calculators (U-F0.3), `e2e:integration` (U-F0.5).

Status after U-F0.2 (2026-09-30): every row met; what each cluster lost, the fixmes and the questions for packio-api are in `docs/PROGRESS.md` §U-F0.2.

---

## U-F0.3 — Migrate the admin zone (`admin.*`) — 2026-09-30

Sources: `docs/prompts/U1-update-2026-09-29.md` §U-F0.2–0.4; packio-api `docs/contract-requests-triage.md` re-triaged at `cb2ebe4` against contract **`v0.3.0`**; evidence from `main` at `5af34e9`. **User decisions (2026-09-30):**
1. Adopt `v0.3.0` first. The newly published `store.configurator` is parked (`CUSTOMER_ZONE_PARKED`) until U2.F1 rebuilds the configurator.
2. Migrate **all** published admin operations literally, following U-F0.2's rule:
   - the screen follows the contract;
   - what it lacks is `// CONTRACT-GAP <id>`;
   - a test that needs it becomes `test.fixme` naming the gap.

**Scope.** The triage has 139 admin operations:
- **101 are published differently.** All are `missing`: every call site still goes through `requests.call` / `requests.read`, 172 literal call sites in total. They carry 146 additive gaps (packio-api U-B0.2 / U-B0.3).
- **38 are `implement`.** They stay requests and mocks, and are not touched.

**Already met, not touched:**
- finance, partner pricing, platform, IAM and approvals screens already call the published contract (329 typed `/v1/admin` call sites);
- `/ops` (U-F0.1).

| # | Request ids (published ops) | Status | Evidence (call sites) | Planned change — and what the contract does not carry |
|---|---|---|---|---|
| 0 | Contract `v0.3.0`, triage `cb2ebe4` | met (U-F0.3 slice 0) | `contract.lock.json` pinned `v0.2.0`; `triage.ts` from `45ef64e` | `gen:api --adopt --tag v0.3.0` (+16 operations, none removed), `gen:triage`. Fallout: store option `id` and `toolingAmount` in the store mocks. `store.configurator` parked; `admin.analytics-journeys` triaged (U-B0.3, built in U5.B6) |
| 1 | `admin.permissions` (mock re-map) | met (U-F0.3) | `mocks/personas.ts`: 13 keys absent from packio-api `permissions.catalog.ts` | Rename to backend keys in the personas and in every UI check. The business menu entries are `admin.menu-entries` (U-B0.3), so they stay mock-provided (`CONTRACT-GAP`) |
| 2 | `admin.customers` (4), `admin.customer-loyalty` (1), `admin.referrals` (1), `admin.geo` (1) | met (U-F0.3) | `customers/resources.ts:20`, `CustomerDetail.tsx:45,182,285`, `customers/[customerId]/page.tsx:25`, `cs/CalculatorWorkspace.tsx:83,89,682`, `cs/CreateOrder.tsx:62,290,299` | Create is `findOrCreate` (`{created, customer}`). Addresses use `provinceId` / `subdistrictId`. The ledger is `…/loyalty/ledger` and the balance `…/loyalty`. Postcodes go through `store.catalog.lookupPostcode`. Lost: addresses and tax profiles on the detail, the referral code, reward points |
| 3 | `admin.orders` (4), `admin.order-notes` (2), `admin.order-actions` (5 of 8), `admin.cs-create-order` (1) | met (U-F0.3) | `orders/resources.ts:18`, `OrderDetail.tsx:55`, `OrderGroup.tsx:25`, `OrderRail.tsx:54,129,140`, `OrderActions.tsx:99-300`, `PartyOrders.tsx:28`, `finance/banking.tsx:848`, `cs/CreateOrder.tsx:72` | The list is `order-queues/{queue}`. The detail is composed from `AdminOrderDto` and its sub-resources. Slips go through `admin.payments.reviewSlip` / `uploadSlip`. CS create-order is cart items + `…/checkout` (Idempotency-Key). Lost: the page aggregate, `nextActions` (interim `src/domain/next-actions/admin.ts`), note mentions. Cancel reasons and reminders stay requests |
| 4 | `admin.cs-calculators` (folding + corrugate), `admin.quotations` (4), `admin.discount-memos` (3) | met (U-F0.3) | `cs/CalculatorWorkspace.tsx:76-147,599`, `cs/Quotations.tsx:77,81`, `cs/CreateOrder.tsx:56`, `mocks/admin/sales.ts` ("prices are illustrative") | Typed folding and corrugate forms on `admin.csFolding.*` / `admin.csCorrugate.*`. The other five types are **RFQ-only**: no published calculator, or `admin.partnerCoverage.get` gives `quoteMode: rfq`. The illustrative calculator mock is removed. Quotes move to `/v1/admin/quotes`; a memo prices the CS cart. Lost: the direct-discount limit (it stays 0, so every discount needs a memo), quantity presets, saved `toolingAmount`, `memoCode` |
| 5 | `admin.rfqs` (2), `-messages` (2), `-actions` (3 of 4), `-consultations` (1 of 3), `-quotes` (3 of 5) | met (U-F0.3) | `rfq/resources.ts:24`, `RfqDetail.tsx:62`, `RfqTabs.tsx:443,449`, `RfqActions.tsx:109-299`, `QuoteComposer.tsx:97,108` | Messages, consultations and quotations arrive inline on `admin.rfqs.get`. Quotations move to `/rfqs/{id}/quotations` and `/rfq-quotations/{id}/actions/*`. Lost: queues, files, events, SLA / urgency, `nextActions`. Start-review, remind, draft PUT and record-acceptance stay requests |
| 6 | `admin.prepress` (2), `-actions` (2 of 3), `-proofs` (4), `-template` (2), `admin.design-services` (2), `admin.design-documents` (2 of 3) | met (U-F0.3) | `prepress/resources.ts:30`, `PrepressWorkspace.tsx:53,77`, `PrepressActions.tsx:163-372`, `PrepressTabs.tsx:348-371`, `designer/data/api.ts:30,188,195`, `app/admin/designs/[documentId]/page.tsx:33` | The queue is `/prepress/queue` (3 kinds). The workspace is composed from artwork, proof, template, design-service and design resources. Annotations come inline on the proof. Designs are `/v1/admin/designs/{id}` (If-Match). Lost: the aggregate, the editable flag / owner. Assign and copy stay requests |
| 7 | `admin.production-board` (1), `admin.inspections` (2), `admin.scorecards` (1) | met (U-F0.3) | `production/ProductionBoard.tsx:33`, `partners/resources.ts:51`, `production/Inspections.tsx:162`, `production/Scorecards.tsx:35` | `admin.production.list`, grouped on the client by milestone. Scorecards per factory. Record sends flat found counts. Lost: factory / type filters, risk reason, AQL values, the all-factories month view |
| 8 | `admin.campaigns` (5), `admin.promotions` (5 of 6), `admin.coupons` (3 of 4) | met (U-F0.3) | `marketing/resources.ts:32-48`, `CampaignDetail.tsx:32-240`, `CampaignsList.tsx:42`, `PromotionEditor.tsx:191-645`, `PromotionsList.tsx:151`, `CouponCodes.tsx:50-207` | Actions are activate \| pause \| end. Benefit types are renamed. `zoneCodes` replaces `provinceIds`. Coupons move to `/promotions/{id}/coupons`. Lost: owner, spent %, performance, `allowedActions`, usage, the batch list. Priority PUT and coupon batches stay requests |
| 9 | `admin.companies` (7), `admin.company-credit` (2) | met (U-F0.3) | `companies/resources.ts:32`, `CompanyWorkspace.tsx:55-623`, `finance/receivables.tsx:519` | Members, branches and KYC arrive inline on `get`. Actions are approve-kyc / reject-kyc / suspend / reactivate / close. The credit basis enum is renamed. Statements are one month per call. Lost: receivables on the page, evidence files |
| 10 | `admin.shipments` (4 of 8), `admin.claims` (5) | met (U-F0.3) | `logistics/resources.ts:36,45`, `ShipmentDetail.tsx:32,62,348`, `ClaimDetail.tsx:49-353` | Booking takes a carrier. Labels go through `admin.files.download`. Each claim action is its own operation (Idempotency-Key, not If-Match). Lost: `allowedActions`, messages, refs, the ETag. Split, carrier quotes, exceptions and POD stay requests |
| 11 | `admin.analytics` (5), `admin.prospectus` (1), `admin.reports` (2), `admin.exports` (1), `admin.imports` (3) | met (U-F0.3) | `analytics/AnalyticsDashboard.tsx:53-78`, `reports/ReportsIndex.tsx:21`, `ReportView.tsx:41,55`, `console/ExportButton.tsx:23`, `console/ImportWizard.tsx:62,72` | Analytics takes explicit from/to and answers bare arrays. The overview is composed from sales + funnel + traffic. The prospectus is an async export (poll). The report preview caps at 200 rows. Exports are per report. Imports are a per-kind preview → confirm (`previewSha256`). Lost: range presets, report totals and pagination, a generic export |
| 12 | Registry closes the zone | met (U-F0.3) | `registry.test.ts` (bound ≤ 55 after slice 0) | The bound drops to ≤ 5 (4 partner entries plus the parked configurator). New gate: a `/v1/admin/` request exists only while its verdict is `implement` |

Not here: the partner zone (U-F0.4) and `e2e:integration` (U-F0.5).

Status after U-F0.3 (2026-09-30): every row met. Slices 5–11 were built in parallel worktrees and merged. What each screen lost, the e2e fixmes and the questions for packio-api are in `docs/PROGRESS.md` §U-F0.3.


---

## U-F0.4 — The partner zone, and every zone onto v0.4–v0.6 — 2026-10-01

Sources:
- `docs/prompts/U1-update-2026-09-29.md` §U-F0.2–0.4;
- packio-api tags `v0.4.0` (U-B0.1 store), `v0.5.0` (U-B0.2 admin) and `v0.6.0` (U-B0.3 platform, finance, partner, cross-cutting; `18a675d`). Nothing was removed;
- packio-api's `docs/contract-requests-triage.md` at `v0.6.0`, with its `U-B0.x shipped` tables.

Evidence is from `main` at `bbcfdcd`.

**User decisions (2026-10-01):**
1. Adopt `v0.6.0`.
2. Do everything in this session: the partner zone, the store and admin requests that are now published, and every `CONTRACT-GAP` v0.4–v0.6 closed.
3. QC answers an interim checklist owned by the web (row P2).

The U-F0.2/0.3 rule stands:
- the screen follows the contract;
- what it still lacks is `CONTRACT-GAP <id>`;
- a test that needs it is a `test.fixme` naming the gap.

**Scope.**
- 115 request operations remain. 111 are published:
  - partner 43;
  - store 31, including the configurator parked for U2.F1;
  - admin 37.
- 4 stay requests:
  - `admin.analytics-journeys` (U5.B6, D-219);
  - guided help and sample kits (deferred, D-223).
- About 190 `CONTRACT-GAP` markers name gaps the shipped groups say they added.
- 21 e2e fixmes.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 0.1 | Lock on the latest tag | missing | `contract.lock.json` pins `v0.3.0` | `gen:api --adopt --tag v0.6.0` (+124 operations, 0 removed); mock compile fallout fixed |
| 0.2 | Triage reflects the shipped groups | missing | `triage.ts` from `93d8d06`. In v0.6.0's triage, *Details* still says "implement here"; what shipped is only in the `U-B0.x shipped` tables | `gen:triage` reads the triage **at the lock's tag** and applies the shipped tables. A built operation resolves by exact path, else by the operationIds its row names, else by four prose-named mappings checked against the row. New verdict `deferred` |
| 0.3 | Shared docs identical in both repos | partial | `decisions.md` lacks D-229–D-232; `accounting-design.md` differs (P15 `min()`, "price table") | Copied from packio-api `v0.6.0` |
| 0.4 | Contract-defect narrowings removed | missing | `RateCardReview.tsx` (`CardLineAnswer`), the folding `AssemblyDto`, the simulation result | Use the generated types |
| P1 | Factory-scope permissions are backend keys | missing | `factory_jobs.accept/update`, `factory_billing.*`, `factory_payouts.read` in UI and mocks; `gen:rbac` read only the staff table | `gen:rbac` imports `## Partner factory` at the tag. Personas take `FACTORY_ROLE_GRANTS`. Keys renamed (triage `partner.permissions`). Gate `src/features/partner/permissions.test.ts` |
| P2 | Floor: today, jobs, lookup, accept / reject, milestones, QC, issues, capacity calendar | missing | 19 request call sites in `features/partner/jobs/*` and `app/partner/(console)/{page,jobs,capacity}` | `partner.production.*` on `/production-jobs` (token-scoped, D-044):<br>• `?view`<br>• `JobRejectReason`<br>• milestones by id, with `applied: false` reloading the job<br>• issues with D-232 kinds and self-resolve<br>• `partner.factories.capacityCalendar`<br>• job `nextActions`<br>QC answers `src/domain/qc` (`packio-web-v1`, `CONTRACT-GAP partner.job-qc-checklist`) |
| P3 | Ship: ship plan, create, ready, dispatch, request carrier, POD, labels | missing | `features/partner/ship/*`, `app/partner/(console)/ship/**` | `partner.shipments.*`:<br>• `items[]` on create and POD<br>• the new `markReady` step, which makes labels and the packing list<br>• label sheet from `cartons[]`; no public tracking URL per carton (left out by the API)<br>• Idempotency-Key on writes |
| P4 | Money: statements, tax invoices, payouts (schedule, list, detail, documents), statement of account | missing | `features/partner/billing/*`, `app/partner/(console)/{billing,payouts}/**` | `partner.payables.*`:<br>• statements: totals, line kinds, `taxInvoices`, dispute `lineNos`<br>• the factory keys `netAmount` / `vatAmount` on its tax invoice (backend wins)<br>• payouts: `from` / `to` without paging |
| P5 | Claims, scorecard, users, notification choices, change requests, site visits, references, proposal evidence | missing | `features/partner/{account,requests,prices,onboarding}`, the settings, performance and claims pages | `partner.claims.*` (respond `evidenceFileIds`); `scorecards?months`.<br>Users: create with `initialPassword` (no owner role, D-171); `setRoles`, which also reactivates; deactivate.<br>`partner.me.notificationPreferences` (D-231).<br>`partner.changeRequests.*`, `listSiteVisits`, `priceReferences`, proposal evidence.<br>Factory names from `partner.me.get` |
| P6 | Partner zone closed | missing | 43 partner operations on the migration list | Every `partner-*.ts` request file deleted. Gate: no `/v1/partner/` request |
| S1 | Store requests now published | missing | 31 store operations (`store-*.ts`) | Migrated. Guided help and sample kits stay requests with their entry points hidden (D-223). The configurator stays parked (U2.F1) |
| S2 | Store `CONTRACT-GAP`s the shipped group closed | missing | 58 markers in the customer zone and about 35 shared, e.g. `store.orders` (10), `store.geo-ids` (14), `store.cart`, `store.loyalty`, `store.artwork` | Each "Added in U-B0.1" field applied. Our own rows are re-checked against v0.6.0: `store.geo-ids` (subdistricts now carry `id`), `store.catalog-product-ref` (designs carry `product`; cards still no id), `store.order-group-ref` (`OrderDto` still has no group) |
| A1 | Admin requests now published | missing | 37 admin operations (`admin-*.ts`) | Migrated. `admin.analytics-journeys` stays a request (U5.B6) |
| A2 | Admin `CONTRACT-GAP`s the shipped groups closed | missing | 97 markers, e.g. `admin.shipments` (16), `admin.orders` (14), `admin.companies` (14), `admin.rfqs` (12), `admin.prepress` (11) | Each "Added in U-B0.2/0.3" field applied. The menu comes from `admin.me.get`. Exports return where `admin.exports.create` covers them. POD review and delivery exceptions follow D-229 / D-230 |
| X1 | `nextActions` from the API | missing | Interim `src/domain/next-actions/{admin,store}.ts`; `entity.next-actions` markers | Presentation for packio-api's 59 action keys (`API_ACTION_KEYS`, test). Screens render the entity's own list, and the interim modules are deleted |
| X2 | Notifications: unread count, link, read-all | partial | `features/shared/shell/notifications.ts` counted the first page | `meta.unreadCount`; items link to their `url`; `{surface}.notifications.markAllRead` |
| X3 | RUM web vitals on the published operation | missing | `web-vitals.ts` was a contract request | `WebVitalDto`, with the customer zone reported as `store` |
| X4 | e2e fixmes | partial | 21 `test.fixme` | Un-fixme each one whose gap closed; the rest keep their named gap |

Met, not touched:
- partner onboarding and price screens (already typed);
- the parked `store.configurator` (U2.F1);
- the CS calculators beyond folding and corrugate stay RFQ-only (U-B6; the label calculator is not tagged).

Status after U-F0.4 (2026-10-01): every row met.
- Request operations went from 115 to 5:
  - the parked configurator;
  - guided help and sample kits, deferred (D-223);
  - analytics journeys (U5.B6).
- `CONTRACT-GAP` markers went from 190 to 86; each names a gap packio-api left out or a row still open.
- The migration slices are listed in `docs/PROGRESS.md` §U-F0.4, with what each screen still lacks.

### Appendix — every published request operation and where it went
Generated from `triage.ts` and `awaiting-migration.ts` at the start of U-F0.4. "Gaps" counts the fields the shipped group added for the screen to apply.
**partner** (43)

| Request | Operation today | Published as | Shipped in | Gaps |
|---|---|---|---|---|
| `partner.billing-statements` | `GET /v1/partner/factories/{factoryId}/billing-statements` | `partner.payables.listStatements` (`GET /v1/partner/billing-statements`) | v0.6.0 | 4 |
| `partner.billing-statements` | `GET /v1/partner/factories/{factoryId}/billing-statements/{statementId}` | `partner.payables.getStatement` (`GET /v1/partner/billing-statements/{statementId}`) | v0.6.0 | 4 |
| `partner.billing-statements` | `POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/confirm` | `partner.payables.confirmStatement` (`POST /v1/partner/billing-statements/{statementId}/actions/confirm`) | v0.6.0 | 0 |
| `partner.billing-statements` | `POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/actions/dispute` | `partner.payables.disputeStatement` (`POST /v1/partner/billing-statements/{statementId}/actions/dispute`) | v0.6.0 | 1 |
| `partner.billing-statements` | `POST /v1/partner/factories/{factoryId}/billing-statements/{statementId}/tax-invoices` | `partner.payables.submitTaxInvoice` (`POST /v1/partner/billing-statements/{statementId}/tax-invoices`) | v0.6.0 | 1 |
| `partner.capacity-calendar` | `GET /v1/partner/factories/{factoryId}/capacity-calendar` | `partner.factories.capacityCalendar` (same path) | v0.6.0 | 0 |
| `partner.change-requests` | `GET /v1/partner/factories/{factoryId}/change-requests` | `partner.changeRequests.list` (same path) | v0.6.0 | 0 |
| `partner.change-requests` | `POST /v1/partner/factories/{factoryId}/change-requests` | `partner.changeRequests.create` (same path) | v0.6.0 | 0 |
| `partner.claims` | `GET /v1/partner/factories/{factoryId}/claims` | `partner.claims.list` (`GET /v1/partner/claims`) | v0.6.0 | 3 |
| `partner.claims` | `GET /v1/partner/factories/{factoryId}/claims/{claimId}` | `partner.claims.get` (`GET /v1/partner/claims/{claimId}`) | v0.6.0 | 4 |
| `partner.claims` | `POST /v1/partner/factories/{factoryId}/claims/{claimId}/actions/respond` | `partner.claims.respond` (`POST /v1/partner/claims/{claimId}/actions/respond`) | v0.6.0 | 1 |
| `partner.job-issues` | `POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues` | `partner.production.raiseIssue` (`POST /v1/partner/production-jobs/{jobId}/issues`) | v0.6.0 | 3 |
| `partner.job-issues` | `POST /v1/partner/factories/{factoryId}/jobs/{jobId}/issues/{issueId}/actions/resolve` | `partner.production.resolveIssue` (`POST /v1/partner/production-jobs/{jobId}/issues/{issueId}/actions/resolve`) | v0.6.0 | 0 |
| `partner.job-milestones` | `POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/complete` | `partner.production.updateMilestone` (`POST /v1/partner/production-jobs/{jobId}/milestones/{milestoneId}`) | v0.6.0 | 0 |
| `partner.job-milestones` | `POST /v1/partner/factories/{factoryId}/jobs/{jobId}/milestones/{seq}/actions/start` | `partner.production.updateMilestone` (`POST /v1/partner/production-jobs/{jobId}/milestones/{milestoneId}`) | v0.6.0 | 0 |
| `partner.job-qc` | `POST /v1/partner/factories/{factoryId}/jobs/{jobId}/qc-checks` | `partner.production.recordQc` (`POST /v1/partner/production-jobs/{jobId}/qc-checks`) | v0.6.0 | 2 |
| `partner.jobs` | `GET /v1/partner/factories/{factoryId}/jobs` | `partner.production.list` (`GET /v1/partner/production-jobs`) | v0.6.0 | 4 |
| `partner.jobs` | `GET /v1/partner/factories/{factoryId}/jobs/{jobId}` | `partner.production.get` (`GET /v1/partner/production-jobs/{jobId}`) | v0.6.0 | 1 |
| `partner.jobs` | `GET /v1/partner/factories/{factoryId}/jobs/lookup` | `partner.production.lookup` (`GET /v1/partner/production-jobs/lookup`) | v0.6.0 | 0 |
| `partner.jobs` | `POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/accept` | `partner.production.accept` (`POST /v1/partner/production-jobs/{jobId}/actions/accept`) | v0.6.0 | 0 |
| `partner.jobs` | `POST /v1/partner/factories/{factoryId}/jobs/{jobId}/actions/reject` | `partner.production.reject` (`POST /v1/partner/production-jobs/{jobId}/actions/reject`) | v0.6.0 | 0 |
| `partner.notification-preferences` | `GET /v1/partner/me/notification-preferences` | `partner.me.notificationPreferences` (same path) | v0.6.0 | 0 |
| `partner.notification-preferences` | `PUT /v1/partner/me/notification-preferences` | `partner.me.setNotificationPreferences` (same path) | v0.6.0 | 0 |
| `partner.payouts` | `GET /v1/partner/factories/{factoryId}/payout-schedule` | `partner.payables.payoutSchedule` (same path) | v0.6.0 | 0 |
| `partner.payouts` | `GET /v1/partner/factories/{factoryId}/payouts` | `partner.payables.payoutStatement` (same path) | v0.6.0 | 3 |
| `partner.payouts` | `GET /v1/partner/factories/{factoryId}/payouts/{payoutId}` | `partner.payables.getPayout` (same path) | v0.6.0 | 0 |
| `partner.payouts` | `GET /v1/partner/factories/{factoryId}/statement-of-account` | `partner.payables.statementOfAccount` (same path) | v0.6.0 | 0 |
| `partner.proposal-evidence` | `GET /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence` | `partner.priceProposals.listEvidence` (same path) | v0.6.0 | 0 |
| `partner.proposal-evidence` | `POST /v1/partner/factories/{factoryId}/price-proposals/{proposalId}/evidence` | `partner.priceProposals.addEvidence` (same path) | v0.6.0 | 0 |
| `partner.references` | `GET /v1/partner/factories/{factoryId}/references` | `partner.factories.priceReferences` (same path) | v0.6.0 | 0 |
| `partner.scorecard` | `GET /v1/partner/factories/{factoryId}/scorecards` | `partner.production.scorecards` (same path) | v0.6.0 | 1 |
| `partner.shipments` | `GET /v1/partner/factories/{factoryId}/ship-plan` | `partner.shipments.shipPlan` (same path) | v0.6.0 | 0 |
| `partner.shipments` | `GET /v1/partner/factories/{factoryId}/shipments` | `partner.shipments.list` (`GET /v1/partner/shipments`) | v0.6.0 | 2 |
| `partner.shipments` | `GET /v1/partner/factories/{factoryId}/shipments/{shipmentId}` | `partner.shipments.get` (`GET /v1/partner/shipments/{shipmentId}`) | v0.6.0 | 4 |
| `partner.shipments` | `POST /v1/partner/factories/{factoryId}/shipments` | `partner.shipments.create` (`POST /v1/partner/shipments`) | v0.6.0 | 0 |
| `partner.shipments` | `POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/dispatch` | `partner.shipments.dispatch` (`POST /v1/partner/shipments/{shipmentId}/actions/dispatch`) | v0.6.0 | 0 |
| `partner.shipments` | `POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/actions/request-carrier` | `partner.shipments.requestCarrier` (`POST /v1/partner/shipments/{shipmentId}/actions/request-carrier`) | v0.6.0 | 0 |
| `partner.shipments` | `POST /v1/partner/factories/{factoryId}/shipments/{shipmentId}/pod` | `partner.shipments.recordPod` (`POST /v1/partner/shipments/{shipmentId}/proof-of-delivery`) | v0.6.0 | 0 |
| `partner.site-visits` | `GET /v1/partner/factories/{factoryId}/site-visits` | `partner.factories.listSiteVisits` (same path) | v0.6.0 | 0 |
| `partner.today` | `GET /v1/partner/factories/{factoryId}/today` | `partner.production.today` (same path) | v0.6.0 | 0 |
| `partner.users` | `GET /v1/partner/factories/{factoryId}/users` | `partner.factoryUsers.list` (same path) | v0.6.0 | 3 |
| `partner.users` | `PATCH /v1/partner/factories/{factoryId}/users/{userId}` | `partner.factoryUsers.deactivate` (`POST /v1/partner/factories/{factoryId}/users/{userId}/actions/deactivate`) | v0.6.0 | 1 |
| `partner.users` | `POST /v1/partner/factories/{factoryId}/users` | `partner.factoryUsers.create` (same path) | v0.6.0 | 0 |

**store** (31)

| Request | Operation today | Published as | Shipped in | Gaps |
|---|---|---|---|---|
| `store.claims` | `GET /v1/store/orders/{orderId}/claim-form` | `store.claims.getForm` (same path) | v0.4.0 | 0 |
| `store.company-assets` | `DELETE /v1/store/me/company/brand-assets/{assetId}` | `store.companyAssets.remove` (`DELETE /v1/store/companies/{companyId}/brand-assets/{assetId}`) | v0.4.0 | 0 |
| `store.company-assets` | `GET /v1/store/me/company/brand-assets` | `store.companyAssets.list` (`GET /v1/store/companies/{companyId}/brand-assets`) | v0.4.0 | 0 |
| `store.company-assets` | `POST /v1/store/me/company/brand-assets` | `store.companyAssets.add` (`POST /v1/store/companies/{companyId}/brand-assets`) | v0.4.0 | 0 |
| `store.company-credit` | `POST /v1/store/me/company/credit-applications` | `store.companyCredit.apply` (`POST /v1/store/companies/{companyId}/credit-applications`) | v0.4.0 | 0 |
| `store.company-members` | `PATCH /v1/store/me/company/members/{memberId}` | `store.companies.changeMemberRoles` (`PUT /v1/store/companies/{companyId}/members/{memberId}/roles`) | v0.4.0 | 0 |
| `store.company-reorder` | `POST /v1/store/me/company/bulk-reorders` | `store.claims.bulkReorder` (`POST /v1/store/companies/{companyId}/bulk-reorders`) | v0.4.0 | 0 |
| `store.company-reorder` | `POST /v1/store/me/company/bulk-reorders/actions/preview` | `store.claims.previewBulkReorder` (`POST /v1/store/companies/{companyId}/bulk-reorders/actions/preview`) | v0.4.0 | 0 |
| `store.company-spend` | `GET /v1/store/me/company/spend` | `store.companies.spend` (`GET /v1/store/companies/{companyId}/spend`) | v0.4.0 | 0 |
| `store.configurator` | `GET /v1/store/catalog/products/{slug}/configurator` | `store.catalog.getConfigurator` (same path) | v0.4.0 | 4 |
| `store.design-share` | `DELETE /v1/store/designs/{designId}/share` | `store.designs.unshare` (same path) | v0.4.0 | 0 |
| `store.design-share` | `GET /v1/store/shared-designs/{token}` | `store.designs.getShared` (same path) | v0.4.0 | 0 |
| `store.design-share` | `POST /v1/store/designs/{designId}/actions/share` | `store.designs.share` (same path) | v0.4.0 | 0 |
| `store.designer-catalog` | `GET /v1/store/designer/catalog` | `store.designer.getCatalog` (same path) | v0.4.0 | 0 |
| `store.designer-catalog` | `GET /v1/store/designer/templates/{templateId}` | `store.designer.getTemplate` (same path) | v0.4.0 | 0 |
| `store.designs` | `POST /v1/store/designs/{designId}/actions/duplicate` | `store.designs.duplicate` (same path) | v0.4.0 | 0 |
| `store.designs` | `POST /v1/store/designs/{designId}/versions/{versionNo}/actions/restore` | `store.designs.restoreVersion` (same path) | v0.4.0 | 0 |
| `store.designs` | `POST /v1/store/designs/actions/import` | `store.designs.import` (same path) | v0.4.0 | 0 |
| `store.identities` | `DELETE /v1/store/me/identities/{provider}` | `store.me.unlinkIdentity` (same path) | v0.4.0 | 0 |
| `store.instalments` | `GET /v1/store/instalments` | `store.paymentSchedules.listInstalments` (same path) | v0.4.0 | 0 |
| `store.price-hints` | `GET /v1/store/catalog/price-hints` | `store.catalog.listPriceHints` (same path) | v0.4.0 | 0 |
| `store.privacy` | `GET /v1/store/me/privacy-requests` | `store.me.listPrivacyRequests` (same path) | v0.4.0 | 0 |
| `store.privacy` | `POST /v1/store/me/privacy-requests` | `store.me.createPrivacyRequest` (same path) | v0.4.0 | 0 |
| `store.product-categories` | `GET /v1/store/catalog/product-categories` | `store.catalog.listProductCategories` (same path) | v0.4.0 | 0 |
| `store.product-faqs` | `GET /v1/store/catalog/products/{slug}/faqs` | `store.catalog.listProductFaqs` (same path) | v0.4.0 | 0 |
| `store.promo-check` | `POST /v1/store/promotions/actions/check` | `store.promotions.checkCode` (same path) | v0.4.0 | 0 |
| `store.reorder` | `GET /v1/store/orders/{orderId}/reorder` | `store.claims.previewReorder` (same path) | v0.4.0 | 0 |
| `store.rfq-forms` | `GET /v1/store/rfq-forms/{productTypeCode}` | `store.rfqs.getForm` (same path) | v0.4.0 | 0 |
| `store.support-channels` | `GET /v1/store/support-channels` | `store.support.getChannels` (same path) | v0.4.0 | 0 |
| `store.support` | `POST /v1/store/support/actions/contact` | `store.support.contact` (same path) | v0.4.0 | 0 |
| `store.support` | `POST /v1/store/support/actions/handoff` | `store.support.handoff` (same path) | v0.4.0 | 0 |

**admin** (37)

| Request | Operation today | Published as | Shipped in | Gaps |
|---|---|---|---|---|
| `admin.account-roll-forward` | `GET /v1/admin/financial-reports/roll-forward` | `admin.financialReports.accountRollForward` (same path) | v0.6.0 | 0 |
| `admin.bank-line-split` | `POST /v1/admin/bank-statement-lines/{lineId}/actions/split` | `admin.banking.splitLine` (same path) | v0.6.0 | 0 |
| `admin.bank-line-suggestions` | `GET /v1/admin/bank-statement-lines/{lineId}/suggestions` | `admin.banking.suggestMatches` (same path) | v0.6.0 | 0 |
| `admin.coupons` | `GET /v1/admin/promotions/{promotionId}/coupon-batches` | `admin.promotions.listCouponBatches` (same path) | v0.5.0 | 0 |
| `admin.credit-note-reasons` | `GET /v1/admin/credit-note-reasons` | `admin.customerDocuments.listCreditNoteReasons` (same path) | v0.6.0 | 0 |
| `admin.customer-consents` | `GET /v1/admin/customers/{customerId}/consents` | `admin.consentPurposes.customerConsents` (same path) | v0.5.0 | 0 |
| `admin.dashboard` | `GET /v1/admin/dashboard` | `admin.dashboard.get` (same path) | v0.6.0 | 0 |
| `admin.depreciation-preview` | `GET /v1/admin/depreciation-runs/preview` | `admin.fixedAssets.previewRun` (same path) | v0.6.0 | 0 |
| `admin.design-documents` | `POST /v1/admin/design-documents/{documentId}/actions/copy` | `admin.designs.copy` (`POST /v1/admin/designs/{designId}/actions/copy`) | v0.5.0 | 0 |
| `admin.document-resend` | `GET /v1/admin/customer-documents/{documentId}/deliveries` | `admin.customerDocuments.deliveries` (same path) | v0.6.0 | 0 |
| `admin.document-resend` | `POST /v1/admin/customer-documents/{documentId}/actions/resend` | `admin.customerDocuments.resend` (same path) | v0.6.0 | 0 |
| `admin.dunning-log` | `GET /v1/admin/dunning-log` | `admin.customerDocuments.dunningLog` (same path) | v0.6.0 | 0 |
| `admin.gateway-settlements` | `GET /v1/admin/gateway-settlements` | `admin.banking.listSettlements` (same path) | v0.6.0 | 0 |
| `admin.order-actions` | `GET /v1/admin/order-cancel-reasons` | `admin.orders.listCancelReasons` (same path) | v0.5.0 | 0 |
| `admin.order-actions` | `POST /v1/admin/orders/{orderId}/actions/send-payment-reminder` | `admin.orders.sendPaymentReminder` (same path) | v0.5.0 | 0 |
| `admin.order-actions` | `POST /v1/admin/orders/actions/send-payment-reminders` | `admin.orders.sendPaymentReminders` (same path) | v0.5.0 | 0 |
| `admin.payout-documents` | `GET /v1/admin/payout-runs/{runId}/items/{itemId}/documents` | `admin.payouts.itemDocuments` (same path) | v0.6.0 | 0 |
| `admin.prepress-actions` | `POST /v1/admin/prepress/{orderId}/actions/assign` | `admin.artwork.assignPrepress` (`POST /v1/admin/orders/{orderId}/actions/assign-prepress`) | v0.5.0 | 0 |
| `admin.promotions` | `PUT /v1/admin/promotions/priority` | `admin.promotions.reorder` (same path) | v0.5.0 | 0 |
| `admin.rfq-actions` | `POST /v1/admin/rfqs/{rfqId}/actions/start-review` | `admin.rfqs.startReview` (same path) | v0.5.0 | 0 |
| `admin.rfq-consultations` | `GET /v1/admin/rfqs/{rfqId}/candidate-factories` | `admin.rfqs.listCandidateFactories` (same path) | v0.5.0 | 0 |
| `admin.rfq-consultations` | `POST /v1/admin/rfqs/{rfqId}/consultations/{consultationId}/actions/remind` | `admin.rfqs.remindConsultation` (`POST /v1/admin/rfq-consultations/{consultationId}/actions/remind`) | v0.5.0 | 0 |
| `admin.rfq-quotes` | `POST /v1/admin/rfqs/{rfqId}/quotes/{quoteId}/actions/record-acceptance` | `admin.rfqs.recordAcceptance` (`POST /v1/admin/rfq-quotations/{rfqQuoteId}/actions/record-acceptance`) | v0.5.0 | 0 |
| `admin.rfq-quotes` | `PUT /v1/admin/rfqs/{rfqId}/quotes/{quoteId}` | `admin.rfqs.replaceDraftQuotation` (`PUT /v1/admin/rfq-quotations/{rfqQuoteId}`) | v0.5.0 | 0 |
| `admin.saved-views` | `DELETE /v1/admin/saved-views/{viewId}` | `admin.savedViews.delete` (same path) | v0.6.0 | 0 |
| `admin.saved-views` | `GET /v1/admin/saved-views` | `admin.savedViews.list` (same path) | v0.6.0 | 0 |
| `admin.saved-views` | `POST /v1/admin/saved-views` | `admin.savedViews.create` (same path) | v0.6.0 | 0 |
| `admin.search` | `GET /v1/admin/search` | `admin.search.find` (same path) | v0.6.0 | 0 |
| `admin.shipments` | `POST /v1/admin/shipments/{shipmentId}/actions/resolve-exception` | `admin.shipments.resolveException` (same path) | v0.5.0 | 0 |
| `admin.shipments` | `POST /v1/admin/shipments/{shipmentId}/actions/split` | `admin.shipments.split` (same path) | v0.5.0 | 0 |
| `admin.shipments` | `POST /v1/admin/shipments/{shipmentId}/carrier-quotes` | `admin.shipments.carrierQuotes` (same path) | v0.5.0 | 0 |
| `admin.shipments` | `POST /v1/admin/shipments/{shipmentId}/pod/actions/{decision}` | `admin.shipments.reviewPod` (same path) | v0.5.0 | 0 |
| `admin.slip-file` | `GET /v1/admin/slips/{slipId}/file` | `admin.files.download` (`GET /v1/admin/files/{fileId}/download`) | v0.6.0 | 0 |
| `admin.sod-rules` | `GET /v1/admin/sod-rules` | `admin.sodRules.list` (same path) | v0.6.0 | 0 |
| `admin.staff-directory` | `GET /v1/admin/staff-directory` | `admin.staffDirectory.list` (same path) | v0.6.0 | 0 |
| `admin.subledger-reconciliation` | `GET /v1/admin/financial-reports/subledger-reconciliation` | `admin.financialReports.subledgerReconciliation` (same path) | v0.6.0 | 0 |
| `admin.unmet-demand-reasons` | `GET /v1/admin/unmet-demand-reasons` | `admin.rfqs.listUnmetDemandReasons` (same path) | v0.5.0 | 0 |

---

## U-F0.5 — Real-backend end to end — 2026-10-01

Sources:
- `docs/prompts/U1-update-2026-09-29.md` §U-F0.5;
- packio-api `v0.6.0`: its `docker-compose.yml`, its dev seed `prisma/seed/dev-seed.ts` (+ `dev-folding.ts`, `dev-corrugate.ts`), and `INTEGRATIONS_MODE=fake`.

Evidence is from `main` at `bb1fe7f`, run against a local packio-api `v0.6.0`:
- API on port 3400, worker beside it;
- database `packio_it_web`, Redis db 5, bucket `packio-it-web`;
- all isolated from the dev API on port 3000.

**User decisions (2026-10-01):**
1. `e2e:integration` is a **new launch-path suite** (`e2e/integration/`). It creates its own data on the dev seed and walks the R1 path (D-110). The existing specs stay in the mock project, because they are written against mock fixtures.
2. The storefront configurator gets a **thin adapter** onto the published `store.catalog.getConfigurator` now. U2.F1 still rebuilds the configurator, and deletes the adapter.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1 | An `e2e:integration` project runs Playwright against packio-api | missing | `playwright.config.ts` has chromium (mocks), journeys and visual; every server starts with `API_MOCKS=1` | Project `integration` (`e2e/integration/**`) with its own web server on port 3500: `API_INTERNAL_URL` = `INTEGRATION_API_URL` (default `http://localhost:3400`), no mocks. Script `pnpm e2e:integration` |
| 2 | A local backend: docker compose + `db:seed:dev` + worker, sandbox fakes on | missing | packio-api's compose (Postgres, Redis, LocalStack, Mailpit) is up on this machine; nothing in packio-web starts an API | `scripts/integration-stack.sh up / reset / down`. It takes a packio-api checkout or worktree at the lock's tag and writes the isolated `.env` (port, database, Redis db, bucket). It migrates, seeds dev, and starts the API and worker with `INTEGRATIONS_MODE=fake`. Documented in `docs/integration.md` |
| 3 | Accounts for each role on the real backend | partial | The dev seed has staff `<role>@example.invalid` with `DEV_SEED_PASSWORD`, one customer and factory F9001, but **no factory users**. Customer OTP codes stay inside the API's fake SMS sender | Global setup: staff sign in as seeded. A Partner Manager creates F9001's owner with an initial password (`factories.controller` owner endpoint), and the owner creates the other factory roles. Customers sign in with the fake Firebase verifier's readable tokens; the test gets their tokens from packio-api and plants the web's own session cookies (`pk_at`, `pk_ate`, `pk_rt` on http). Staff and factory users go through the real login forms |
| 4 | Mock-only tests tagged and kept in the mock project | partial | The chromium project is the mock project and holds every fixture-bound spec | Project separation is the tag: `integration` runs only `e2e/integration/**`, and `chromium` ignores it. A test that needs mock-only behaviour (scenario switcher, time travel, fixture codes) never goes into `e2e/integration` |
| 5 | No `CONTRACT-REQUEST` mock left in any R1 launch-path flow | partial | `/configure/[slug]` answers **500** on the real backend: the parked `store.configurator` request expects steps / size rules / print presets, while the published DTO is calculator-first. The other launch-path requests are deferred (guided help, sample kits: D-223, post-launch) or post-launch (journeys, D-219) | Configurator adapter (decision 2). `CUSTOMER_ZONE_PARKED` empties; the store request file shrinks to the deferred ones |
| 6 | Launch-path specs pass on the real backend | missing | — | Specs: <br>• staff roles and menus; <br>• storefront browse; <br>• customer sign-in; <br>• configure → instant quote → cart → checkout (bank transfer) → slip → Finance; <br>• artwork → proof → approval → production start (D-073); <br>• factory accept → milestones → QC → pack → dispatch → POD; <br>• receipt and documents; <br>• RFQ → CS quote → acceptance into the cart. <br>Mismatches are fixed here, or raised as contract requests with the failing response attached |
| 7 | PROGRESS lists what still waits on the backend | missing | — | §U-F0.5 |

## U2.F1 — Configurator v2 — 2026-10-04

Sources: `docs/prompts/U2-benchmark-2026-09-29.md` §U2.F1; packio-api `v0.13.0` (U2.1 specification model), `v0.14.0` (U2.2 Structure Advisor), `v0.17.0` (U2.3 target price, levers, outcomes) — adopted here as **`v0.41.0`**, the latest tag (one bump; 54 type errors, all in mock fixtures and one status map). Decisions D-182–D-191, D-235–D-252. Evidence is from `feat/u2.f1-configurator-v2` at `06e9f16` = `main` `026f375` + the unmerged U-F0.5 branch (`feat/u-f0.5-integration`, 11 commits: the configurator on the published `store.catalog.getConfigurator` through a thin adapter, and the integration e2e project), merged first because U2.F1 builds on that adapter. Post-launch per D-219.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 0.1 | Runs on the real contract with the U2.1–U2.3 operations | missing | `contract.lock.json` pins `v0.6.0`; `store.specs.convertDimensions`, `store.advisory.*`, `store.quotes.getLevers\|applyLever\|sendToCs\|decline`, `store.configurations.*`, `store.me.updatePreferences`, `store.catalog.getTypeTolerances` absent from `schema.d.ts` | `pnpm gen:api --adopt --tag v0.41.0`; fixtures follow the new required fields (tolerances, `devOnly`, `buyPriceNet`, `availability`, `styleCode` …) |
| 0.2 | The configurator reads `StoreConfiguratorDto` directly (user decision 2026-10-01: U2.F1 deletes the adapter) | partial | `from-contract.ts` (322 lines) mirrors the DTO as a UI type and is read by every step | Steps read the DTO; what is truly UI (which step shows which option kind, one coating list for two sides) becomes small selectors in `model.ts`; `from-contract.ts` deleted |
| 0.3 | Every instant calculator's body is its published DTO (no `CONTRACT-REQUEST` left in the flow) | partial | Folding / corrugate published (`build.ts:66-138`); label, tag & sleeve, pouch, standard product, service go as CONTRACT-REQUEST `store.quote-configurations` (`build.ts:140-168`, `requests/store-quotes.ts:35`) although `v0.41.0` publishes `Label…`, `TagSleeve…`, `Pouch…`, `StandardProduct…`, `ServiceConfigurationDto` | One builder per published DTO; the generic request retired. Standard products have no `stockProductId` in the configurator read → not instant there, routed to their stock page / RFQ (recorded) |
| 0.4 | Printing is priced | missing | CONTRACT-GAP: no print presets, so folding / corrugate parts are priced **unprinted** (`from-contract.ts:55`, `build.ts:104`) | Print step from the published `ink_colour` group: colours per side, full coverage as the CS desk sends them (`admin/cs/configuration.ts:117`), corrugate print area from `printAreas`; label `inkColourIds`, pouch `printColourId` |
| 1.1 | Unit switch mm / cm / in, display only, always send mm (D-183) | partial | `DimensionInput` converts for display (`src/ui/components/DimensionInput.tsx:14-25`); the choice is per page visit, not the user's preference | Initial unit = `StoreMeDto.displayUnit` when signed in; a change is saved with `store.me.updatePreferences` (guests: the session only) |
| 1.2 | Labelled diagram that highlights the field being edited | partial | Static `BoxDiagram` (`SizeStep.tsx:23-55`) | Diagram takes the focused axis and highlights that side and its label; flat and pouch diagrams added |
| 1.3 | Measurement-basis selector (internal / external / over-crease / product), chosen, no silent default (D-182) | missing | No basis anywhere; `SizeStep.tsx:200` says "inside size" | Basis radio cards per construction family (box / tray / sleeve: internal, external, over-crease; flat: product); nothing selected until the customer chooses; the configuration sends `basis` |
| 1.4 | All derived sizes shown live from the API's conversion | missing | — | `store.specs.convertDimensions` (debounced, with pattern + material for the caliper) → a table of every basis; `specs.caliper_missing` explained (choose a material, or enter internal) |
| 1.5 | Per-style min / max, inline specific errors | partial | Generic "สูงสุด N มม." from pattern rules (`state.ts:142-186`) | Messages name the style and the material ("สูงสุด 800 มม. สำหรับกล่องแบบนี้ กับกระดาษที่เลือก"); rules (internal mm) are compared with the API's converted internal size when another basis is entered — no client conversion |
| 2 | Product & logistics inputs (weight / piece, units / box, stacking, fragility, transport, storage), optional, plain-Thai help | missing | — | `LogisticsBlock` with D-238 inputs (`AdvisoryLoadDto`), all optional, shown where the advisor applies (D-235: corrugate; `store.advisory.getMethod.available`) |
| 3 | Structure Advisor: recommended board + reason chips, strength range with "ค่าประมาณ ไม่ใช่การรับประกัน", 2–3 alternatives (cheapest / strongest / fastest) with price and lead-time deltas; choosing re-prices; "why" sheet | missing | — | `store.advisory.recommend` when the load inputs and a priceable configuration exist; panel and alternative cards from `AdvisoryRecommendationDto` (all numbers the API's); choosing = `store.advisory.choose` with warning acknowledgement (D-240) → the material changes → live price; sheet from `requirement.factors` + `getMethod`; `store.quotes.save` carries `advisoryRecommendationId` |
| 4 | Target price: positive state at / below, levers as cards above, one-click "คุยกับทีมขาย" with context | missing | — | `targetPricePerUnit` on calculate / save / drafts; state from `calculation.target.steps`; above target: the quote is kept (sign-in) → `store.quotes.getLevers` → cards ("เพิ่มเป็น 3,000 ชิ้น → ฿x.xx/ชิ้น" from the lever's steps) → `applyLever` re-seeds the configurator from the new quotation; "คุยกับทีมขาย" = `store.quotes.sendToCs` (pre-filled RFQ, D-251) |
| 5.1 | Summary step: completeness meter, per-section edit, style code + international name, tolerances, what happens next and when | missing | The stepper's closed steps show answers (`Configurator.tsx:158-205`); no summary step | `SummaryStep`: the draft's `completenessPct` from the API when a draft exists, else sections answered; edit links; `styleCode` / `internationalName` (empty when unverified, D-184 / D-211); tolerances from the priced step (`toleranceDimensionalMm`, `toleranceColourDeltaE`, quantity) else `getTypeTolerances`; next steps with the step's lead time and ship / delivery dates |
| 5.2 | Save draft, resume, share by link | partial | Saved **quotations** reopen (`?quote=`) and share (`?share=`); no drafts | `store.configurations.create\|update` (signed in, D-185 assumption 6), `?draft=` resume, account list `/account/configurations`, share (`store.configurations.share`) → `?config=<token>` read by `getShared`; expiry shown |
| 6 | Style codes in configurator, quote PDF, order, proof, tracking | partial | API carries `style_code` as a spec line on every summary (packio-api `line-summary.ts:148,338`) and the quote PDF; rendered by cart, account quotes, order pages (`summary.specs`); configurator shows none; public tracking shows no product by D-224 | Pattern cards and the summary show the code; order / proof / account tracking already list the spec line (verified by e2e); public tracking unchanged (D-224 wins) |
| 7 | e2e (configure → advisor → alternative → lever → cart) on the real API; axe; Lighthouse app budget; no client price / strength maths (lint + review) | missing | `e2e/storefront-quote.spec.ts` (mock); `e2e/integration/storefront.spec.ts` (real, U-F0.5) | Mock e2e for every block; an integration spec on packio-api with the advisor rule set / flag the dev seed provides; axe on each new block; new blocks lazy so `/configure/[slug]` stays inside its ratchet; ESLint rule `packio/no-money-arithmetic` over the customer zone |

**Plan (slices, each a commit with green lint / typecheck / unit):** 1 contract `v0.41.0` + fixtures · 2 DTO-first model, published bodies for every calculator, print step · 3 dimensions block (basis, conversion, units preference, diagram, specific errors) · 4 logistics + Structure Advisor · 5 target price, levers, send to CS · 6 summary step, drafts, share links, account drafts · 7 style codes check, lint rule, mocks, e2e (mock + integration), axe, Lighthouse, PROGRESS · merge to `main`.

**Outcome (2026-10-04):** every row above met, except the account list of drafts (drafts carry no product slug — CONTRACT-GAP `store.catalog-product-ref`; drafts are resumed from their product's configurator). Verified on packio-api `v0.41.0` by `e2e/integration/configurator.spec.ts`. Details in PROGRESS §U2.F1.

## U3.4 wave 1 → U3.5 — Style library waves and library UX — 2026-10-04

Sources: `docs/prompts/U3-style-library.md` §U3.4 (wave 1) and §U3.5; `docs/design-tool/style-library-program.md`; `style-library-master.json` (wave 1: **41 bases, 578 variants**); packio-api `v0.41.0` (U3.B1–B6: `store.styles.*`, `store.styleFavourites.*`, assets, dieline downloads). Decisions D-184, D-211, D-212, D-241–D-246, D-266–D-274. Evidence from `main` at `8982cd6` (U2.F1 merged). Post-launch per D-219.

### U3.4 wave 1
| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1 | Every wave-1 base has engine recipes | partial | 19 of 41 bases have recipes (`recipes/data/*.json`, `base` field); missing: TE-02, FT-01, DS-01, TR-04, IN-01, IN-03, CS-06, CT-01, CT-02, CF-02, CF-05, CF-06, CF-08, CI-01, CI-02, PB-01, PB-02, PB-06, PG-01, LA-01, LA-03, TG-05 | New recipes per base (several per base where a closure pair changes the construction — packio-api picks the engine recipe whose `variantsOf` matches, `packio-dieline.engine.ts:282`) |
| 2 | Variants along the master axes | partial | 44 of 578 variants (existing recipes vary `window` / `hang` / `lid_depth` / `hand_holes` / `thumb` only) | Axes added to existing recipes and every new one; combinations that cannot be made physically (a hang tab on a panel that carries the lid) are **not** drawn and are counted apart, so the API leaves them `no_recipe` (D-243) |
| 3 | Missing modules first | missing | 16 modules `planned` (`modules/planned.ts`) | Implemented as wave 1 needs them: airplane tuck, four-flap lock, lock corners, sombrero header, tear strip, adhesive strip, vents, slit lock, body + insert, partition grid; plus open ends with thumb notches, lid windows, joints (glue / stitch / tape), tray holes, display header, platform insert, paper bag, pouch features |
| 4 | Every variant passes the U3.2 + U3.3 gates | partial | The fold gate runs each recipe's preset only (`model/fold-gate.test.ts`); no per-variant gate | A **variant gate**: every variant of every recipe builds clean (`checkDieline`), validates at its preset, and — when it folds — closes to its outer size ± 1 mm with no collision |
| 5 | Recipe data out of the initial bundle (U3.1 follow-up) | missing | Every recipe is imported by `recipes/index.ts` into `STYLES`; designer ratchet has ~0.6 KB headroom | Wave recipes live in a separate entry `@packio/dieline/library` (`LIBRARY_RECIPES`, `ALL_RECIPES`, `registerLibrary()`); the app registers them on demand; `styles:render`, the tests and packio-api read `ALL_RECIPES` |
| 6 | Names (TH/EN) per variant, pending review | partial | `AXIS_PHRASES` covers 5 axes | Phrases for every wave-1 axis value; all new wording `pending` (D-212) |
| 7 | `style-mapping.md`, `docs/design-tool/styles/*.png`, counts in PROGRESS | partial | Mapping covers the 30 F4 styles | Updated per new base; `pnpm styles:render` manifest regenerated; counts by category |
| 8 | `publishable=false` until the API confirms | met (API-side) | D-243: the API computes `publishable`; the engine has no flag | — (the library shows only what `store.styles.list` returns) |

### U3.5 library & configurator UX
| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1 | Library page: category tabs, facets, Thai/English search with synonyms, sort, favourites, compare ≤ 3 | missing | No `/styles` route; `store.styles.list|get|compare`, `store.styleFavourites.*` published (v0.16.0) | `/[locale]/styles` with the API's facets (counts), cursor paging, sort, search; favourites (signed in); compare tray (≤ 3, `store.styles.compare`) |
| 2 | Variant picker with live 3D, incompatible options disabled with the reason | missing | — | Detail page `/styles/[code]`: axis toggles from the API's publishable combinations; 3D from the engine (`registerLibrary` + recipe for the variant); an option that leads to no publishable variant is disabled with the reason |
| 3 | Style code, verified international name, instant / RFQ, size range per material on cards and detail | missing | — | From `StoreStyleCardDto` / detail (`priceMode`, `sizeRanges`, `referenceCode` only when verified) |
| 4 | Performance: virtualised grid, AVIF thumbnails with `sizes`, 3D lazy; Lighthouse marketing budget | missing | — | TanStack Virtual grid; API asset URLs through `next/image` (AVIF); 3D only on the detail page, loaded on demand; the route joins the `customer-marketing` Lighthouse set |
| 5 | SEO: one indexable page per base, structured data, Thai and English slugs, no per-size pages | missing | — | `/styles/[code]` indexable with `Product`-free `CreativeWork`/`ItemList` JSON-LD, in the sitemap; sizes never in URLs |
| — | Configurator on `explain()` / `sizeRanges()` (U3.2 follow-up) | partial | Configurator limits come from the API's pattern rules (U2.F1) | The configurator keeps the API's rules (the API owns limits); the library shows the API's size ranges |

**Plan (slices, each green):** 1 library entry point + variant gate · 2 tuck-end grid (airplane tuck, four-flap lock, lid window, hang none/sombrero) and TE-02 / FT-01 · 3 trays, sleeves, inserts, display (lock corners, open ends, platform, body + insert) · 4 corrugated (joints, vents, tear / adhesive strips, telescopes, archive / produce / pizza / lock-corner trays, partitions, pads) · 5 flexible, bags, labels, tags · 6 names, mapping, assets, counts · 7 U3.5 library list + detail + compare + favourites + SEO · 8 e2e, Lighthouse, PROGRESS · merge.

**Outcome (2026-10-04):** U3.4 rows 1–7 met — 41 / 41 wave-1 bases with recipes, 468 / 578 variants drawn (the other 110 cannot be made; reasons in `style-mapping.md`), every planned module wave 1 needed implemented, the variant gate, the library entry, names, mapping and the render manifest; row 8 stays the API's. U3.5 rows 1–3 and 5 met (`/styles`, `/styles/<code>-<name>`, `/styles/compare`); row 4 met except AVIF thumbnails on the cards — `StyleCardDto` carries no thumbnail (CONTRACT-GAP `store.styles.card-thumbnail`, request written); the grid is virtualised with no new dependency (`src/ui/components/VirtualGrid`), the 3D loads on request, and the library routes are inside the marketing budget without raising it. packio-api has to read `ALL_RECIPES` to see the wave recipes (PROGRESS).


---

## U4 — Packio 3D Studio (frontend) — 2026-10-05

Sources: `docs/prompts/U4-3d-studio.md`, `docs/design-tool/studio-spec.md`, decisions D-213–D-216, D-226, D-227, **D-275–D-286** (U4 backend). Contract: packio-api `v0.41.0` already publishes the studio (`store.studio.*` — quote, save quote, RFQ, rules, checks + acknowledgements, templates, elements + right declarations, barcode validation, order + print job, approval view, comments, share links, design service; `store.designs.patchDocument`; `store.brandKits.*`; `store.designer.getFont`; studio fields on `DesignDocumentDto`). Evidence from `main` at `6de9599`. Post-launch per D-219. Rule from the prompt: build on the F4 designer, never a second editor.

| Session | Requirement | Status | Evidence (F4 designer) | Planned change |
|---|---|---|---|---|
| U4.1 | One route `/studio/[designId]`, five reversible steps | missing | `/design/[id]` (`Editor.tsx`): one screen, a setup dialog for the box | `/[locale]/studio/[designId]` wrapping the same `Editor` (new `chrome` slots: step bar, step panel, dock); step in `?step=`, the editor stays mounted so every step keeps its state |
| U4.1 | Price dock on the quote API (debounced, cancellable, cached by spec hash, reason, VAT total, lead time, RFQ CTA) | partial | `PriceWidget` in the top bar: `store.quotes.calculate`, quantity select, gross only | `PriceDock`: signed-in → `store.studio.quote` on the saved version (D-277: `specHash`, `previousSpecHash` → reasons + unit changes; client cache by `specHash`); guest → `store.quotes.calculate` with the same configuration; RFQ types → RFQ CTA + SLA; never computes money (lint `packio/no-money-arithmetic` covers `features/customer/**`) |
| U4.1 | Studio document in the API: autosave with ETag, version counter, no local storage, offline queue, conflict dialog | partial | `usePersistence`: PUT per save under `If-Match`, 412 → conflict dialog, IndexedDB draft; guests in localStorage | Autosave becomes **JSON Patch** (`store.designs.patchDocument`, D-276) for content changes; a box change goes as a PUT with the D-275 fields (`styleVariantCode`, sizes + basis, material, print method/sides, finishes, `spec` = calculator configuration) so the dock prices it; the IndexedDB draft doubles as the offline queue (flushed on `online`). Guests keep the browser copy until sign-in (import exists) — the studio API needs an owner |
| U4.1 | Funnel events + Web Vitals | partial | `design_started` / `design_saved` (not ingested) | `studio_started`, `studio_box_confirmed`, `studio_first_artwork`, `studio_checks_clean`, `studio_add_to_cart`, `studio_ordered` ingested with `printMethod` / `styleFamily` (D-286 schema); the studio route in the vitals route list |
| U4.2 | Entry points, "describe your product", box step with print method | **met (2026-10-05)** | Setup dialog (style, size, material); configurator → `/design/new?style=…` | Every entry on `studioHref` (`/design` redirects); ① helper; ② box step; print method drives inks and the editor — PROGRESS U4.2 |
| U4.3 | Split view, face picking in 3D, guides, layers tree, undo ≥ 200, inside/outside | **met (2026-10-05)** | Face focus (double-click), snapping guides, rulers, layers panel, undo 100, 3D tab | Stage views, 3D picking, distances, layers tree, undo 200, inside printing, perf spec — PROGRESS U4.3 |
| U4.4 | Templates, brand kit, elements, data blocks, images, background, finish layers | **met (2026-10-05)** except background removal (D-284) | Template / brand / elements / uploads / background panels; QR + EAN-13 (`lib/codes.ts`) | PROGRESS U4.4 |
| U4.5 | Checks engine sharing rule ids with the API, fixes, acknowledgements, soft proof | **met (2026-10-05)** | `lib/checks.ts` (own ids), `ChecksPanel` | PROGRESS U4.5 |
| U4.6 | Order sheet, server print PDF (ADR), lock version, proof in context | partial | `OrderAction` → configurator / artwork submission; browser print PDF (ADR-0009) | U4.6 on `store.studio.order|getPrintJob|getApprovalView`; ADR number **0013** (0012 is taken by the style asset pipeline) |
| U4.7 | Share scopes, comments on 3D, versions diff, presentation, AR | partial | View-only share (D-226), version history + restore, 3D PNG | U4.7 on `store.studio.*shareLinks|comments` |
| U4.8 | Reorder library, design-service hand-off, usability, release checklist | partial | Account designs list; design service on orders | U4.8 |

**U4.1 outcome (2026-10-05):** the U4.1 rows are met (PROGRESS U4.1); guests keep a browser copy, and the RFQ pre-filled from the dock moves to U4.2 / U4.6.

**U4.1 plan (slices, each green):** 1 studio route + `Editor` chrome slots + step bar · 2 studio spec builder (box fields + calculator configuration from the product's configurator) and JSON-Patch autosave · 3 price dock (studio quote / guest calculate / RFQ) · 4 funnel events + vitals · 5 mocks (`patchDocument`, studio fields, `store.studio.quote` with `specHash` and reasons), unit + e2e (style card → studio → price → quantity → new price, axe), Lighthouse studio budget · PROGRESS · merge.

## U2.F2 — Style library & free self-service artefacts — 2026-10-05

Precedence: the library page is U3.5's (merged at `6de9599`). Only the dieline download and the spec sheet are in scope. Evidence is from `main` at `f80f1ec`.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1 | Library page (search, filters, cards, favourites, "ใช้แบบนี้") | met (U3.5) | `/styles`, `/styles/[slug]`, `/styles/compare`; `e2e/storefront-styles.spec.ts` | — |
| 2 | Free dieline download (PDF / DXF / SVG) at any configured size, no plan gate, layers explained, nudge, no paywall | missing | `store.dielines.download` is in the contract and used nowhere; the designer's own exports draw locally | A download panel under the chosen variant on the style page (sizes on a basis, material class, format; signed-in; the API's range errors and rate limit shown as given); a layer explainer; an "order this" nudge after a download |
| 3 | Packaging spec sheet on approved orders and approved samples, preview before download | missing | `store.orders.getSpecSheet` unused | A section on the order page once the artwork is approved: Thai or English, preview (the browser's PDF viewer, because the CSP forbids embedding the signed file) and download. A sample is an order, so it gets the same section once its sample is approved (`409 orders.spec_sheet_unavailable` otherwise) |
| 4 | SEO, virtualised cards, e2e for downloads | partial | SEO and virtual grid met by U3.5 | e2e for both downloads; a real-API spec (skipped on the dev seed: no published styles) |

## U2.F3 — Sample / prototype flow — 2026-10-05

Evidence from `main` at `fea0100`. The contract has the full arc (`store.samples.*`, `admin.samples.*`, `partner.samples.*`, D-253–D-257); the web used none of it.

| # | Requirement | Status | Evidence | Planned change |
|---|---|---|---|---|
| 1 | Customer: request from the configurator or a quote; sample quote card (cost, lead time, credit rule as the API states it); pay; track; approve with a checklist and evidence; on approval a pre-filled bulk order with the spec and artwork locked | missing | no sample screens; `/samples` is the sample-kit page | "ขอตัวอย่างก่อนสั่งผลิต" on each saved quotation; `/account/samples` and the detail: the arc, the sample quotation bought through the cart, the factory's evidence (sizes, material, photos with sha256), the checklist-gated approval / changes / reject, the bulk order with the locked specification and the API's credit |
| 2 | Admin: sample queue, sample vs bulk everywhere, evidence review, re-sample loop | missing | no admin sample screens; RBAC grants pinned at v0.6.0 (no `samples.*`) | `/samples` queue by status and kind, detail (quote, evidence, decision record, cancel, new sample after changes), the order page links to it; RBAC regenerated at v0.41.0 |
| 3 | Partner: sample jobs with the extra evidence | missing | — | `/samples` in the factory app ("more"): jobs to record (size, basis, material used, photos) on a phone |
| 4 | Timeline and notifications treat the sample arc as first-class | partial | notifications are the API's | the sample's own progress tracker; the order page shows its sample and that production waits for it |
| 5 | e2e customer + admin + partner, visual snapshot of the approval screen, a11y on the checklist | missing | — | `e2e/storefront-samples.spec.ts`, the `customer-samples--decision` story in the visual suite, axe on every step |
