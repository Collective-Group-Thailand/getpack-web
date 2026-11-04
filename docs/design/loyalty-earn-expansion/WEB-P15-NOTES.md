# Web P1.5 notes — deals surface

Branch `feat/loyalty-p15-deals-surface` (getpack-web). Contract: `API-CHANGES-P15.md`. Design: `DESIGN-NOTES.md`
(P1.5 section), `prototypes/p15-*.html`, `screenshots/P15/`. Nothing pushed or merged.

## 1. What was built

| Piece | File |
|---|---|
| Ticket primitive (vertical/horizontal, `notch` both/end, `edge` plain/stamp, tones; mask cut-outs, border concentric with every cut) | `src/ui/components/Ticket.tsx` (+ `design-language.test.ts` allows its radial-gradient *masks* only) |
| DealCard (grid ticket, compact row, featured, phone hero; six states + automatic), `CodeBox`, `CopyCodeButton`, `MiniStub`, `useDealStub` | `src/features/shared/deals/DealCard.tsx` (shared: the admin preview uses it) |
| The web's own deal rules (stub wording, days left, state, featured, picker order and row state, decimal compare) | `src/features/shared/deals/model.ts` |
| Save a deal (`store.promotions.save`) | `src/features/shared/deals/useDealSaves.ts` |
| Contract requests (zod) for the 6 store operations + admin hero image; admin display fields as a schema | `src/lib/api/requests/store-deals.ts`, `admin-promotions.ts` (+ registry, `awaiting-triage.ts`, 5 rows in `docs/contract-requests.md`, `contract-requests.openapi.json`) |
| MSW: 9 fixture deals (1 hidden, 1 ended — never served), per-persona saves, applicable / not-yet codes from the cart's product types, ladder with a deal hint; admin PATCH publish guard + hero image | `mocks/store/deals.ts`, `mocks/store/deals-fixtures.ts`, `mocks/admin/marketing.ts`; BOX10 / FREESHIP / LABEL8 added to the mock `checkCode` |
| `/deals` | `src/app/[locale]/(storefront)/deals/page.tsx`, `features/customer/deals/{DealsHeader,DealsView,DealsGuide,TypeSelect}.tsx` |
| `/deals/[slug]` | `src/app/[locale]/(storefront)/deals/[slug]/page.tsx`, `ShareLink.tsx` |
| SEO | `features/customer/deals/seo.ts` (`Offer`, `ItemList`), `lib/seo/structured-data.ts` (`offerSchema`), `FAQPage` on both pages, canonical + hreflang, `noindex,follow` on filtered views and `?ref=` links, `/deals` + each shown deal in `app/sitemap.ts` |
| Home strip (3 tickets + "ดูดีลทั้งหมด", hidden without deals) | `features/customer/deals/HomeDeals.tsx`, wired after the trust row in `app/[locale]/(storefront)/page.tsx` |
| PDP deal box in the price field + VolumeLadder replacing the quantity cards | `features/customer/deals/{DealPromoBox,VolumeLadder}.tsx`, `features/customer/catalog/pdp/PdpBuyBox.tsx` |
| Configurator deal box (in the dock's price field) | `features/customer/configurator/{Configurator,ConfiguratorDock}.tsx` |
| Cart coupon picker (inline ≥ 768 px, sheet below; manual entry kept) | `features/customer/cart/{CouponPicker,CartCoupons}.tsx`, `CartView.tsx` |
| `/liff/deals` (segmented, featured, rows, ticket sheet, share/wallet bar) | `app/[locale]/liff/deals/page.tsx`, `features/customer/deals/LiffDeals.tsx`; a link from `/liff/points` |
| `?ref=` attribution cookie | `src/lib/attribution/deal-ref.ts`, `src/proxy.ts` |
| Wallet empty state → `/deals` | `app/[locale]/(storefront)/account/wallet/page.tsx` |
| Admin "การแสดงผลบนหน้าดีล" tab | `features/admin/marketing/{PromotionDisplay.tsx,promotion-display.ts}`, `PromotionEditor.tsx` (tabs via `?tab=display`) |
| `src/ui` extensions | `Checkbox` `stretch`, `Sheet` `appearance="bare"` + `SheetClose` |
| Copy | new namespace `deals` (customer + admin zones), `marketing.promotion.{tabs,display}`, `account.wallet.seeDeals` — th + en |
| Stories | `Ticket.stories.tsx`, `DealCard.stories.tsx` (6 states + automatic, compact, rows, featured, hero), `CouponPicker.stories.tsx`, `VolumeLadder.stories.tsx` (`.storybook/main.ts` gains the two customer folders) |
| Tests | `model.test.ts` (order, max codes, conflict both ways, stub, days left), `CouponPicker.test.tsx`, `HomeDeals.test.tsx` (hidden strip), `seo.test.ts` (JSON-LD shape), `deal-ref.test.ts` + 2 proxy cases (ref cookie), `deals-mocks.test.ts` (hidden never served, `?ref` echo, save 409); `PdpBuyBox.test.tsx` follows the ladder |

### Routes

| Route | Notes |
|---|---|
| `/deals` | `?tab=all\|for_you\|ending_soon\|points`, `?type=<productTypeCode>`; tabs with a zero count are not offered; "สำหรับคุณ" only when signed in |
| `/deals/[slug]` | 404 when the API does not show it (hidden, unlisted is the API's call, ended) |
| `/liff/deals` | LIFF sign-in like the other LIFF pages |
| `/marketing/promotions/[id]?tab=display` | admin |

## 2. Contract assumptions (API-CHANGES-P15)

- Built through the contract-request layer exactly as P1; after `pnpm gen:api --adopt --tag <release>` the registry
  test names the 7 requests to retire. The admin `PATCH /v1/admin/promotions/{id}` is published, so its new
  `visibility`/`display` fields are a schema merged at one call site with a single cast (CONTRACT-REQUEST
  `admin.promotions.display`) and read back with `safeParse` (missing = hidden, no copy).
- **Pricing ladder before a quotation exists:** the contract leaves it to the API; the web asks
  `GET /v1/store/pricing/ladder?calculationId=&quantity=` with `QuoteCalculationDto.calculationId`. The PDP ladder
  rows are the calculation's own steps (same figures by construction); only `promoHint` is read from the endpoint.
  `GET /v1/store/quotations/{quotationId}/ladder` is defined and mocked but not used by a screen yet (the quote page
  is not part of P1.5); the repo's store path is `/quotes/{quoteId}`, so getpack-api may rename it.
- **`GET /v1/store/promotions/{slug}` takes `?ref=`** too (share links land on the detail); the list's `?ref=` is
  as specified.
- `myStatus: "used"` carries no date, so the "ใช้แล้ว" chip has none. `notEligibleReason` codes are mapped to copy
  (`first_order_only`, `min_quantity`, `min_order_value`, `product_type`, `segment`, `usage_limit`, else a generic
  line).
- `benefit.kind` covers percent / amount / free_shipping / points_multiplier only. A free finish ("เคลือบด้านฟรี")
  has no kind; ask getpack-api for a word value (e.g. `kind: "word"`, `value` = the display text) before Marketing
  publishes such a deal.
- `maxCodes` is read from the cart / applicable-codes (D-452); the guest FAQ words it without a number.
- The applicable-codes response has no benefit figure, so each picker row's stub comes from the public list
  (`promotionId` → `benefit`); a personal coupon shows the ticket mark.
- No "ประหยัดรวม" total in the picker: the API gives savings per code and the web never adds money; the checkout
  shows the combined discount.
- The `?ref=` cookie is `pk_deal_ref`, 30 days, httpOnly, first-party, codes `[A-Z0-9]{6,12}` (the agent link's
  shape); it is separate from the 90-day `pk_agent` claim cookie (D-417). Whether a deal link should also start the
  agent claim is an open question.

## 3. Gate results (Linux VM against the Mac's `node_modules`)

Native binaries: rolldown and esbuild from `$HOME/linuxbind` as in P1; for the visual check only, Tailwind's oxide
and lightningcss Linux builds were unpacked into `$HOME/twbind` (outside the repo, `NODE_PATH` +
`NAPI_RS_NATIVE_LIBRARY_PATH`). Nothing was installed into the repo.

| Gate | Result |
|---|---|
| `tsc --noEmit` (whole repo) | **SKIPPED** — > 170 s here |
| `tsc` on all 66 changed TS/TSX files and their import graph (temporary config incl. `vitest.setup.ts`; verified it reports a planted error) | **PASS** |
| ESLint on every changed file + `.storybook/main.ts` | **PASS** (0 problems; 5 `react-hooks/purity` findings fixed with `readNow()` / a lazy state) |
| Prettier `--check` on every changed TS/TSX/JSON | **PASS** |
| Vitest: new tests (6 new files, 27 tests, plus 2 proxy cases) | **PASS** |
| Vitest: `src/i18n`, `src/ui`, `src/lib`, `mocks`, `src/app`, `src/proxy.test.ts`, `features/shared`, `features/customer/{deals,cart,catalog,configurator,account,checkout,home,liff}`, `features/admin/marketing` — 117 files / 936 tests | **PASS** (`src/app/server-imports.test.ts` failed once when run beside ~25 other files under load — 7 s against a 5 s default timeout — and passes alone in 2.7 s; not touched by this change) |
| `gen:api` + `gen:api --check` | **PASS** (19 request paths, was 12) |
| `tokens:check`, `contrast` (165 pairs × 3 themes) | **PASS** |
| Wording grep (`โรงงาน|factory|กำไร|margin|coming soon|ทันที|countdown`) on new customer/public/LIFF files, messages and prototypes | **PASS** (only CSS `margin` in the prototypes) |
| Real components rendered to static HTML with the compiled Tailwind CSS (DealCard states, featured, hero, rows, picker, ladder) | done → `screenshots/P15/p15-components-real-{1440,390}.png` |
| Storybook build, `next build`, e2e, Lighthouse, page-level visual compare | **SKIPPED** — need the Mac (Next SWC, browser, API/MSW server) |

## 4. Commands for the owner (Mac)

```sh
cd getpack-web   # on feat/loyalty-p15-deals-surface
pnpm install
pnpm gen:api:check
pnpm typecheck && pnpm lint && pnpm test
pnpm tokens:check && pnpm contrast
pnpm storybook   # Customer/Deals/DealCard (6 states, compact, featured, hero), Data/Ticket, Customer/Deals/CouponPicker, VolumeLadder
pnpm build
pnpm dev:mock    # MSW: 7 shown deals, one hidden and one ended never served
#   http://localhost:3000/deals                        (desktop grid; resize to 390 for hero + rows)
#   http://localhost:3000/deals?tab=ending_soon         (LABEL8)
#   http://localhost:3000/deals/box10-corrugated?ref=AGT12345   (cookie pk_deal_ref set; canonical without ?ref)
#   http://localhost:3000/                              (strip after the trust row)
#   http://localhost:3000/products/<a corrugated product>  (deal box in the price field, ladder)
#   http://localhost:3000/cart                          (signed in, a corrugated item: picker; 390 → sheet)
#   http://localhost:3000/liff/deals                    (tap a row → ticket sheet)
#   http://admin.localhost:3000/marketing/promotions/<id>?tab=display
pnpm e2e
pnpm lhci        # lighthouse/customer-marketing.json now includes /deals — check the JS ratchet on / and /deals
# Visual compare, prototype vs page, at 1440 and 390 (light; then 390 dark — the tickets follow the tokens):
#   prototypes/p15-deals.html        vs /deals
#   prototypes/p15-deal-card.html    vs Storybook Customer/Deals/DealCard
#   prototypes/p15-pdp-ladder.html   vs a product page
#   prototypes/p15-cart-coupons.html vs /cart
#   prototypes/p15-liff-deals.html   vs /liff/deals
# When getpack-api publishes P1.5:
pnpm gen:api --adopt --tag vX.Y.Z   # registry.test.ts lists the 7 requests to retire; drop the PATCH cast
```

## 5. Deviations and open issues

1. **Configurator ladder.** The configurator keeps its own quantity cards (they already show the API's price and
   "ประหยัด x%" per tier); it gains the deal box only. The VolumeLadder replaces the quantity cards on the PDP.
2. **Amber on the PDP.** STITCH-NOTES §c took an amber "มีโปร" badge; D-486 keeps amber for the one "ดีลเด่น" badge,
   so "มีโปร" is a small solid `primary` label inside the price field.
3. **FAQ block** uses the repo's `DisclosureList` (bordered) instead of the prototype's hairline rows.
4. **Spent stub contrast:** `subtle` on `neutral-subtle` (the decided mapping) is below 4.5:1; the used state is
   informational, the "ใช้แล้ว" chip carries the meaning. Confirm or switch the stub text to `muted`.
5. **Home JS budget:** the strip adds the DealCard client code to `/`; run `pnpm lhci` — if the ratchet trips,
   render the strip's tickets without the save action (server-only).
6. **Header navigation:** no "ดีล" link was added to the site header or the LIFF tabs (not in the brief); /deals is
   reached from the home strip, PDP, wallet, share links and `/liff/points`.
7. Admin report columns (`views`, `saves`, `uses`, `refAgent`) and the quote-recovery screens are not in this web
   slice.
8. Storybook stories render `Link` from `@/i18n/navigation` under Vite (as P1): not verified here.

## 6. Integration (2026-11-04, getpack-api `feat/loyalty-p15-deals-surface` 107949ee)

- **Contract.** `contract/openapi.json` is the API branch's regenerated document, pinned unreleased in
  `contract.lock.json` (commit 107949ee, still labelled 0.75.0 / v0.75.0 so `verifyLock` passes, as the D-462/D-463
  pin was). `pnpm gen:api` regenerated `schema.d.ts`, the MSW examples/problems and `problem-codes.ts`. Re-adopt with
  `pnpm gen:api --adopt --tag vX.Y.Z` once the API tags the release. The pin also brings main's D-463 follow-ups
  (`carrierBooked`, partner POD `receiverRecorded` without the name or tracking number, `without_goods_receipt`,
  `factoryCode`/`factoryName` on admin POs and statements, the P1 `earn_*` ledger types); their mocks and the partner
  ship page follow, and the ledger has labels for the new entry types.
- **Adopted (generated client).** All ten P1 + P1.5 request entries are retired from the registry,
  `awaiting-triage.ts` and the open table of `docs/contract-requests.md` (moved to "Resolved"; the two ladder
  entries were published differently as one operation): `store.loyalty.tasks`,
  `getPackagingProfile` / `updatePackagingProfile`, `store.promotions.listPublic` / `getPublic` / `save`,
  `store.cart.applicableCodes`, `store.quotes.ladder`, `admin.promotions.update` (`visibility`, `display`) and
  `admin.promotions.setHeroImage`. Types are aliases of `Schemas` in `features/shared/deals/types.ts` and
  `features/customer/account/loyalty-types.ts`; no contract request is left for P1/P1.5.
- **Ladder.** `GET /v1/store/quotes/{quoteId}/ladder` reads a saved quotation (owner or `?anonymousId`), and
  `?quantity` must be one of its options. The configurator passes the quotation it kept this visit (with the
  advisor's `anonymousId`) and asks only when the quantity in view is one of its options; a lapsed one (409
  `quotes.not_live`) just hides the hint. The PDP keeps no quotation, so its deal box shows the deal without the
  hint; its VolumeLadder rows stay the calculation's own steps. `estimatedTotal` may be null (no estimate line).
- **Errors.** Save: 409 `promotions.already_saved` marks the card "เก็บแล้ว" with a "เก็บไว้แล้ว" toast;
  `promotions.not_saveable` has its own toast. Admin editor: the guard applies to `unlisted` too; 422
  `promotions.not_publishable` lists each `errors[]` rule under the preview (in the panel's words, the API message
  for an unknown rule); 409 `promotions.slug_taken` sits under the slug field. th/en problem copy added.
- **Money.** Applicable-code `saving` is ex-VAT: the picker shows it with "ก่อน VAT" / "before VAT" (the cart's
  pre-VAT wording); nothing is converted on the web.
- **Stub.** `tiered` = "ลดสูงสุด" + the top tier (percent, or ฿ for an amount); `perk` = the word "สิทธิพิเศษ"
  (special price, free design / mock-up / revision rounds, bonus points). `benefit.value`, `terms` and `subline` are
  nullable now; a missing figure falls back to the perk word. `notEligibleReason` adds `new_customer_only` /
  `returning_customer_only`. The admin preview maps every `PromotionBenefitType` the same way.
- **Hero image.** Upload through `uploadFile(..., "image")`, then `setHeroImage { heroImageFileId }`; the response
  is the `PromotionDto` (its `heroImageUrl` is shown and the cached promotion replaced).
- **MSW.** Handlers for the adopted operations are plain `http.*` in the generated shapes: tiered, perk and an
  unlisted fixture (served by its slug only), `saving` ex-VAT with `stacking` / `onCart`, `notYet.promotionId`,
  the ladder by `quoteId`, the plural error codes, the admin guard as 422 `errors[]` + 409 slug, and the hero image.
- **Decisions.** D-487 copied verbatim from getpack-api `docs/decisions.md` after D-486.
- **Gates** (Linux VM, `$HOME/linuxbind` esbuild + rolldown): `gen:api --check` PASS; `tsc` on every changed file,
  the files that read the changed shipment/finance/promotion schemas and their import graph (≈330 files, temporary
  config, removed) PASS — it reported the 39 contract errors first; ESLint on the 42 changed TS/TSX files 0 problems;
  Prettier PASS; Vitest `src/lib/api` (registry, mocks, deals mocks), `mocks`, `src/i18n` (problem copy, keys,
  parity), `features/{shared/deals,customer/deals,customer/cart,customer/account,admin/marketing,customer/catalog/pdp,
  customer/configurator,admin/logistics,admin/customers,admin/finance,shared}`, `src/app` PASS
  (`server-imports.test.ts` timed out once under load, passes alone). Whole-repo `tsc` not run (> 170 s here).
