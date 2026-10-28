# Stage C — report (web)

## C1 — products Phase 1 → 2 (web + API branch `design/products-redesign`)

Run unattended in the cloud: mock backend only (no UAT: the egress proxy refuses uat-api), no Docker/DB. Plan = PLAN.md §6 + the block's items in order; assumptions below.
API (`getpack-api`): C1-API-1 `QuoteStepDto.netAmount` · C1-API-2 `GET /v1/store/catalog/price-hints/{slug}/tiers` (R2, no calculate log, 60 s) · C1-API-3 RFQ/basket `catalogProductSlug`/`stockProductSku` + `rfqs.catalog_product_id/stock_product_id` (migration `20261222000001_rfq_product_reference`, hand-written) · C1-API-4 `StoreProductDetailDto.styles`, `StyleDetailDto.products`. Commits `594bf7e5` `0fe53a9f` `eded7c55` `9911591e`. `API-CHANGES.md` in both repos.
| Items | Status | Commits (web) |
|---|---|---|
| types + mocks (tiers, netAmount, product ref, styles↔products) | PASS | `7d5b9ce1` `ab24b75f` |
| 1 head + live search (250 ms) · 2 mode cards · 3 sticky section nav · 15 analytics | PASS | `c20da690` `27b82f2d` `60b64bf2` `95d593e2` |
| 4 quick calculator (= configurator by construction; test `calc.test.ts`) | PASS | `9811cc16` |
| 5 catalogue (all items, URL state, Back) · 6 cards · 7 price table · 8 RFQ tray | PASS | `60b64bf2` `cde50381` `05bb5973` |
| 9 pricing factors · 10 materials · 11 process · 12 services · 13 FAQ/JSON-LD/llms.txt · 14 CTA band | PASS | `95d593e2` `6ebdbb8f` |
| Phase 2: 1 product → styles · 2 style quick view → products · 3 category pages reuse the hub · 4 mapping CSV | PASS (CSV = script + header; run against UAT) | `a82626aa` |
Gates: API typecheck ✓, eslint changed ✓, unit (hints/tiers, store-step-fields, rfq, styles, catalog) ✓, contract:build + contract:lint ✓. Web typecheck ✓, eslint changed ✓, `gen:api --check` ✓, `test:app` 1562/1562 ✓, e2e (mock) `storefront-products` 5/5 (new), `storefront` + `seo` 31/32 (the one failure = `admin.localhost` DNS in this container, not C1), no horizontal scroll at 390 (grid + table + category) ✓, dark readable ✓, grep of changed customer files: no "โรงงาน"/factory counts/sample data/AI wording ✓. `pnpm build` not run (OOM). Mock workaround: in-process MSW did not intercept the BFF in 4 restarts — a standalone MSW server (same `mocks/handlers`) on :4999 served the run.
Screenshots `docs/design/screenshots/C1/`: `prototype-*`, `before-*`, `after-{1440-light,1054-light,390-dark}[-section]`, `after-1440-light-{table,rfq-tray,category,product-styles,style-quickview-products}`, `after-390-dark-{rfq-tray,table}` (mock data).
**Remaining differences vs prototype (reason):** no VAT switch (API sends only VAT-incl. figures; R3) — "ราคาที่แสดงรวม VAT แล้ว" instead · stock cards "ดูราคาตามจำนวน", no unit price (R1) · mode lines from data, not the prototype's "300–500"/"100" · a mode without items has no card/tab (mock has no services) · "ชุดพร้อมใช้", zip/ETA/shipping, quote PDF, sample kit, reorder = Phase 3 (not built) · materials: 3 columns (name, flute, approved description) — no separate "หมายเหตุ" data · payments without "ผ่อนชำระ" (DECISIONS §3) · FAQ answers rewritten where the draft claimed figures the data does not back (MOQ, 5–10 days, ผ่อนชำระ, company name per GLOBAL-RULES §5) · square chips/no pills (design-language tests) · real images, not drawn illustrations · LINE hours from `support-channels.hours` (none → no hours) · services: every one the API lists, not 3.
**Content for business review:** `products.json` keys in `src/features/customer/products/content.ts` (FAQ ×8, factor texts, included/excluded, process copy, payment list, mode descriptions).
**Open questions:** (1) `partial` availability → instant (assumed) (2) stock items in the RFQ tray (kept, as the prototype) or cart only? (3) services: all from data or staff pick 3? (4) out-of-stock stock items: no badge today — show "สินค้าหมด"? (5) R1 stock "starting from" basis quantity (6) R3 ex-VAT figures for the switch (7) LINE hours into `support-channels.hours` (09:00–18:00 decided, not in config on UAT) (8) tax-invoice company name in the FAQ should come from settings — keep as content? (9) tray "account persistence" = the draft basket line once each item's form is filled (no tray API) — enough? (10) materials "หมายเหตุ" column source.
**Local checks for the owner:** getpack-api `pnpm db:migrate` + `pnpm test:int` (RFQ + basket submit with a product ref, tiers vs calculate) · deploy API branch, then set `FEATURE_RFQ_PRODUCT_REF=1` · `pnpm build` · e2e against the real API: `storefront-products`, `storefront`, `storefront-quote` (RfqForm) · run `pnpm tsx scripts/product-style-gaps.ts --api <UAT>` and send the CSV to the business team · check the calculator on UAT (tiers + a non-default print; price = configurator) · Lighthouse mobile on `/products` · 1024/1180 header widths (shared header, unchanged).

## C4 — configurator Phase 1 (branch `design/configurator-redesign`; API repo branch of the same name)

Gate: lint, typecheck, 1512 tests, build pass; no horizontal scroll at 390 px (mock + UAT); dark readable. **e2e not run** (no Docker in this
cloud session): several specs expect the old accordion and were edited blind — `storefront-quote` (phone), `storefront-account`
("ใบเสนอราคา" button), `configurator` / `repeat` / `samples` / `order-to-cash` ("จำนวนอื่น" / "ดูราคา", "เบอร์มาตรฐาน") — **run them locally**.
API (getpack-api, `8048743` + `8ac64a2`): new `POST /v1/store/quotes/actions/calculate-batch` (≤ 24 variants, baselineKey → server-side signed deltas,
20/min/client, same pricing path as `calculate`, writes only what `calculate` writes). 48 unit tests, contract regenerated; **no DB-backed test run** — run
`price-consistency`, `studio-quotes`, `target-price`, `spec-model`, `price-hints`, `style-library`, `phase4-contract` (docker). The API branch was created from
`fix/uat-phase0` (no `design/styles-catalog-redesign` exists in the API repo). `contract.lock.json` is still the unreleased 0.75.0 pin.
| Items | Status | Commits |
|---|---|---|
| 1 layout · 2 step chips · 3 preview + dimensions panel · 10 standards/next steps · 11 sticky summary | PASS | `aa5f5d3f` `c1e4e1a0` `b279b365` `40ac755d` `03d53b4f` |
| 4 size cards · 5 material cards · 6 print cards · 7 quantity cards (batch-priced, API deltas) | PASS | `20899168` `9ffddcd2` `bf6c8d67` `61e590a5` |
| 8 shipping · 9 design paths · 12 URL state · 13 analytics | PASS | `7677406f` `ee5da431` `9bd83fab` `a6f6e1ab` |
Extras: regenerated types (`e5f0b179`, `83ebe6b2`), VAT label without a hard-coded rate (no rate in the response), copy for `artwork.order_unpaid`, empty price slots collapse when the API has no batch endpoint.
Acceptance: card price = summary price after selecting (test, mock) · one batch request per state change (test) · design defaults to the API's option, "มีไฟล์งานแล้ว" only with `?design=own_file` (test) · no raw i18n keys.
**`calculate` budget: 30 of 30 used** (all UAT, `uat-postal-box-b`, size 00 140×97.5×60 inside, KA125 B, front = 1 ink, back none; page loads 1054/1440/390 ×2 runs, postcode 10110 (once +CMYK outside), size F 450×300×220 at qty 100/300/500/1000 → 100 = "quote", 300 = ฿116.51, 500 = ฿103.13, 1000 = ฿86.70; default spec ฿15.70 at 100–500, ฿13.61 at 1000). Last run hit the cap, so the postcode-priced summary (shipping line) is unverified on UAT.
Screenshots `docs/design/screenshots/C4/`: `prototype-*`, `before-*`, `after-{1054-light,1440-light,390-dark}` (UAT), `after-1440-postcode-4colour[-view]`, `after-1440-quote-only[-view]` (UAT), `after-mock-{1440-light,390-dark}-{top,full}` (mock: shows the batch-priced cards).
**Remaining differences vs prototype (reason):** option-card prices/deltas absent on UAT (the live API has no `calculate-batch` yet; empty slots collapse) — shown on the mock · no "ประหยัด x%" (API sends no saving figure) · material one-line notes empty (none approved; prototype lines are sample copy — missing: KA125 B, KT125 B, KA185 B, KA125 E) · no shipping zone name / arrival range (response has `earliestDeliveryDate` only; summary shows the province from the postcode lookup) · "แก้ฟรี 3 ครั้ง" omitted (no data) · sample checkbox shows no date impact (service returns none) · no print-area illustration (none exists) · "VAT" label without the rate (API sends only the amount) · chips square, no pills and no gradients (design-language tests) · unit toggle keeps ยาว×กว้าง×สูง (prototype switches order) · real photos not illustrations · tier cards use the repo's RadioCards.
**Open questions:** VAT rate for the label · saving % from the API? · approved material descriptions (4) · shipping zone name + arrival range in `calculate` · postcode in account preferences · free revision count source · upload-before-cart flow still absent (copy says upload after ordering) · "ค่าเริ่มต้น" clears on any press in a step — only on a real change? · `calculateBatch` lists `accept-language` as a required header (contract quirk) · `deliveryPostcode`/`targetPricePerUnit` not in the batch body.
**You must check:** run the touched e2e specs and the API's docker specs; deploy the API branch to UAT and re-take the three UAT shots (price/delta on every card, acceptance equality); verify the shipping line with a postcode; the design step on a hired/own-file product; 390 px sticky bar vs bottom nav + LINE button; keyboard through the chips and cards.

## C0 — ข้อมูลที่ทำให้หน้าเต็ม (web `design/styles-catalog-redesign`; API branch of the same name, new)

Run unattended in the cloud (mock backend only, no UAT data, no Docker/DB). CSV import skipped (owner: CSV not ready). Plan = the block's steps in order; every assumption below.
| Item | Status | Commits (web / api) |
|---|---|---|
| API catalogue commercial fields (fit range mm, MOQ, recyclable, plastic-free, certifications) + admin `commercial` + migration (+down) | PASS (no DB run) | api `4de29d2` |
| Fit rule `size=LxWxH` (+5 mm, L/W rotate), `meta.sizeSearchStyles`, card `fitRange`/`moqUnits`/`dielineUrl`/`fit` | PASS | api `4de29d2` · web `95312b34` `d14fcc0a` |
| Starting price = D-220/D-441 hint (StorePricingService at default spec, ฿15.70 method) — verified; refresh added for print limits, product-type, imports, margin floor, VAT rounding | PASS | api `1582e1f` |
| Cards/quick view: starting price (already there), spec row from new fields, "ใส่ได้", "ขนาดภายในแนะนำ", MOQ, eco | PASS | `d14fcc0a` `95312b34` |
| Wizard (flag `FEATURE_STYLES_WIZARD`, off) via API `useCase` groups | PASS, 2 of 3 steps | api `0ae3725` · `1c6259ea` |
| Dieline hover (real `dieline_svg` only) + legend "เส้นทึบ = ตัด · เส้นประ = พับ" | PASS (no data yet) | `d14fcc0a` |
| `/packaging/[slug]` ×8, JSON-LD, canonical, sitemap, llms.txt, "เลือกตามการใช้งาน" (flag `FEATURE_PACKAGING_LANDINGS`, off) | PASS, copy slots empty | `43c2d0c0` `8dc5a84c` |
| Trust section from `style-library.settings`, hidden when empty, "รูปงานจริงระหว่างผลิต" | PASS (hidden: no content) | `2bf774ea` |
| Studio spot colours never trimmed silently: warning + "เปลี่ยนเป็น CMYK" / "เพิ่มจำนวนสี" (C8 can skip) | PASS | `6af1bdf3` |
| Prototype match + screenshots `docs/design/screenshots/C0/` (prototype / after × 1440 L, 1054 L, 390 D; quick view fit; wizard) | PASS (mock) | `d6c599c2` |
VAT: `src/common/money/vat.spec.ts` (API) includes ฿5,178.00 → ฿338.75 and ฿4,710.00 → ฿308.13 — both present and passing.
Gates: API typecheck ✓, eslint changed ✓, unit (styles, pricing/hints, vat) 24 ✓, contract:build + contract:lint ✓. Web typecheck ✓, eslint changed ✓,
`gen:api --check` ✓, `test:app` 1532/1532 ✓, e2e (mock, dev server) `storefront-styles` 8/8 (new size-search spec), `storefront-studio` + `-design` 6/6 ✓,
no horizontal scroll at 390/1054/1440 ✓, dark readable ✓, grep of changed customer files: no "โรงงาน"/factory counts/sample data/AI wording ✓. `pnpm build` not run (OOM here).
**Excluded from size search / estimates (missing data):** all 122 styles — the fit-range and MOQ columns are new and empty until the business enters them
(admin `commercial` or the CSV). Estimates for quote-only styles: none (D-220 "never an estimate"); only instant styles with a hint show "เริ่มต้น ฿x/ใบ".
**Remaining differences vs prototype (reason):** no "ราคาประมาณ ฿a–b" / tier table on quote styles (D-220) · wizard has no budget step (needs prices for quote styles) and is off ·
"ใส่ได้" sits first in the badge row, not top-end (collides with "ราคาทันที · แนะนำ" on 3-column cards) · no lead time on cards (not in the card DTO) ·
trust tiles, landing intros/FAQ hidden (no approved content) · no hover dieline in the mock (no rendered `dieline_svg`; the engine drawing is the card picture) ·
VAT switch and "ทำต่อจากครั้งก่อน" belong to other phases · square chips, no pills (design-language tests) · real images, not illustrations.
**Open questions:** (1) May approved recipe size ranges (81/122 complete on UAT) seed the fit range until the CSV, or business data only? (2) CSV size basis: inside mm (assumed) ·
(3) Amend D-220 for quote-style estimates, and from what source? (4) Budget step mapping once prices exist · (5) Wizard place → use-case mapping taken from the prototype
(ship = shipping/ecommerce, shelf = retail/branding, gift = gift/luxury, serve = food/snack) — confirm · (6) Landing slugs → use cases (mailer-boxes = shipping) and the
approved 300–600-word intros + FAQs (`packagingPages.<slug>.intro/faq` in `styles.json`) · (7) Trust content (certificates with numbers, food-grade docs, photos, permitted logos, tax note) ·
(8) Real `dieline_svg` renders per style · (9) "เพิ่มจำนวนสี" on corrugate (print model fixes the side): team quote? — today only the warning shows there.
**Local checks for the owner:** `pnpm db:migrate` (migration `20261221000001_style_commercial_fields`, hand-written) + `pnpm test:int` + `pnpm test:e2e` in getpack-api ·
`pnpm build` in web · e2e against the real API (`storefront-styles`, studio specs) · enter fit ranges for a few styles and check the size tab appears ·
turn both flags on in UAT to review wizard and landings · Lighthouse mobile on /styles and /packaging/* (flag on).

## C0b — owner decisions after C0 (web + API `design/styles-catalog-redesign`, 2026-10-28)

Run unattended in the cloud (mock backend, no UAT/DB/Docker). Decisions recorded as DECISIONS-STAGE-A §9 (both repos).
| Item | Status | Commits (api / web) |
|---|---|---|
| 1 Fit ranges from approved recipes: audited idempotent backfill via the curation path, source `recipe`/`business`, admin action + `pnpm styles:fit-ranges` + UAT seed step 4b; migration `20261223000001_style_fit_range_source` (hand-written) | PASS (no DB run) — seed data: **81 of 122 filled**, 41 without a complete recipe range | api `d03c9023` |
| 2 CSV size columns = inside mm: recorded (§9.2, API-CHANGES) | PASS (docs; importer not built) | — |
| 3 No estimates: "ขอราคาได้ ทีมงานตอบภายใน {n} วันทำการ" from `quoteResponseBusinessDays` (`rfq.sla_business_hours`, none → no time) on card, quick view, style page; RFQ path unchanged; no budget step | PASS | api `d03c9023` · web `2d1b6ea6` |
| 4a Dielines from the vendored engine at default size (base `dieline_svg` in `styles.render_assets` → card hover + "แบบคลี่") | PASS — 113 of 122 drawable; none for PK-LA-07, PK-PB-01…08 | api `d03c9023` · web `2d1b6ea6` (mock) |
| 4b Draft landing copy ×8 (TH+EN, 4–6 FAQs, `status: draft`, noindex, no FAQ JSON-LD/sitemap/llms until `approved`) | PASS — for owner review | web `8932de06` |
| 4c Trust: tax-invoice note only (D-010, D-125); `TRUST-CONTENT-CHECKLIST.md` | PASS | web `8932de06` |
| 5 Corrugate colours beyond the instant price → quote path (configurator keeps them, dock "ขอใบเสนอราคา"; Studio "เพิ่มจำนวนสี" → quote link); `catalog.print_limits` untouched | PASS | api `d03c9023` · web `8ac447f0` |
Gates: API typecheck ✓, eslint changed ✓, unit (styles, print-model, pricing) 265 ✓, contract:build + lint ✓. Web typecheck ✓, eslint changed ✓, `gen:api --check` ✓,
`test:app` 1537/1537 ✓, e2e (mock) `storefront-styles` 8/8, `storefront-studio` + `-design` 6/6, `storefront-configurator-v2` 7/7 ✓. `pnpm build` not run (OOM).
Copy to review: `src/i18n/messages/{th,en}/customer/styles.json` → `packagingPages.<slug>` (cake-boxes, mailer-boxes, gift-boxes, cosmetic-boxes, food-boxes, fruit-boxes,
apparel-boxes, tea-coffee-boxes); generator facts only (approved material texts §8, fit rule §4, D-072/D-153/D-186/D-010). Approve = set `status` to `approved` in both locales.
Thai intros ≈1,850–2,200 characters (≈350–450 Thai words); English 390–470 words.
**Open questions:** (1) `rfq.sla_business_hours` has no value on UAT/seed → no timing shown until Admin sets it; the API converts hours ÷ 24 rounded up (RFQ due time counts
every hour of a working day) — use `calendar.business_hours` (9 h/day) instead? (2) the CSV template's size headers say `*_cm` but the decision says mm — rename to `*_mm`?
(3) CMYK + extra spot colours on corrugate is also offered as a quote (up to the offered spot inks) — confirm, or spot-only? (4) Trust tile wording (default, D-010/D-125)
— approve or replace via settings (`store.style-library.settings` is still a contract request; no back-office editor yet). (5) Admin style workspace has no commercial-field editor.
**Local checks for the owner:** getpack-api `pnpm db:migrate` + `pnpm test:int` + `pnpm test:e2e` (`dieline-downloads` adds a style-dieline case) · `pnpm styles:fit-ranges` (dry run, then
`--confirm`) on UAT, or `pnpm uat:styles --confirm` · let `styles.render_assets` run, check card hover / "แบบคลี่" · set `rfq.sla_business_hours` and check the quote message ·
web `pnpm build` · e2e against the real API (styles, studio, configurator) · configurator corrugate: pick 2 spot colours → "ขอใบเสนอราคา" with `calc`.
