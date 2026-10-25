# /products "สินค้าและราคา" redesign: Phase 0 plan (A9b, web)

Status: Phase 0 (discovery, no code). Branch of record: `fix/uat-phase0`. Phase 1 branch: `design/products-redesign`,
stacked on the styles branch (`design/styles-catalog-redesign`, B1). GLOBAL-RULES.md wins on every conflict.

Sources read: `PROMPT-products-redesign.md` (Shared context + phases), `GLOBAL-RULES.md`, `MASTER-RUN-ORDER.md`,
the prototype (grep only), the web code listed below, `src/lib/api/schema.d.ts` (getpack-api 0.75.0), and
read-only GETs against UAT (`https://uat-api.getpack.co`, 2026-10-25). I also read four getpack-api files from a
read-only shallow clone: `price-hints.service.ts`, `quotes.controller.ts`, `quote-engine.service.ts` and
`docs/launch/PERFORMANCE.md` with `perf/k6/targets.js`. **Nothing was POSTed to UAT, so `calculate` was not called
and its latency was not measured.**

---

## 0. What exists today (baseline)

| Area | Today | Files |
|---|---|---|
| `/products` hub | SSR. One search box, a grid/list toggle, category tiles on page 1, then two separate blocks: catalogue products (24 per page, `LinkPagination`) and a stock shelf (8, page 1 only). JSON-LD: BreadcrumbList, CollectionPage, ItemList of categories. No VAT switch, no buying modes, no calculator, no RFQ tray. HTML is about 951 KB (about 794 KB of it is RSC payload, 151 KB gzipped). | `src/app/[locale]/(storefront)/products/page.tsx`, `src/features/customer/catalog/{ProductGrid,CategoryTiles,ProductSearchForm,LiveSearch,PriceHint,cardFacts}.tsx`, `ordering.ts` |
| `/products/[key]` | One segment resolves a category (`CategoryView`: chips `instant,rfq,moq100,fast,promo`, sort `recommended,price,fastest`, server-side filter over `perPage:100`), a catalogue product (`ProductView`) or a stock product (`StockProductView` + `StockOrderPanel`). | `products/[key]/page.tsx`, `catalog/resolve.server.ts`, `CategoryView.tsx`, `ProductView.tsx`, `StockProductView.tsx`, `StockOrderPanel.tsx`, `stock-cart.ts` |
| Data access | `publicApi(lifetime)` with Next data cache (catalogue 300 s, prices 60 s, content 900 s), no token. | `catalog/api.server.ts` |
| Instant pricing | `POST /v1/store/quotes/actions/calculate` through the BFF (`browserApi()`), debounced 400 ms (`useLivePrice`), TanStack keyed by body. The body comes from `buildCalculateBody(configurator, initialState(configurator, seed))`. **It already sends several quantities in one call** (`state.quantities`, 1 to 10 tiers). | `configurator/pricing.ts`, `build.ts`, `state.ts`, `defaults.ts` |
| Configurator deep link | `/configure/[slug]` seeds from `?qty`, `?size` (standard size code), `?ink` (front ink option ids, comma list, or `none`), `?pattern`, `?material`, `?l&w&d`, `?design`, `?from` (`seedFromDesign`). A non-instant product redirects to `/rfq/[category]?from=slug`. | `configure/[slug]/page.tsx`, `configurator/state.ts` `seedFromDesign` |
| RFQ | A single RFQ (`POST /v1/store/rfqs`) and a **multi-item basket** (D-301: `…/rfq-baskets/draft`, `…/draft/items`, `…/draft/actions/submit`, at most 20 items, one RFQ per item, one conversation). Both need sign-in. Items are added one at a time from `RfqForm` ("add to basket"). Pages: `/rfq/[category]`, `/rfq/basket`, `/account/rfq-baskets[/id]`. | `features/customer/rfq/RfqForm.tsx`, `rfq/basket/*` |
| Stock to cart | `StockOrderPanel` prices with `calculate` (`standard_product`, `stockProductId`, `quantities:[q]`), then `POST /v1/store/quotes` → `POST /v1/store/cart/items`. Sign-in is required. | `catalog/stock-cart.ts` |
| Analytics | `track()` sends a closed list of funnel events to getpack ingest. The /styles events go to GTM `dataLayer` through `trackCatalog` (`styles/catalog-events.ts`, CONTRACT-REQUEST `store.analytics.catalog-events`). | `src/lib/analytics/*`, `styles/catalog-events.ts` |
| i18n | `src/i18n/messages/{th,en}/customer/catalog.json` (`price.onRequest` = "ราคาตามสเปก", `card.availability.{instant,partial,rfq}`). There is no `products` namespace yet. | |
| /styles code today (an earlier redesign; styles B1 of this run has NOT happened) | `LibrarySearch` (live search with `router.replace`, 160 ms), `SortSelect`/`LibraryControls`, `LibraryViews` (view toggle as links), `CompareTray` + `compare-store` (bottom tray, per-browser storage in try/catch), `LineFloat` (LINE button from `support-channels.lineOaId`, hidden when unset), `QuickView`, `FilterSheet`, `trackCatalog`, `query.ts` (URL state helper), `ProductCard` slots in `src/ui`. There is **no** VAT-switch helper, no `design-tokens.css` in the app and no new header. Those are B1 deliverables. | `src/features/customer/styles/*`, `src/ui/components/ProductCard.tsx` |

---

## 1. Prototype section → files → reused components

New feature folder: `src/features/customer/products/` (customer zone; may import `catalog`, `configurator`, `rfq`,
`styles` helpers, `src/ui`). Copy goes into a new `products` i18n namespace (th default, en) and must be registered in
the zone-namespace test. Draft content (FAQ, included/excluded, warranty text, material notes) goes into
`src/features/customer/products/content.ts` (or a `products.content` i18n block), marked `BUSINESS-REVIEW`.

| # | Prototype section (state) | New / changed files | Reuses |
|---|---|---|---|
| 1 | Page head: breadcrumb, H1, lede, search (debounced 250 ms), "{n} รายการ · {m} หมวด", VAT switch | `app/.../products/page.tsx` (rewrite), `products/HubHead.tsx`, `products/HubSearch.tsx` | `Breadcrumbs`, `LibrarySearch` pattern (replace on typing), `Switch` + **B1 VAT helper** (not built yet), `JsonLd` |
| 2 | Mode cards ×4 (toggle filter and scroll; 1 column at 640 px) | `products/ModeCards.tsx`, `products/modes.ts` (mode derivation + data lines) | `Badge`, `Icon`, `compareDecimal` (min price without arithmetic) |
| 3 | Sticky section nav (IntersectionObserver highlight, horizontal scroll on mobile, sits under the header at 58 px on mobile) | `products/SectionNav.tsx` (client island) | B1 header height token |
| 4 | Quick calculator (product picker → quantity presets + custom → print chips → result: unit price, VAT breakdown, bars, lead time, MOQ, warranty, CTA, notes). Prototype-only states: zip, ETA, shipping, PDF button (Phase 3) | `products/QuickCalc.tsx` (lazy, `next/dynamic`), `products/calc-body.ts` | `configurator/build.ts` `buildCalculateBody`, `state.ts` `initialState`/`seedFromDesign`, `pricing.ts` `calculate`/`useDebounced`, `PriceSummary`, `SegmentedControl`/chips, `Skeleton`; CTA → `/configure/[slug]?qty&ink&size&from=products` |
| 5 | Catalogue: mode tabs with counts, category chips (only those in the mode), sort (4), grid ↔ table toggle, "แสดง x จาก y" + "โหลดเพิ่ม" (15), empty state "หมวดนี้ยังไม่มีสินค้าในหน้านี้" | `products/catalogue.server.ts` (merge + filter + sort + page), `products/query.ts` (URL `mode,cat,q,sort,view,page`), `products/CatalogueToolbar.tsx`, `products/LoadMore.tsx` | `styles/query.ts` pattern, `SortSelect`, `LibraryViews` (links), `ordering.ts` (`orderCards`, `sortCards`, `compareDecimal`), `EmptyState`, `Tabs`/`SegmentedControl` |
| 6 | Card (4:3 image, badge only instant amber / stock green, category, 2-line name, price block, meta, action; equal heights) | `products/HubCard.tsx` (thin over `ProductCard` slots) | `ProductCard`, `ProductPicture`, `cardFacts` (price, assumes, MOQ, lead time), `images.ts` |
| 7 | Price table (thumb+name, หมวด, วิธีซื้อ pill, ราคาเริ่มต้น (รวม/ก่อน VAT), ที่จำนวน, ขั้นต่ำ, ระยะผลิต, action; own horizontal scroll) | `products/PriceTable.tsx` (lazy) | `DataTable` (or a plain table in `src/ui`), `Badge` |
| 8 | RFQ tray (floating: count, "ส่งคำขอราคา", "ล้าง"; toast "เพิ่มในใบขอราคาแล้ว" / "นำออกจากใบขอราคาแล้ว") | `products/rfq-store.ts` (localStorage in try/catch, like `compare-store.ts`), `products/RfqTray.tsx`, `products/RfqToggle.tsx` | `CompareTray` layout + `LineFloat` offset rule, `Toast`, `rfq/basket/*`, `RfqForm` "add to basket" |
| 9 | ราคาคิดอย่างไร (4 factor SVGs + included/excluded) | `products/HowPricing.tsx` (static SVG) + content file | tokens only |
| 10 | วัสดุกล่องลูกฟูก (table + flute SVG, link "เปรียบเทียบวัสดุทั้งหมด" → `/materials`) | `products/MaterialsTable.tsx` | configurator `optionGroups[kind=material]` of the instant products (see gaps), `MaterialSwatch` |
| 11 | ขั้นตอนและระยะเวลา (4 steps + payment pills) | `products/ProcessSteps.tsx` | footer `storefront.paymentMethods` string (single source today) |
| 12 | บริการเสริม (service link cards) | `products/ServiceLinks.tsx` | catalogue cards with `productTypeCode = service` |
| 13 | FAQ accordion + FAQPage JSON-LD + llms.txt | `products/HubFaq.tsx`, `app/llms.txt/route.ts` (add block) | `DisclosureList`, `faqPageSchema` |
| 14 | CTA band ("ขอใบเสนอราคา", "คุยทาง LINE" + hours) | `products/CtaBand.tsx` | `LineFloat` / B1 LINE button, `support-channels` |
| — | Prototype only, NOT Phase 1: bundles (`#bundles`), sample kit, zip/ETA/shipping, quote PDF dialog, re-order line | — (Phase 3, behind flags) | `calculate` already returns `earliestDeliveryDate` / `shippingAmount` with `deliveryPostcode`; `quotes/{id}/actions/request-pdf`; reorder suggestions (D-288) |
| — | Mobile 390 dark | tokens via B1 `design-tokens.css`; grid 2 columns at ≤640 px, tray text 13 px, LINE button icon only | B1 |

---

## 2. Data gap table (UI needs vs API today)

Legend: **A** = available as is · **D** = derivable in the web without money arithmetic · **M** = missing (API or
business data). UAT figures are from 2026-10-25.

### 2.1 Catalogue facts (hub, cards, table, modes)

| UI element | Source today | Status | Notes / UAT reality |
|---|---|---|---|
| Item list over ALL items | `GET /v1/store/catalog/products` (42) + `GET …/stock-products` (101) | **D** | 143 = 42 + 101. `perPage` max 100 (200 → 422), so stock needs 2 pages. Merge in the Next server (3 cached GETs, 300 s), like `CategoryView` does with `perPage:100`. |
| Category of a card | catalogue `productTypeCode` → `product-types[].categoryCode` → `product-categories` | **D** | Stock DTO has no type or category. `price-hints` reports `standard_product` for every SKU, and `stock-products?category=` works. 14 categories (including `service` and `standard_product`). |
| Buying mode per item | `availability` (`instant`/`partial`/`rfq`) + `productTypeCode` + endpoint | **D** | instant = `availability !== "rfq"` (`cardGroup`), service = type `service`, quote = other rfq, stock = stock endpoint. UAT: instant 5, quote 32, stock 101, service 5. `partial` appears 0 times; mapping it to instant is an open question. |
| Mode counts / "{n} รายการ · {m} หมวด" | merged list | **D** | 143 · 14. |
| Instant card price "เริ่มต้น ฿x /หน่วย · ที่ 300 หน่วย" | `startingPricePerPiece` + `startingPriceAssumes.quantity` (card) or `price-hints` | **A** | 15.70 / 33.83 / 198.92 / 123.06 / 136.65, all at 300, VAT incl. **A3 owns** the reconciliation (฿14.79 / ฿15.70 / ฿17.26). |
| Min instant price per mode card | min of `startingPricePerPiece` via `compareDecimal` | **D** | ฿15.70. |
| MOQ per item | catalogue `moq`, stock `minOrderQty` | **A** (catalogue 17/42 null) | catalogue: 100×5, 300×2, 500×15, 3000×3, null×17. Stock: 1 to 2000. |
| MOQ per mode card | min/max of the above | **D** | The data does **not** match the prototype copy: quote 300–3,000 (prototype "300–500"), stock from 1 (prototype "100"; `public-config.minOrderQty.readyStock = 1`). Use the data. |
| Lead time per item | catalogue `leadTimeDays` | **A** for instant only | rfq 37/37 null → hidden. Stock has no lead-time field (**M**, hide). |
| Process step tag "ราคาทันที 5–10 วันทำการ" | `product-types[corrugated].leadTimeDays` {5,10} | **D** | |
| **Stock real unit price** (today "ราคาตามสเปก") | `price-hints?skus=` | **M** | The API hard-codes `startingFromPerPiece: null` for every stock product (`price-hints.service.ts`: "waits for `stock_product_price_summaries`"). A stock price exists only per quantity through `POST calculate` (standard_product), which a list cannot call per card. **API change needed** (see §2.4 R1). Until then the card shows a neutral label (not "ราคาตามสเปก", which is wrong for stock): a proposed i18n string "ดูราคาตามจำนวน" with the link to the stock page where `StockOrderPanel` prices. Business review. |
| Stock availability badge "พร้อมส่ง" | `inStock` | **A** | 3 of 101 are out of stock → no badge (open question: show "สินค้าหมด"?). |
| Images | catalogue `imageUrl` (42/42), stock `imageUrls[0]` + `images[].variant.alt` | **A** | Real API images. No AI hints. |
| Unit label | catalogue: none on card (configurator `unit`); stock `unit` | **D** | Instant card unit = "ชิ้น" via the configurator `unit` (piece). Add an i18n map of `ProductUnit`. |
| Ex-VAT figures (VAT switch OFF) | — | **M** | Every store price is VAT-inclusive (`startingPricePerPiece`, `unitPrice`, `productAmount`). The web may not do money arithmetic. The open request `store.styles.price-ex-vat` covers only `StylePriceDto`; it must be extended to `StoreProductCardDto.startingPricePerPieceExVat`, `PriceHintDto`, and `QuoteStepDto.unitPriceExVat`/`productNetAmount`. Ownership: **B1 VAT helper**. Until then the switch is hidden and every price says "รวม VAT". |
| Server-side filter / sort by mode, price, MOQ, lead time | — | **D** (in Next) / **M** (API) | The list API takes only `q, productType, category, page, perPage, sort?`. `sort=price` is accepted but does not order by price (a null-price service came first). Phase 1 filters and sorts in the Next server over the merged ≤ 200 rows. The open request `store.catalog-product-facets` is the long-term fix. |
| Search | `q` on both endpoints | **A** | |
| Category chips "only present in the mode" | merged list | **D** | Stock: only `standard_product`. Stock `attributes[type]` gives 12 sub-types (an option for later). |

### 2.2 Calculator

| UI element | Source | Status | Notes |
|---|---|---|---|
| Instant product list (picker) | cards with `availability !== "rfq"` + `GET …/products/{slug}/configurator` (public, cacheable) | **A** | 5 corrugated products on UAT. Each configurator GET ≈ 0.8 s from this container (network bound). Cached 300 s server-side. |
| Quantity presets [100,300,500,1000,2000,5000] | `configurator.quantity.presets` | **A** | All 5 products return exactly these presets. `min` 100, `default` 300, `maxTiers` 10. Do not hard-code them. |
| Custom quantity ≥ MOQ | `configurator.quantity.min/max` | **A** | |
| **Tier prices** for the bars | `calculate` with `quantities: presets` → `steps[]` | **A via POST** / **M as a cacheable read** | One call returns one `QuoteStepDto` per quantity (1 to 10). No GET/cached tier table exists. |
| **Print options** ("พิมพ์ 4 สี / ดำ 1 สี") | configurator `optionGroups[kind="ink_colour"]` | **A for 2/5** | postal-box-b and fruit-box-tele: `ดำ` (default) + `พิมพ์ 4 สี (CMYK)`. white-mailer, moving-carton and produce-tray have **no ink group**, but their hint spec says "พิมพ์ 4 สี (CMYK)". Hide the chips when there is no group. Business/data question. |
| **Print-option pricing** | — | **M** | No per-option delta exists (good: no fake multiplier). Each print choice is its own `calculate` (6 quantities in it). The prototype `.88` multiplier is fake and must not ship. |
| Reference spec line | `startingPriceAssumes.specs` / `PriceHintDto.basis.specs` | **A** (text) | One UAT label leaks "[DEV] ฝา · พิมพ์ด้านนอก" (fruit box): UAT data hygiene. Label order "กว้าง × ยาว × ลึก" differs from the global "ยาว × กว้าง × สูง" (A3 spec-label helper). |
| **Reference configuration as ids** (to price exactly what the card's "เริ่มต้น" shows, and to deep-link the CTA) | — | **M** | The hint/card gives text only. `initialState` takes `standardSizes[0]` + default material + **default ink `ดำ`**, while the reference is CMYK. A live calculator from defaults would show a different number at 300 than the card. This is the A3 mismatch class, and A3 owns it. Needed: `reference: { sizeCode, patternId, optionIds[], printArea }` on the hint (§3). |
| Unit price / VAT breakdown (ก่อน VAT · VAT 7% · รวม) | step `unitPrice`, `productAmount`, `vatAmount`, `grossAmount` | **A** inc-VAT / **M** ex-VAT | `vatAmount` covers all amounts (product and shipping). Without a postcode, shipping is pending, so `grossAmount − vatAmount` would still be arithmetic. Needs `productNetAmount` (or the B1 helper decision). |
| Lead time, earliest ship/delivery | step `leadTimeDays`, `earliestShipDate`, `earliestDeliveryDate` | **A** | Phase 3 ETA reuses these (no second holiday helper in the web). |
| Tolerances note | step `toleranceOveragePct`/`ShortagePct`, `toleranceDimensionalMm`, `toleranceColourDeltaE` | **A** | Show from data; link `/guarantee` (`GET /v1/store/guarantee` A). |
| Tooling line (flexo plates/die) | step `toolingAmount` | **A** | Must be shown when > 0. Corrugate flexo charges it apart, so the "unit price" alone understates the total. |
| CTA prefill | `/configure/[slug]?qty=&ink=&size=&from=products` | **A** | `seedFromDesign` already supports these. |
| "รับประกันงาน" fact | `/v1/store/guarantee` | **A** | |

### 2.3 RFQ, content, config

| UI element | Source | Status | Notes |
|---|---|---|---|
| **Multi-item RFQ** | `rfq-baskets/draft/items` (≤ 20) + `draft/actions/submit` | **A** (D-301) | Sign-in required. Each item needs `productTypeCode`, `quantities` (≥ 1 tier) and `spec` valid against `rfqSpecSchema` (UAT forms: 0 fields, dims optional). |
| Which **product** an RFQ line is for | — | **M** | `RfqBasketItemInputDto` / `SubmitRfqDto` carry only `productTypeCode`. The `?from=slug` of `RfqForm` is shown but **not sent**. A tray of "กล่องไปรษณีย์ X + ถุง Y" would reach CS as two bare types. Needed: `catalogProductSlug` / `stockProductId` on the basket item (contract request). |
| Guest tray persistence | localStorage (try/catch) → on sign-in, push to the basket | **D** | Account persistence = the draft basket itself, but only once items have quantities. |
| Stock items in the RFQ | — | open | Stock is instantly purchasable (`StockOrderPanel`). The prototype puts it in the RFQ. Decide (open question 3). |
| Materials table (code, flute, use, note) | `GET /v1/store/catalog/materials` | **M** (404 on UAT; CONTRACT-REQUEST `store.catalog-materials`) | Derivable subset: configurator `optionGroups[material]` (name, `gsm`, `caliperMm`, `flute` — the flute code on UAT is "DEV-B"). "เหมาะกับ"/"หมายเหตุ" are draft content (business review). |
| Payment methods | i18n `storefront.paymentMethods` | **A** (copy, not API) | "ผ่อนชำระ" vs D-111 (card instalments are R2): confirm. |
| LINE id / hours | `support-channels` → `lineOaId: null, hours: null`; `public-config.supportHours: null` | **M on UAT** | The decided 09:00–18:00 (GLOBAL-RULES §6) is not in config. Hide the LINE CTA and hours while null (no hard-coding). |
| FAQ | content file (8 Qs, business review); `GET /v1/store/catalog/faqs` exists (4 groups) | **A/D** | Draft answers contain claims to verify: MOQ per category (data says pouch 3,000), "ผลิต 5–10 วันทำการ", the tax-invoice company name (must be บริษัท คอลเลคทีฟ กรุ๊ป (ประเทศไทย) จำกัด), "ผ่อนชำระ". |
| Price lock days | `public-config.priceLockDays` = 15, configurator `quoteValidityDays` 15 | **A** | |
| Bundles, sample kit, quote PDF, reorder, ETA, shipping | — | Phase 3 | `store.sample-kits` was deferred by decision (D-223) → hide. |
| Analytics `products_*` | — | **M** in ingest | Send through a `trackProducts` (GTM `dataLayer`) like `trackCatalog`, or the B1 analytics wrapper. Add the names to the `store.analytics.catalog-events` request. |

### 2.4 API requests to file (contract-requests.md, at Phase 1 start)

- **R1 `store.price-hints.stock`**: `PriceHintDto.startingFromPerPiece` + `basis.quantity` for `stock_product`
  (it is unblocked by `stock_product_price_summaries`, U-B6).
- **R2 `store.price-hints.tiers`** (the calculator endpoint, §3).
- **R3 `store.prices.ex-vat`**: extend `store.styles.price-ex-vat` to the card, hint and step DTOs.
- **R4 `store.rfq-baskets.product-ref`**: `catalogProductSlug?` / `stockProductId?` on `RfqBasketItemInputDto` and
  `SubmitRfqDto`, echoed on `RfqBasketItemDto`.
- **R5**: reuse `store.catalog-product-facets` (mode/availability filter, `sort=price|moq|leadTime`, counts) and
  `store.catalog-materials`.

---

## 3. Calculator feasibility (< 300 ms via BFF for 6 presets)

**Not measured**: `calculate` is a POST and UAT is read-only for this run. The answer below comes from the contract
and the code.

What the contract allows:
- `CalculateQuoteDto.configuration.quantities` takes **1 to 10 quantities**, and the response holds one `QuoteStepDto`
  per quantity. So the 6 presets need **one request per (product, print option)**, not six.
  The configurator already does this.
- The API's own load target (getpack-api `perf/k6/targets.js`, `docs/launch/PERFORMANCE.md`) is
  **calculate p95 < 800 ms** at peak (catalogue < 300 ms). Nothing promises < 300 ms.
- Each call is uncached. It runs the engine per quantity × candidate price path and **writes a `calculate_logs` row**
  (`quote-engine.service.ts`). It has no `specHash` cache (that cache exists only for the studio quote, D-277). The
  BFF adds a hop (browser → Next `/bff` → `API_INTERNAL_URL`).
- From this container every UAT GET took 0.8–1.5 s. That is network/proxy bound and says nothing about server time.

Verdict: a live `calculate` per chip change **cannot be relied on for < 300 ms** (the budget is 800 ms p95). There is
also a correctness gap: the web cannot build the card's reference configuration (no ids), so the numbers would not
match "เริ่มต้น ฿x ที่ 300".

**Smallest endpoint that can** (R2): extend the existing, cached price hints instead of adding a new calculator
path.

```
GET /v1/store/catalog/price-hints/{slug}/tiers          (public, Cache-Control max-age=60, ETag)
→ {
    key, computedAt, currency: "THB",
    reference: { sizeCode, patternId, materialOptionId, printArea, inkOptionIds[] },   // ids for the CTA deep link
    specs: SpecLineDto[],                                                               // as basis.specs today
    prints: [{ inkOptionIds[], nameTh, nameEn, isReference }],                          // front-ink choices priced
    tiers: [{ inkKey, quantity, instant, reason, unitPrice, unitPriceExVat,
              productAmount, productNetAmount, vatAmount, toolingAmount, leadTimeDays }]
  }
```

- Computed by the **same** `PriceHintsService.refresh` job that already prices the reference configuration
  (hourly + `price_list.version_approved` + product events). It uses the product's `configurator.quantity.presets` ×
  its front-ink options, through `QuoteEngineService` (the single pricing service, GLOBAL-RULES §5). There is no
  second formula. Stored next to `catalog_price_hints`.
- A cached GET reaches < 300 ms through the BFF/Next data cache easily, and the 5 products × 2 inks × 6 quantities
  are prefetched with the page (or on the first visible frame of the lazy calculator).
- A custom quantity outside the presets falls back to one debounced `calculate` (400 ms, as today), shown with an
  "กำลังคำนวณ" state and never mixed with another product's price (`useLivePrice` already guards this).
- Acceptance "calculator = configurator": a test seeds `/configure` from `reference` + `qty` + `ink` and expects the
  same `unitPrice` as the tier row.

Phase 1 fallback if R2 is not shipped: render the calculator section **behind a flag (off)**. If the business wants it
on earlier: one `calculate` per (product, print) with `quantities = presets`, from the configurator defaults,
labelled with **its own** spec line (from the configurator choices, not the card's reference). In that mode the bars
and the card price may differ until A3 lands. Report it, and do not ship that mode without A3.

---

## 4. Risks

1. **Prerequisites not built**: header, tokens, VAT helper, LINE button and analytics wrapper are B1 (styles Phase 1).
   Products Phase 1 must not fork them. If B1 slips, Phase 1 is blocked or must stub behind the B1 interfaces.
2. **VAT switch vs "no money arithmetic"**: an ex-VAT view needs API figures (R3). Hide the switch until then. Do not
   divide by 1.07 in the UI.
3. **Price consistency (A3)**: the card "฿15.70 ที่ 300" (reference CMYK) vs the configurator default (black ink) vs
   other pages. Any calculator number before A3 + R2 risks a mismatch on the same page.
4. **RFQ line loses the product** (R4). A multi-item tray without it sends CS only product types. Submit stays behind
   a flag until R4 ships, or until the business accepts type-only lines.
5. **Mixed sources for sort/paginate**: two endpoints, `perPage ≤ 100`, merged in the Next server. This is fine at 143
   items, but it does not scale past a few hundred and costs 3–4 cached GETs per cold render. R5 is the fix.
6. **Payload weight**: the current `/products` RSC payload is about 794 KB. A 15-item first batch, a lazy calculator
   and a lazy table are required to meet LCP < 2.5 s on mobile. Measure before and after.
7. **UAT data hygiene**: "[DEV]" in a spec label, `dev-`/`uat-` slugs and codes, flute "DEV-B". Five instant products
   are all corrugated, so the calculator has a narrow scope (no folding carton or labels instant on UAT).
8. **Copy vs data**: prototype mode lines ("300–500", stock "ขั้นต่ำ 100"), FAQ MOQ claims and "5–10 วัน" differ
   from the data. They must be rendered from data or marked for business review.
9. **Factory confidentiality**: `inStock` means "some supplying factory has stock". Never phrase it as a factory fact.
   Use "ราคาตามสเปก" / "ฝ่ายผลิต" wording only.
10. **Rate limits**: anonymous `calculate` has rate-limit headers. A fallback calculator that refires on every chip
    could hit them. Debounce and cache by body.

## 5. Open questions (for the business / API owner)

1. Stock unit prices: when will `stock_product_price_summaries` (R1) publish a "starting from" figure, and at which
   basis quantity (MOQ? 100?) and delivery basis?
2. Calculator: approve R2 (tier table on price hints), and which print options per product. Three of five instant
   products have no ink group but a CMYK reference spec.
3. Stock in the RFQ tray, or "สั่งซื้อ" (cart) only? Stock is instantly purchasable today.
4. RFQ lines without a product reference (R4): accept type-only lines in the meantime, or keep submit behind a flag?
5. Guest RFQ tray: is sign-in at "ส่งคำขอราคา" acceptable (the basket requires an account)? And what quantity does a
   line carry when it is added from a card (none, MOQ, or asked in the tray)? I propose asking per line in the tray
   and defaulting to empty, never MOQ silently.
6. `partial` availability ("บางสเปก"): which mode? (0 items on UAT.)
7. Out-of-stock stock items (3): show "สินค้าหมด", hide, or keep them listed without the badge?
8. Service cards: the prompt says 3 cards. UAT has 5 services (graphic, mockup, plate, structure design, die block).
   Show all from data (my default), or let staff choose 3?
9. LINE id and hours are null on UAT. Hide the CTA (my default), or put the decided 09:00–18:00 into
   `support-channels.hours`?
10. "ผ่อนชำระ" in the payment list (D-111 lists card instalments as R2). Keep it?
11. Is the VAT switch default ON site-wide (prompt) with R3 pending? Until R3, is a VAT-inclusive-only label
    acceptable?
12. The materials table needs `store.catalog-materials` (404 on UAT). Is a 5-instant-product subset from configurator
    options acceptable for Phase 1, with use and note text as business-reviewed content?

## 6. Ordered task list for Phase 1 (after B1 and A3; one commit each)

0. File R1–R5 in `docs/contract-requests.md`, add MSW mocks marked `// CONTRACT-REQUEST` for R2/R4, and add the
   `products` i18n namespace (th/en) plus the content file marked `BUSINESS-REVIEW`.
1. `products/catalogue.server.ts`: merge catalogue + stock (paged reads, cached), mode derivation, counts,
   filter/sort/paginate (15), with unit tests (modes, counts, sort nulls last, `compareDecimal`).
2. `products/query.ts`: URL state `mode,cat,q,sort,view,page` (defaults omitted, replace on typing, push on tab), with
   tests (parse/serialise, back button).
3. Page head: breadcrumb, H1, lede, live search 250 ms, totals, VAT switch through the B1 helper (hidden until R3),
   JSON-LD BreadcrumbList + ItemList.
4. Mode cards with data lines from §2.1 (min instant price, MOQ ranges from data); toggle and scroll.
5. Sticky section nav (client island, `aria-current`, reduced motion).
6. Hub card + grid (equal heights, badges instant/stock only, stock neutral price label until R1), load more.
7. Price table view (lazy) with VAT-labelled header.
8. RFQ tray: `rfq-store` (localStorage try/catch), toggles on cards and rows, tray, toasts. Submit → sign-in → per-line
   quantity → basket items → `/rfq/basket`. Submit behind `products.rfqTray.submit` until R4 (or approval of
   type-only lines). Tests: persistence, storage throwing.
9. Quick calculator (lazy, flag `products.quickCalc`, off until R2 + A3): picker, presets from the configurator,
   custom quantity ≥ min, print chips only from the `ink_colour` group, result from tiers (inc VAT; ex-VAT via R3),
   tooling line, tolerances, warranty link, CTA deep link `?qty&ink&size&from=products`. Test: tier = configurator
   price for the same inputs.
10. ราคาคิดอย่างไร (static SVG + content), วัสดุ (configurator material subset or R5 materials; link `/materials`),
    ขั้นตอนและระยะเวลา (+ payment copy), บริการเสริม (service cards from data).
11. FAQ (content file) + FAQPage JSON-LD + llms.txt block; Product JSON-LD with VAT-inclusive offers for instant items
    (`productSchema`).
12. CTA band + LINE (hidden while `lineOaId` is null).
13. Analytics `products_*` through `trackProducts`/B1 wrapper (dataLayer, consent-gated).
14. QA gate: 360/390/1440, dark, header 1024/1054/1180/1440, keyboard/aria, Lighthouse mobile ≥ 90, payload check;
    `/products/[category]`, `/products/[slug]`, cart, checkout and RFQ unchanged (e2e smoke).
