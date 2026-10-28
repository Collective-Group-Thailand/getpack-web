# /styles redesign: Phase 0 plan (A9a, rerun)

Status: **draft, awaiting approval** · Phase 0 (discovery, no code) · branch `fix/uat-phase0` @ `77443193` · 2026-10-25
Rules applied: `docs/design/GLOBAL-RULES.md` (wins over the pack), `PROMPT-styles-redesign.md` "Shared context", repo `CLAUDE.md` and `docs/decisions.md`.
Evidence: the code on this branch; read-only GETs against UAT (`https://uat-api.getpack.co`, 2026-10-25: all 122 styles, list and detail); and a production build of this branch at `localhost:3001` measured with Playwright (GET-only routing, no forms sent).


> **Orchestrator note (2026-10-25).** The `localhost:3001` build measured in §2 was the one left by the e2e run
> (`pnpm e2e` builds with `playwright.config.ts` env, which sets `NEXT_PUBLIC_ASSISTANT: "1"`). So the assistant
> button in the measurements is a test-build artefact, not evidence that UAT/prod builds ship it (open question 2
> stands only as "confirm the deployed build has it off"). The English overlap does not depend on it: §2.2 shows
> English overlaps with the assistant off too.

---

## 0. Where this branch already is (read first)

This is the **second** Phase 0 for this pack. The first one ran on 2026-10-25 against the earlier pack. Its Phase 1 commits are already in this branch's history: `b262ecf1` (plan), `ff79d267` (contract requests), `e7162b6e` (header), `211ad2de` (URL state v2 + facet grouping), `0f5eb02b` (`instant` tone), `d45549b5`, `593e1519`, `a4033e17`, `abcf0e92`, `e72116dc`, `0a9c7ccd`, `ac672465`, `b6395e9f`, `abbad1b2`, `38402845`. Commit `f3a4036c` ("update doc redesign") then **deleted** the old `PLAN.md` and `PHASE-1-REPORT.md` and revised the pack: VAT default ON with one shared helper, LINE id from `NEXT_PUBLIC_LINE_OA_ID`, GLOBAL-RULES §1 confidentiality, and the account-menu labels.

So this plan works from **what exists, plus what the revised pack and GLOBAL-RULES change**. It is not a greenfield plan. Per MASTER-RUN-ORDER, Phase 1 (B1) runs on `design/styles-catalog-redesign`, created from `fix/uat-phase0`. That branch does not exist yet, locally or on the remote.

The decisions approved in the old plan (§0.1 there: C1–C10, f1–f4) are **not restated as approved here**. Wherever the revised pack or GLOBAL-RULES now says something different, the conflict is listed again in §1 for a fresh decision.

---

## 1. Conflicts that need a decision before Phase 1

| # | Revised pack / GLOBAL-RULES says | Repo / decision / API says (verified) | Recommendation |
|---|---|---|---|
| C1 | **VAT**: switch default ON = VAT-inclusive; OFF = ex-VAT. ONE shared price-display helper for /styles, /products and product pages, with one rounding rule (GLOBAL §5, "fixes ฿338.58 vs ฿338.75") | `StylePriceDto.unitPrice` = "per piece **incl. VAT**" (D-220/D-247). `PriceHintDto.basis.includesVat` is a flag, so product hints can be either basis. No style DTO has an ex-VAT figure. CLAUDE.md forbids money arithmetic in web, and `no-money-arithmetic.test.ts` enforces it | Build the shared helper as **formatting + labelling only** of API figures (`{ amount, includesVat }` → "฿x รวม VAT" / "ไม่รวม VAT"). The switch renders only when the API sends both figures (open request `store.styles.price-ex-vat`). The rounding rule belongs in the single pricing service (A3/A4 own it). The helper must never round or derive |
| C2 | Compare tray "up to 4"; toast when exceeding 4 | **D-246: 3**. UAT `GET /v1/store/styles/compare?codes=a,b,c,d` → **422 `arrayMaxSize` ("no more than 3")**. Web reads `compareLimit` from settings and falls back to `COMPARE_LIMIT = 3` | Keep 3 (copy "เลือกแล้ว x/3"). 4 needs D-246 amended **and** an API change |
| C3 | Phase 2: "ราคาประมาณ ฿a–b/ใบ" from the real pricing engine/estimate fields; the CSV has `price_est_*` | **D-220**: no reference config or no instant path → no hint, "**never an estimate**" | Product owner: amend D-220 or drop estimates. Until then the card shows "เริ่มต้น ฿x/ใบ" (instant with a hint) or "ขอใบเสนอราคา" |
| C4 | Fonts: Anuphan + IBM Plex Sans Thai + IBM Plex Mono via `next/font` | ADR-0001: self-hosted, Anuphan is the one UI face, JetBrains Mono for codes, ≤ 180 KB of fonts | Keep ADR-0001. IBM Plex only via a new ADR |
| C5 | Tokens from `design-tokens.css` (brand `#17573F`/`#56BC91`, radius 8/12/16); GLOBAL §5 makes styles Phase 1 the owner of "tokens" | Theme tokens in `src/ui/tokens/*` (ADR-0003): primary `#0F5F4E`, radius 10/14/16; `instant` tone already exists (light/dark/HC, contrast-tested) | Map onto existing tokens. Write a short mapping table (prototype token → repo token) into `src/ui/tokens/README.md` so later packs reuse it. Re-skinning the brand would be a separate, site-wide reviewed change |
| C6 | URL `view=all`, `page`; `/packaging/[slug]` landing pages | D-410: `view=variants`, cursor pages (`meta.nextCursor`); landing pages exist at `/styles/for/[useCase]` and `/styles/options/[topic]` | Keep D-410. Read `view=all` as an alias of `view=variants`. Add `page` only if the API adds offsets. Grow `/styles/for/*` instead of a second route tree |
| C7 | Multi-select facets, OR within a group | `GET /v1/store/styles` takes **one value per facet**; no `meta.total` | Keep `MULTI_VALUE_FACETS = false` until `store.styles.multi-facets` ships (the UI and URL already carry lists) |
| C8 | Analytics events via the existing lib; GLOBAL §5: styles Phase 1 owns the **analytics wrapper** for every pack | `track()` takes the closed `FunnelEvent` union; API ingest has no `catalog_*`. `trackCatalog()` (GTM `dataLayer`, consent-gated) lives in `features/customer/styles/` | Promote it to a shared wrapper in `src/lib/analytics/` (typed event map, dataLayer now, first-party ingest when `store.analytics.catalog-events` ships) so other packs import it instead of forking |
| C9 | LINE button id from env `NEXT_PUBLIC_LINE_OA_ID`, hidden if unset (pack §11 **and** GLOBAL §5) | CLAUDE.md: configurable values come from the API. `LineFloat` reads `store.support.channels.lineOaId`. **UAT returns `lineOaId: null`** (phone/email/hours null too), so the button is hidden today | Decide one source. Recommended: keep the API setting (staff can change it without a release), with the env var only as a fallback if you want GLOBAL §5 literally. Either way, move `LineFloat` to `features/customer/shell/` (shared foundation) |
| C10 | Perf: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 | `docs/performance-budgets.md` (customer-marketing): LCP ≤ 2.0 s, CLS ≤ 0.05, initial JS ≤ 150 KB | Follow the stricter repo budget |
| C11 | **GLOBAL §1: never expose the number of factories** | `/styles/[slug]` renders `partnersCount` as "ผู้ผลิต: # โรงงานพาร์ทเนอร์ผลิตได้" (`styles/[slug]/page.tsx:160`, keys `detail.makers` / `detail.partners`). `StyleDetailDto.partnersCount` is in the **public** DTO. D-201 allows it at ≥ 3 factories. UAT returns `null` for all 122 styles, so nothing shows **today** | GLOBAL-RULES wins. Remove the row and its i18n keys (web). Strip the field server-side (API, belongs with A1 "ตัดข้อมูลโรงงานจาก response"). Amend D-201. Flag to the A1 owner so it is done once |
| C12 | Dark mode required ("Light and dark themes both required") | `d53072df`: the storefront **starts light whatever the OS says**; dark is available from the footer theme menu (`DeferredThemeMenu`). The 390 px check with `prefers-color-scheme: dark` rendered `data-theme="light"` | Keep the owner's light default. "Dark mode" means correct dark tokens when chosen. Screenshots will be taken with the theme set to dark |

Smaller items, taken the conservative way unless you say otherwise:
- "แบบย่อย" → "ตัวเลือก" applies to storefront `styles.json` only (already done in `d45549b5`).
- "สั่งกล่องตัวอย่าง" stays hidden: `GET /v1/store/sample-kits` → **404 on UAT**, and the existing sample flow needs a quote.
- Trust section: the prototype's "รูปจากไลน์ผลิต" copy and its factory icon are not used. The label is "รูปงานจริงระหว่างผลิต" (GLOBAL §1), with no factory pictogram.

---

## 2. Header bug: reproduction and cause (not fixed in this phase)

### 2.1 Measurements (`localhost:3001/styles`, signed out; [left, right] px)

| Width | Locale | Middle track | Nav (content) | First tool (Search) | Result |
|---|---|---|---|---|---|
| 1024 | both | — | — | — | drawer (collapses below 1040 = `min-[65rem]`) |
| 1040 | th | 167–592 (425) | 169–591 (422) | 616 | fits, **3 px** slack |
| 1054 | th | 167–606 (439) | 176–598 (422) | 630 | fits, 17 px slack |
| 1040 / 1054 / 1100 | en | 167–566 / 580 / 626 | 167–682 (**515**) | 590 / 604 / 650 | **overlap**: "Contact" 629–682 under Search/Cart/Assistant |
| 1180 | en | 167–706 (539) | 179–694 | 730 | fits (24 px) |
| 1280 | en | 215–734 (519) | 215–810 (**595**) | 782 | **overlap again**: "Contact" 757–810 under Search |
| 1440 | en | 275–834 (559) | 275–870 | 882 | content overflows its track by 36 px into the gap; 12 px clear |
| 1280 / 1440 | th | 545 / 585 | 502 | — | fits (43 / 83 px) |

Right cluster (signed out): th 400 px, en 426 px below 1280; th 424, en 450 at ≥ 1280. It includes the **assistant button** "ถามผู้ช่วย AI" (32 px + 4 px gap). The running build was compiled with `NEXT_PUBLIC_ASSISTANT=1`, although `.env.local` says `0` and D-218 says off at launch.

### 2.2 Cause in code

`src/features/customer/shell/SiteHeader.tsx`, line 93 and the nav/tools blocks:

1. **The collapse point is a fixed width, not the content's width.** The bar becomes the drawer only below `min-[65rem]` (1040 px). That number was tuned in `e7162b6e` for the **Thai** labels (nav 422 px). The English labels are 515 px ("Products & prices", "Box templates", …), and the English tools are 26 px wider ("Start designing free" is 168 px against "เริ่มออกแบบฟรี" at 127 px). Nothing re-checks the fit per locale.
2. **The middle track may be narrower than its content, and nothing handles that.** The grid is `auto minmax(0,1fr) auto` with `min-w-0` on the middle cell. Every link is `whitespace-nowrap`, and the nav neither shrinks, wraps, hides items nor clips. When the 1fr track is narrower than the nav, the nav simply overflows.
3. **Safe centring sends all overflow to the end.** `justify-center-safe` (added in `e7162b6e`) keeps the nav off the logo; that was the original Thai symptom. But the overflow now goes entirely rightwards, under the tools column. The tools come later in the DOM and paint on top, so "Contact/ติดต่อ" ends up **covered by the search icon**. Visible overlap starts once the overflow exceeds the column gap: 24 px below 1280, 48 px from 1280.
4. **The `xl` step (1280 px) costs more width than it gains.** Padding goes from 24 to 48 px each side, the column gap from 24 to 48 px, the nav gap from 16 to 36 px (`xl:gap-9`), and the tools gap from 4 to 8 px. Net, the nav needs 80 px more (en 515 → 595) while the track *shrinks* (en 580 → 519 at the same 1280). That is why English breaks a second time at 1280–~1355 px.
5. **Extra tools are not budgeted.** The assistant button (+36 px) is not counted against the breakpoint, and neither are any future controls.

Arithmetic, for widths below 1184 px: track = W − 215 − tools. Thai fits when W ≥ 1037 (tools 400). English fits when W ≥ 1156 with the assistant, or ≥ 1120 without it. For widths of 1280 and up: track = W − 311 − tools, and English needs W ≥ 1356 (assistant) or ≥ 1320 (none). **English overlaps even with the assistant off.**

### 2.3 When it also happens in Thai

Signed-out Thai has only 3 px of slack at 1040 and 17 px at 1054 (gap 24 px). It overflows, and later visibly overlaps, whenever the nav or the tools gain about 4 px at 1040, or about 18 px at 1054 (about 42 px for a visible overlap at 1054):
- **Signed in: safer, not worse.** The 40 px initials avatar replaces the 75 px "เข้าสู่ระบบ" link (−35 px). The old cause, a full display name widening the tools, was removed in `e7162b6e`. The cart badge is absolutely positioned and adds no width.
- **Assistant on:** already included in the numbers above. Turning it off gives Thai +36 px.
- **Longer Thai labels:** any +18 px in the nav (one extra word, e.g. "สินค้าและเช็กราคา").
- **One more tool** in the right cluster (theme menu, notifications bell ≈ 36 px): overflows from 1040 to about 1075.
- **Larger text:** browser default font 17 px, or text-only zoom: about +6 % of 422 = 25 px, so it overflows at 1040–1061.
- **Font fallback:** if Anuphan has not loaded or fails, Thai system fonts have different advance widths. Not measured; verify on Windows (Leelawadee/Tahoma) and macOS (Thonburi).

### 2.4 Fix options for Phase 1 (to choose; none implemented)

(a) Shorter English nav labels ("Studio · Templates · Pricing · Business · Contact") plus a compact tools cluster (language as icon + code without padding; CTA hidden between 1040 and about 1180), so both locales keep ≥ 24 px slack at every width ≥ 1040. (b) Re-balance `xl`: keep the nav gap at 24 px and the padding at 32 px, so 1280 never needs more than 1180. (c) Per-locale collapse breakpoint (a class on `<html lang>`), with English collapsing below about 1160. (d) Content-driven collapse (ResizeObserver): rejected, because it adds client JS to every page (150 KB budget).
**Recommended:** (a) + (b), plus a regression e2e that asserts **no bounding-box intersection** between logo, nav links and tools. It should run for th/en × {1040, 1054, 1100, 1180, 1280, 1366, 1440} × signed in/out × assistant on/off. Today only "no horizontal scroll" is tested (`storefront-home.spec.ts`), and that cannot catch this overlap.

---

## 3. Mapping: prototype section → files → reused components

Status: ✅ on the branch (verify only) · ✏️ modify · ➕ new · ⏸ later phase / blocked on data.

| Prototype section | Status | Create / modify | Reuse |
|---|---|---|---|
| Header: no overlap, avatar initials, hamburger < 1040, cart count | ✏️ (EN bug §2) | `shell/SiteHeader.tsx`, `auth/AccountButton.tsx`, `i18n/messages/en/customer/storefront.json` (labels), new `e2e/storefront-header.spec.ts` | `MobileProductsMenu`, `CartButton` (count ✅), `Avatar`, `DropdownMenu` (heading ✅), `HeaderSearch`, `DeferredLocaleMenu` |
| Breadcrumb + H1 + lede "{n} โครงสร้างหลัก · {m} ตัวเลือก" | ✅ | `styles/page.tsx` | `Breadcrumbs`, `getLibraryTotals()` (UAT: 122 / 986) |
| Big live search ("/", debounce 160, ค้นหาบ่อย, tabs) | ✅ word tab · ⏸ size tab | `styles/LibrarySearch.tsx` | `SearchInput`, settings `quickSearch` (UAT 404 → row hidden) |
| Category rail (icon, name, count) | ✅ | `styles/page.tsx` (inline) | `ProductThumb`, `facetLabel`, facet `category` counts |
| Filters: instant switch, groups, sub-groups, top-5 + ดูเพิ่ม, use-case chips, swatches | ✅ (sub-group overflow tweak §4.3) | `styles/FilterPanel.tsx`, `styles/facet-groups.ts` (+test) | `Switch`, `Checkbox`, `DisclosureList`, `MaterialSwatch` (swatches from settings: UAT 404 → none) |
| Bottom sheet ≤ 1040 px + "แสดงผลลัพธ์" | ✅ | `styles/FilterSheet*.tsx` | `Sheet` |
| Active chips + ล้างทั้งหมด | ✅ | `styles/page.tsx` `ActiveFilters` | `Badge` |
| Toolbar: count, view toggle, sort, VAT switch, copy link | ✅ except VAT | `styles/LibraryControls.tsx`, `LibraryViews.tsx`; VAT switch ➕ (C1) | `SegmentedControl`, `NativeSelect`, `Switch` |
| **Shared price-display helper (VAT)** | ➕ (GLOBAL §5) | `src/features/shared/format/price.ts` (+test), adopted by `StyleCardFace.tsx`, `QuickView.tsx`, `catalog/PriceHint.tsx`, product pages; preference store `src/features/shared/format/vat-preference.ts` (localStorage, try/catch) | `format.thb` / `formatTHB` |
| Product card (photo, instant badge, n ตัวเลือก, heart, code, name 2-line, spec row, 2 tags +n, price, compare) | ✅ anatomy · ⏸ spec row (no card data) | `styles/StyleCardFace.tsx`, `StyleCardActions.tsx` | `ProductCard` slots (✅ `a4033e17`), `Badge tone="instant"` |
| Load more 24 + "แสดง x จาก y" | ✅ | `styles/StyleResults.tsx` | `Meter` |
| Compare tray (thumbs, limit toast) | ✅ (limit 3, C2) | `styles/CompareTray.tsx`, `compare-store.ts` | `/styles/compare` |
| Quick view (`?style=`, tabs, options, spec grid, tiers, CTAs) | ✅ shell · ⏸ tiers / MOQ / sample | `styles/QuickView.tsx`, `QuickViewHost.tsx` | `Sheet`, `VariantPicker`, `VariantActions` (→ Studio via `studioHref`), `DielineDownloadEntry`, `StylePreview3D` |
| Studio "เริ่มออกแบบแบบนี้" | ✅ | `styles/VariantActions.tsx` → `recipeOfVariant()` → `studioHref({ product, style, dims, variant:{base,code,key}, step:"box" })` → `/studio/new?…` | `features/customer/studio/paths.ts` |
| LINE floating button | ✏️ move + source (C9) | `styles/LineFloat.tsx` → `shell/LineFloat.tsx` | `getSupportChannels()` (UAT `lineOaId: null` → hidden) |
| Empty state | ✅ | `styles/page.tsx` | `EmptyState`; "ขอแบบใหม่จากทีม" → `/account/structural-requests/new` |
| Analytics `catalog_*` | ✏️ promote (C8) | `styles/catalog-events.ts` → `src/lib/analytics/catalog.ts` | GTM `dataLayer`, `ConsentBanner` |
| Factory count on style page | ✏️ remove (C11) | `styles/[slug]/page.tsx`, `styles.json` th/en (`detail.makers`, `detail.partners`) | — |
| Size search tab + "ใส่ได้" + "ขนาดภายในแนะนำ" | ⏸ P2 (API fit filter) | `LibrarySearch.tsx`, `query.ts` (`size`) | detail `sizeRanges` |
| Wizard "ช่วยเลือกให้หน่อย" | ⏸ P2 (budget step needs C3) | ➕ `styles/HelpMeChoose.tsx` (dynamic) | `Dialog`, `Stepper` |
| Dieline hover / แบบคลี่ tab | ⏸ P2 | `StyleCardFace.tsx`, `QuickView.tsx` | `previewSrc()` → `/style-previews/{code}` (drawn by `@getpack/dieline`; UAT `assets` empty for all 122) |
| SEO landing pages + "เลือกตามการใช้งาน" block | ✅ block · ⏸ P2 content | `styles/for/[useCase]/page.tsx`, `LibraryLinks.tsx`, `sitemap.ts`, `llms.txt` | `JsonLd`, `alternateUrls` |
| Trust section | ⏸ P2 (no content source) | ➕ `styles/TrustBlock.tsx` | settings `trust` (UAT 404) |
| Account menu, "ทำต่อจากครั้งก่อน", พับ 3D, EN, eco filter | ⏸ P3 | `AccountButton.tsx` (labels from account pack P1), `features/customer/repeat` | `StylePreview3D` |

---

## 4. Data

### 4.1 Coverage on UAT today (122 published styles, 986 variants)

| Field | Present | Note |
|---|---|---|
| `nameTh`, `nameEn`, `category`, `family`, `materialClass`, `pricePath`, `variantCount`, `thumbnailUrl`, `photo` | 122/122 | `photo.alt` th/en present |
| `options` (card chips) | 99/122 | |
| `startingPrice` | **0/122**, including the 16 `instant` styles | → **no price is shown on any card today** |
| `featured`, `referenceCode` | 0/122 | |
| detail `sizeRanges` | 109/122 have a range; **81** with all six bounds; 106 with at least one bound | all `source: recipe`; mm, **inside size** (D-182) |
| detail `leadTime` | 122/122, **all `{5, 10}`** | identical for every style: see Q3 |
| detail `useCases` | 122/122 | |
| detail `assets` (dieline_svg / thumbnail_3d) | **0/122** | |
| detail `descriptionTh` | 0/122 | |
| detail `partnersCount` | 0/122 (null) | must go anyway (C11) |
| variant `pricePath` | 16 instant / 970 rfq | reasons: `option_not_priced` 830, `calculator_not_signed` 687, `no_calculator` 92 |
| `store.style-library.settings` | **404** | quick terms, swatches, compare limit, trust, tax note → all hidden or defaulted |
| `store.support.channels` | all null | LINE button hidden |
| `store.sample-kits` | **404** | sample CTA hidden |

All 20 rows of `catalog-commercial-data-template.csv` exist in the catalogue, and their `name_th` and `price_mode` match the API. The other 102 styles are not in the file yet.

### 4.2 Gap table: CSV columns as the checklist, plus UI-only fields

| CSV column / UI field | Status | Source today / what is missing |
|---|---|---|
| `style_code` | available | `code` |
| `name_th` | available | `nameTh` |
| `name_en` | available | `nameEn` (122/122; all English already set) |
| `family_th` | **derivable, but ambiguous** | The CSV values (กล่องกระดาษแข็ง / กล่องแข็ง / กล่องลูกฟูก) match API **`category`** labels (`folding_carton` / `rigid` / `corrugated`), not API `family` (`specialty`, `tray`, …). See Q4 |
| `length_min_mm` … `height_max_mm` (was `_cm`; C1c §11.3) | **derivable on the detail, missing on the card** | detail `sizeRanges[]` in mm, inside size, per `materialClass`. cm = mm / 10 is a unit change, not money. 13 styles have no range and 41 lack at least one bound. Not on `StyleCardDto` → card size range = missing (request `store.styles.card-commercial`). Basis of the CSV (inside or outside?) = Q5 |
| `moq_units` | **missing** | in no style DTO; card, quick view and the "below minimum" tier rows stay hidden |
| `lead_time_days_min/max` | **derivable on the detail, missing on the card** | detail `leadTime`, but 5–10 everywhere (Q3); unit days vs working days unknown. Not on the card |
| `price_mode` | available | `pricePath` (`instant` \| `rfq`); CSV says `quote` for `rfq` |
| starting price ("เริ่มต้น ฿x/ใบ") | available field, **no data** | `startingPrice` null for all 122 (D-220 reference configs not set on UAT) |
| `price_est_low_thb` / `price_est_high_thb` / `price_est_basis_qty` | **missing + blocked by D-220** (C3) | |
| tier prices 500 / 1,000 / 3,000 / 5,000 | **missing** | one starting price at most. Tiers need the pricing service (API) |
| ex-VAT figure (VAT switch OFF) | **missing** (C1) | request `store.styles.price-ex-vat` |
| `recyclable`, `plastic_free` | **missing** | no attribute; the prototype's derivation from material is a guess, so it is not allowed (pack P3 #5) |
| `certifications` | **missing** | settings `trust` (404) / no per-style field |
| `dieline_ai_url` | **available differently** | `DielineDownload` generates pdf/ai/dxf/svg from the engine (sign-in, T12); no uploaded `.ai` file per style |
| dieline image (hover / แบบคลี่) | derivable | `/style-previews/{code}?…` (engine drawing, `previewSrc`); `assets[dieline_svg]` empty |
| 3D fold | partial | `StylePreview3D.tsx`; `assets[thumbnail_3d]` empty |
| `notes` | n/a | internal column; never rendered |
| photo / thumbnail + alt | available | `photo { url, alt{th,en} }`, `thumbnailUrl` |
| option chips / option groups | available | card `options[]`; detail `axes[]`, `variants[]` |
| use cases | available on the detail, facet on the list | not on `StyleCardDto` (requested) |
| facet counts | available, single-value | `facets.*`; disjunctive counts not guaranteed except `category` |
| total matches | derivable | sum of `facets.category` counts (no `meta.total`) |
| library totals | available | variants `meta.libraryTotal` / `libraryStyles` |
| ค้นหาบ่อย terms, compare limit, swatches, trust, tax-invoice note | **missing** (settings 404) | request `store.style-library.settings` (mocked in tests only) |
| LINE OA id | field available, **value null** | `store.support.channels.lineOaId` |
| per-style sample | **missing** | `sample-kits` 404 |
| size-fit search (`size=LxWxH`) | **missing** | API fit filter (B2) |
| account initials / menu | available | `getActor().displayName`; labels from account pack P1 |

Open contract requests already in `docs/contract-requests.md` (rows 11–15): `store.style-library.settings`, `store.styles.card-commercial`, `store.styles.price-ex-vat`, `store.styles.multi-facets`, `store.analytics.catalog-events`. The B2 API block (`feat/catalog-commercial-fields`) should absorb them. Add **one new request**: drop `partnersCount` from `StyleDetailDto` (C11).

### 4.3 Facet structure today and the grouping

Shape (UAT): `closure` and `feature` values are `axis:value`, and `facetLabel()` renders them "{axis}: {value}". The other facets are flat codes. Every value on UAT has a Thai label in `styles.json` (none missing).

| Facet | Values | Axes → sub-group headings (prefix stripped), with counts |
|---|---|---|
| `closure` "ฝาและการปิด" | 17 | **ก้นกล่อง**: ก้นล็อกอัตโนมัติ 9 · ก้นล็อก 4 ปีก 9 · ก้นปิดกาว 9 · ก้นล็อก 1-2-3 9 · ก้นเสียบ 9 / **ความลึกฝา**: เต็มความสูง 7 · บางส่วน 7 / **การปิดฝา**: แม่เหล็ก 4 · ริบบิ้น 4 / **การล็อก**: แรงเสียดทาน 4 · ล็อกร่อง 4 / **ฝาบน**: ฝาเสียบสลับ 4 · ฝาเสียบ 4 · ฝาเสียบแบบเครื่องบิน 2 · ปิดกาว 2 / **ด้านหน้ากล่อง**: ลิ้นล็อก 1 · ลิ้นเสียบ 1 |
| `feature` "ลูกเล่น" | 53 | **20 axes**: หน้าต่าง (2) · ตัวรอง (1) · รูดึง (1) · รูแขวน (3) · การต่อตะเข็บ (3) · ช่องมือจับ (2) · รูปทรง (5) · หูหิ้ว (2) · อุปกรณ์เสริม (4: รูแขวน, รอยบากฉีก, หน้าต่าง, ซิปล็อก) · แถบกาว (2) · แถบดึงฉีก (1) · มุม (2) · แผ่นหัวโชว์ (1) · จำนวนช่อง (6) · มุมลิ้นเสียบ (2) · รูระบายอากาศ (2) · ข้างถุง (2) · หูถุง (4) · การพับ (4) · จำนวนชั้น (4) |
| `useCase` "เหมาะกับ" | 20 | flat, shown as chips (gift 39 … soap 4) |
| `materialClass` "วัสดุ" | 8 | flat + swatch (swatches from settings: none on UAT → no swatch) |
| `family` "ตระกูลโครงสร้าง" | 21 | flat, collapsed by default, top 5 + ดูเพิ่ม |
| `pricePath` | 2 (instant 16 / rfq 106) | the "ราคาทันทีเท่านั้น" switch with its count |
| `category` | 7 | the rail, not the sidebar |

Grouping (already in `facet-groups.ts` and tested): split at the first `:`; sub-group heading = `axisLabel(axis)`; item = `valueLabel(axis, value)`; axis order = `VARIANT_GROUPS`, then the API's order. Zero-count values are hidden unless selected. Each sub-group shows its first 5 values + "ดูเพิ่มอีก N รายการ" (`จำนวนช่อง` with 6 values is the only one that folds today).

**Proposed change for Phase 1.** "ลูกเล่น" has **20 sub-groups**, far more than the prototype's 6. The proposal: show the 6 axes with the highest total count, and put the rest behind one "ดูเพิ่มอีก N หัวข้อ". This is a presentation rule only; which axes appear still comes from the API. The labels "อุปกรณ์เสริม: รูแขวน / หน้าต่าง" (pouches) repeat names of other axes, which is acceptable because the heading tells them apart.

---

## 5. Risks

- **Nothing priced shows on /styles today.** UAT has 0 starting prices, so cards read "ขอใบเสนอราคา" and instant cards carry only the badge. The VAT switch, tiers and estimates all depend on API work (C1/C3, B2).
- **Spec row empty on every card** until `store.styles.card-commercial` ships. Reading the detail per card (24 calls a page) is rejected.
- **Uniform lead time** 5–10 on all 122 styles may be a seeded default. Showing it on 122 cards could be "sample data" under GLOBAL §3 (Q3).
- **Header regression** has no automated guard (§2.4). The fix touches a component on every storefront page.
- **Two sources for one setting** (LINE env vs API, C9) would drift. Pick one.
- **Shared foundations** (VAT helper, LINE, analytics wrapper, tokens) are imported by every later pack. Their API must be settled in B1, or C1–C10 will fork them.
- **Initial JS** over the 150 KB storefront budget (about 257 KB in the first Phase 0; not re-measured here). The header fix and the VAT switch must add no client JS beyond a tiny island.
- **Parallel Stage-A steps** touch the same areas: A1 (factory data), A3 (pricing + spec label), A4 (VAT rounding). The VAT helper waits for the A3/A4 rounding outcome.

## 6. Open questions

1. **C1–C12**: a decision for each (recommendations given).
2. **Assistant in UAT/prod builds**: the measured build has the assistant button on (`NEXT_PUBLIC_ASSISTANT=1` at build time) despite D-218. Intended for UAT?
3. **Lead time**: is `{minDays: 5, maxDays: 10}` on all 122 styles real per-style data or a default? Calendar or working days? GLOBAL §6 says "Production 5 working days after artwork approval".
4. **CSV `family_th`**: does it mean the API `category` (that is what the 20 rows contain) or the structural `family` (`specialty`, `tray`, …)? The API import must know which.
5. **CSV size columns**: inside or outside dimensions, and in cm? The API stores inside mm (D-182), and the fit rule (product + 0.5 cm) assumes inside.
6. **Reference configurations (D-220)** for the 16 instant styles: who sets them on UAT, so "เริ่มต้น ฿x/ใบ" can be verified?
7. **`partnersCount`**: confirm D-201 is superseded by GLOBAL §1 for the storefront (C11).
8. **"ลูกเล่น" with 20 sub-groups**: OK to show the top 6 by count + "ดูเพิ่ม" (§4.3)?

## 7. Phase 1 — ordered task list (on `design/styles-catalog-redesign` from `fix/uat-phase0`, after decisions)

1. Create the branch. Restore `docs/design/styles-redesign/PLAN.md` (this file) and record the decisions in §1.
2. Contract requests: add "drop `StyleDetailDto.partnersCount`". Re-confirm rows 11–15 with the B2 API owner.
3. **Header** (§2.4 a+b): EN labels, compact tools, `xl` re-balance. Add `e2e/storefront-header.spec.ts` (no intersection; th/en × 7 widths × signed in/out × assistant on/off). Commit on its own.
4. **Confidentiality**: remove the "ผู้ผลิต / # โรงงานพาร์ทเนอร์" row and its keys from `/styles/[slug]` (C11). Add a unit test that the customer `styles.json` has no "โรงงาน".
5. **Shared price-display helper** (C1): `features/shared/format/price.ts` + tests (basis label, no arithmetic), VAT preference (localStorage, try/catch), switch rendered only with both figures. Adopt it in `StyleCardFace`, `QuickView`, `PriceHint`, product pages.
6. **Analytics wrapper** (C8): move `trackCatalog` to `src/lib/analytics/catalog.ts` with a typed map including `catalog_wizard`. Re-export for other packs.
7. **LINE button** (C9): move to `features/customer/shell/LineFloat.tsx`, wire the chosen source, and lift it above the compare tray (verify).
8. Tokens: mapping note in `src/ui/tokens/README.md` (C5); no new tokens unless decided.
9. Facets: sub-group overflow for "ลูกเล่น" (§4.3, if approved) + `facet-groups.test.ts` case.
10. Compare: copy and limit from settings (3), toast at the limit (verify against the 422).
11. Quick view: verify that tiers, MOQ and sample stay hidden, the tax note appears only from settings, the CTA → Studio works, and focus trap / Esc / return focus work.
12. Verification: lint, typecheck, unit tests, e2e `--grep "style library|header"`, Lighthouse mobile. Screenshots: 1440 light, 1054 light (th + en), 390 dark, quick view, filter sheet. Report with the missing-data list (§4.2).
