# Category template redesign (`/products/[category]`): Phase 0 plan

Status: **Phase 0 (discovery, no code)**. Step A9c, branch `fix/uat-phase0`, 2026-10-25. Waiting for approval.
Inputs: `PROMPT-category-redesign.md` (Shared context + Phase 0), `docs/design/GLOBAL-RULES.md` (wins on conflict),
`category-corrugated-prototype.html` (grepped, not read whole), the current code, and **GET-only** reads of UAT
(`https://uat-api.getpack.co`) and of the production build of this branch at `http://localhost:3001`.

**Not exercised live:** `POST /v1/store/quotes/actions/calculate` (UAT is read-only). Everything said here about
per-size pricing comes from the contract (`src/lib/api/schema.d.ts`), the configurator code and GET data.

UAT data is seed data (`uat-*` / `dev-*` codes). Every count below describes UAT on 2026-10-25, not production. The
template must take all of it from the API at request time and hard-code none of it.

---

## 1. Findings

### 1.1 The sidebar and its "1 · ประเภท"

- The sidebar is `CatalogueNav` (`src/features/customer/catalog/CatalogueNav.tsx`), shown from `CategoryView.tsx`
  (`md:grid-cols-[15rem_1fr]`). On desktop it groups the categories as ราคาทันที / ขอใบเสนอราคา / บริการ
  (`ordering.ts › categoryGroup`, where the service group is matched by a regex on the code). On a phone it is one
  scrolling row.
- The number is **`category.types.length`**: how many API **product types** (`StoreProductTypeDto`,
  `GET /v1/store/catalog/product-types`) have `categoryCode === category.code`. The word next to it is
  `catalog.groups.types` = "ประเภท", in an `sr-only` span that the text extraction still picks up.
- In UAT **all 14 categories have exactly one product type, with the same code as the category** (`folding_carton`
  → type `folding_carton`, and so on). So the number is always 1. It counts an internal modelling unit (the type
  that holds quote mode, calculator and MOQ), not products. Real product counts are 0 to 10 (§2). The mock dataset
  has categories with more than one type, which is why the number looked useful in development.
- Because `types.length` is 1, the "type" chip row in `CategoryView` (`category.types.length > 1`) never renders on
  UAT.

### 1.2 Filter chips with zero results

- `CARD_FILTERS = ["instant","rfq","moq100","fast","promo"]` (`ordering.ts`) is a **static list rendered for every
  category**, with no count and no check for results (`CategoryView.tsx` maps the constant). `SMALL_MOQ = 100` and
  `FAST_LEAD_DAYS = 5` are hard-coded in the web, but CLAUDE.md says configurable values come from the API.
- Result counts per chip on UAT (catalogue products only):

| category | products | ราคาทันที | ขอใบเสนอราคา | ขั้นต่ำ ≤ 100 | ผลิต ≤ 5 วัน | มีโปรโมชัน |
|---|---|---|---|---|---|---|
| corrugated | 5 | 5 (= all) | **0** | 5 (= all) | 4 | **0** |
| folding_carton | 10 | **0** | 10 (= all) | **0** | **0** | **0** |
| label_sticker, tag_sleeve, flexible_pouch, service, rigid_box, paper_bag, food_packaging, tube, custom_tape, pop_display, other | 1–5 | **0** | all | **0** | **0** | **0** |
| standard_product | 0 (+101 stock) | **0** | **0** | **0** | **0** | **0** |

- Cause: no faceting. The chips are not built from the category's products. In practice each chip either narrows
  nothing (it equals the total) or empties the list. In `standard_product`, choosing any chip **drops all 101 stock
  items** (`filters.length === 0 ? stock : []`), so every chip gives an empty page.
- No product on UAT has a `campaignBadge`, so "มีโปรโมชัน" is 0 everywhere.

### 1.3 Data per product (catalogue detail, `GET /v1/store/catalog/products/{slug}`)

| Spec the template wants | Where it is in the API today | Verdict |
|---|---|---|
| Structure (โครงสร้าง) | `patterns[].name` (e.g. "กล่องฝาชน (RSC)") | Real for products with patterns: corrugated 5/5, folding 10/10, tag 2/2, pouch 3/3. **None** for label, rigid, bag, food, tube, tape, POP, other, service |
| Flute / layers (ลอน/ชั้น) | `optionGroups[kind=material].options[].attributes.flute` = a **seed code** (`DEV-B`, `UAT-E`, `UAT-BC`), `caliperMm` (3 / 3.2 / 1.6 / 6.5 / 6.8). Ply only appears inside the material **name** ("ลอน B (3 ชั้น)") | No display label or ply field. Showing the code is wrong, and parsing the name is guessing → contract request §6 C3. Until then: material names as written, otherwise "ดูในหน้าสินค้า" |
| Surface (ผิว) | Not a field. Only inside one material name ("KI230 ลอน B ผิวขาว") | Gap. The prototype's "ผิวคราฟท์" for 4 products is **not** in the data → "ดูในหน้าสินค้า" |
| Standard sizes | `standardSizes[] {code, name, lengthMm, widthMm, heightMm}` | Real: 23 of 42 products (§2). Labels, tags and sleeves have `heightMm: 0` (flat). Pouches use height for the gusset |
| Custom-size support | No flag. Indirect signs: configurator `instant` and size step (box kind), `patterns[].constraints` min/max (only `DEV-RSC`, tag and pouch patterns have ranges; the others are `{}`) | Gap: no explicit "custom size allowed + range" per product → contract request §6 C4. Until then: instant products say "กำหนดขนาดเองได้" (the configurator really takes dims); quote-only products say nothing |
| Print options | `optionGroups[kind=ink_colour]`: only on postal box, fruit box (corrugated) and soap box. The other 3 corrugated products have no print group, but their `startingPriceAssumes` says "พิมพ์ 4 สี (CMYK)" | Real, but uneven |
| Short description | `descriptionTh` on 37/42 (empty on the 3 `dev-*` services). `descriptionEn` mostly null | Real for th. The prototype **rewrote** 4 corrugated descriptions; those rewrites are fake, so use the API text |
| Images | `images[].variant.kind = "photo"` on all 42 | Says "photo". Whether they are real production photos and not generated could not be checked from here → **user verifies** |
| MOQ / lead time / start price | Card: `moq`, `leadTimeDays`, `startingPricePerPiece` (incl. VAT, D-220), `startingPriceAssumes {quantity: 300, specs[]}` | Real. Lead time and price only on the 5 corrugated products. MOQ is null on 18/42 |

**Data bugs to report (do not silently change business copy):**

1. `uat-postal-box-b.descriptionTh` says "เลือกพิมพ์โลโก้ 1–2 สีได้", but its `ink_colour` options are "ดำ · พิมพ์ 4 สี
   (CMYK)" (hard rule 8, confirmed on UAT).
2. `uat-fruit-box-tele.startingPriceAssumes.specs[]` contains the customer-visible label **"[DEV] ฝา · พิมพ์ด้านนอก"**
   (the `[DEV]` prefix is seed data that leaks to customers).
3. Dimension order: `startingPriceAssumes` labels the size "ขนาด (กว้าง × ยาว × ลึก)" / "W × L × D", and every standard
   size `name` puts the dims as W × L × H ("เบอร์ 00 (9.75×14×6 ซม.)" = 97.5 × 140 × 60). GLOBAL-RULES §5 says
   ยาว × กว้าง × สูง. The product page table already prints L × W × H from the numbers next to a name that reads
   W × L × H. The prototype also prints W × L × H. The spec-label helper (A3 / PDP Phase 0) owns the order, and
   category must render dims through it, not through `name`.
4. `category.description` says "เห็นราคาและวันผลิตทันทีทุกรายการ" whenever **any** type in the category is instant
   (`categoryGroup`). A mixed category would claim "ทุกรายการ" without it being true. It also starts by repeating
   the category name.
5. (Outside this page, for A1 / styles) The storefront footer still has the link label "เครือข่ายโรงงาน" (GLOBAL-RULES
   §1/§6).

### 1.4 Standard-size data behind the product-page table

- `ProductView.tsx` renders `product.standardSizes` as a table (code · name · dims). It has **no prices**. For instant
  products the row links to `/configure/{slug}?size={code}`, and the configurator seeds the size from `?size=`
  (`configurator/state.ts`). So a "สั่งเบอร์ X" deep link already works.
- The configurator payload (`GET …/products/{slug}/configurator`) returns the same sizes plus an `id`. On UAT the
  postal box has 11 sizes and `quantity.default = 300`, `min = 100`.
- The admin standard-size record also has **`calcLengthMm / calcWidthMm / calcHeightMm / calcFluteTypeId`**
  ("the dimensions the calculator uses", which can differ per flute). The store DTOs leave them out.
- The configurator shows standard sizes only for `kind === "box"` (`SizeStep.tsx`). Flat or pouch standard sizes are
  shown on the product page but not offered in the configurator.

### 1.5 Can the pricing engine price each standard size? (contract and code only, not exercised)

- **Yes, one size per call, through `POST /v1/store/quotes/actions/calculate`**, the same path the configurator uses.
  For corrugated, `CorrugateConfigurationDto` takes `l / w / d` (mm), `basis`, `catalogProductId` ("its standard
  sizes carry no die block", legacy `recheckStandardSize`), `materialId`, `patternId`, `difficultyLevelId`,
  `parts`, and `quantities` (1–10 per call). The configurator prices a standard size by sending that size's
  `lengthMm / widthMm / heightMm` with `basis: "internal"`.
- **There is no batch or GET form.** Pricing the postal box's 11 sizes at 300 pcs is 11 rate-limited POSTs per
  render. They cannot sit in Next's data cache. `price-hints` gives one price per product (the reference size), not
  per size.
- Only **corrugated** is instant on UAT. The other 13 categories are RFQ (`availability: "rfq"`), so they have no
  per-size price at all, and the finder there could only show fit, not price.
- The reference price is real only for the reference configuration: postal box ฿15.70 at 300 pcs = size 00
  (97.5 × 140 × 60), CMYK print, KA125 B. The ฿15.70 vs ฿17.26 mismatch between pages belongs to **A3** (GLOBAL-RULES
  §5). Per-size prices must not ship before A3 reconciles the price path.
- Open question: whether the engine maps the store dims to the `calc*` dims (and per flute) on its side. The contract
  suggests it does (catalogProductId + recheck), but it was not verified.
- **Recommendation:** contract request §6 C1, a cacheable GET that prices every standard size of a product at the
  reference spec through the same engine. Until it exists, the size chart shows sizes **without prices** (flag
  `category.sizePrices` off), and "สั่งเบอร์ X" opens the configurator, which prices it live.

### 1.6 Other facts the template needs

- **Style-library cross-link:** `GET /v1/store/styles?limit=1` → `facets.category` = folding_carton 49 · corrugated 32 ·
  flexible 10 · insert 8 · rigid 8 · tag_sleeve 8 · label 7. The "32 corrugated styles" count is real. Style category
  codes **do not match** the catalogue codes (`flexible` vs `flexible_pouch`, `rigid` vs `rigid_box`, `label` vs
  `label_sticker`; `insert` has no catalogue category; 7 catalogue categories have no style category). Link:
  `/styles?cat=<styleCategory>`.
- **Dieline download** (`POST /v1/store/dielines/downloads`) needs a published **style variant** and a signed-in
  customer. The 5 corrugated products' patterns have `styleCode: null` and `dielineKey: null` (also in A5
  FINDINGS), so "ดาวน์โหลดแบบกล่อง" **cannot be wired** for the postal box today. Hide it.
- **Materials page:** `/materials` reads `GET /v1/store/catalog/materials`, which is still a **contract request**
  (UAT 404). The live page says "ยังไม่มีวัสดุในคลัง", so the "เปรียบเทียบวัสดุทั้งหมด" link would lead to an empty page.
  Hide it until the endpoint ships.
- **FAQ:** `GET /v1/store/catalog/faqs` has only general groups (ordering, artwork, payment, delivery). No group per
  product category exists. `…/products/{slug}/faqs` is empty for the postal box. So category FAQs have no source
  today.
- **RFQ tray:** `/v1/store/rfq-baskets/draft/items` exists (D-301, signed-in). Products Phase 1 item 8 builds the
  shared tray, and category reuses it.
- **VAT:** API prices include VAT (D-220). The web must not compute "ก่อน VAT" itself (CLAUDE.md: no arithmetic on
  money). The switch depends on the styles Phase 1 shared price/VAT helper (GLOBAL-RULES §5), which **does not exist
  on this branch yet**.

---

## 2. Data gap table: all 14 categories (UAT, 2026-10-25)

Legend: ✔ real data in API · ✖ none · ◐ partial. "Content" = intro, use-cases, short-description overrides, FAQ:
**none exists for any category**, so every category needs business-written content (§4).

| # | category (code → URL) | catalogue items · stock | buy mode | start price · MOQ · lead (API) | products with standard sizes (sizes) | size finder (3-D box sizes) | material / guide data in API | style-library count (`/styles` facet) |
|---|---|---|---|---|---|---|---|---|
| 1 | corrugated → `/products/corrugated` | 5 · 0 | **instant (5/5)** | ฿15.70 (lowest) · 100 · 5–10 days | 5/5: postal 11, white mailer 2, BC carton 2, fruit 2, tray 1 | ✔ eligible, priced only after C1 (see §1.5) | ◐ corrugated board: names, `caliperMm`, flute **code** (no label, no ply field) → flute guide needs C3 + content | 32 (`corrugated`) |
| 2 | folding_carton → `/products/folding-carton` | 10 · 0 | quote | ✖ · 500 · ✖ | 10/10: 1–3 each, mostly product-specific (soap 80 g, candle 180 g …), thank-you card flat | ◐ 3-D sizes exist, but RFQ = fit only, no price | ◐ board/paper: gsm, caliper, food grade, coatings | 49 (`folding_carton`) |
| 3 | label_sticker → `/products/label-sticker` | 5 · 0 | quote | ✖ · 500 · ✖ | 5/5: flat sizes (h = 0) | ✖ (flat, not a box) | ◐ label stock: PP white/clear/silver, art paper, kraft; coatings; die-cut shapes | 7 (`label`?, mapping open) |
| 4 | tag_sleeve → `/products/tag-sleeve` | 2 · 0 | quote | ✖ · 300 · ✖ | 2/2: flat | ✖ | ◐ paper gsm/caliper; foil, hole, die-cut | 8 (`tag_sleeve`) |
| 5 | flexible_pouch → `/products/flexible-pouch` | 3 · 0 | quote | ✖ · 3,000 · ✖ | 3/3: pouch sizes (gusset as height; 3-side seal flat) | ✖ (pouch fit is not a box fit) | ◐ films: micron, food grade; zip, tear notch | 10 (`flexible`?, mapping open) |
| 6 | standard_product → `/products/standard-product` | 0 · **101 stock** | quote (stock lines have their own MOQ) | ✖ · per SKU · ✖ | ✖ (stock items have own dims/capacity) | ✖ | ◐ stock attributes (material, type) | ✖ |
| 7 | rigid_box → `/products/rigid-box` | 3 · 0 | quote | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ (no option groups) | 8 (`rigid`?, mapping open) |
| 8 | paper_bag → `/products/paper-bag` | 2 · 0 | quote | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ | ✖ category (2 styles in family `paper_bag`, category unknown) |
| 9 | food_packaging → `/products/food-packaging` | 2 · 0 | quote | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ | ✖ |
| 10 | tube → `/products/tube` | 1 · 0 | quote | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ | ✖ |
| 11 | custom_tape → `/products/custom-tape` | 1 · 0 | quote | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ | ✖ |
| 12 | pop_display → `/products/pop-display` | 2 · 0 | quote | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ | ✖ |
| 13 | other → `/products/other` | 1 · 0 | quote | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ | ✖ |
| 14 | service → `/products/service` | 5 · 0 | quote / scope (service group) | ✖ · ✖ · ✖ | ✖ | ✖ | ✖ | ✖ |

What the template does with this:

- **Head facts:** instant categories (only corrugated) show เริ่มต้น · ขั้นต่ำ · ระยะผลิต min–max · จำนวนสินค้า ·
  "ราคาทันทีทุกรายการ" (only when every item is instant, otherwise a mixed label). Quote categories show ขั้นต่ำ
  (single value or min–max; **hidden** when MOQ is null for every item, which is 8 categories) · "รับใบเสนอราคาภายใน
  วันทำการ" (existing copy `catalog.category.rfqBody`) · จำนวนสินค้า. Service shows the item count and the scope
  wording from products Phase 1 ("ราคาตามขอบเขตงาน").
- **List view:** ≤ 8 items → rows in 13 categories; folding_carton (10) and standard_product (101 stock) → grid.
- **Size finder:** rendered only for **corrugated** on UAT, and only once the content file names the finder product
  (5 corrugated products have sizes; the prototype uses the postal box). Folding carton sizes stay as the existing
  product-page table (open question Q4).
- **Guide:** corrugated → flute guide (needs content + C3). folding / label / tag / pouch → material guide only when
  the business writes it (API data covers names and numbers, not "which to choose" copy). The other 9 → hidden.
- **Cross-link "ต้องการแบบอื่น":** style link only where the content file maps a style category (open question Q6)
  and its live facet count is > 0. The quote CTA is always there (except service, open question Q9).
- **FAQ:** hidden in all 14 until business content is approved.

---

## 3. Section → files → reused components

Prerequisites (MASTER-RUN-ORDER C2): **B1** styles Phase 1 (tokens, header, price/VAT helper, LINE button,
analytics wrapper), **C1** products Phase 1 (section nav, price table, grid card, RFQ tray, FAQ accordion pattern),
**A3** (price reconciliation + spec-label helper). Branch `design/category-redesign` from `design/products-redesign`.

New code goes in `src/features/customer/catalog/category/` (customer zone only; primitives from `src/ui`).

| Section (prototype id) | New / changed files | Reused (do not fork) | Data source |
|---|---|---|---|
| Route | `src/app/[locale]/(storefront)/products/[key]/page.tsx` (read `use`, `view`, `size` search params; drop `f`, keep `type`/`page`/`sort` until removed) | `resolveProductKey` | — |
| Data layer | `category/data.server.ts` (category view model: cards, details for ≤ N items, facts, counts, style facet count), `category/facts.ts` (pure: min price by `compareDecimal`, MOQ/lead ranges, mode) + tests | `api.server.ts` (`listProducts`, `listStockProducts`, `getProduct`, `getPriceHints`, `publicApi("catalogue")`), `ordering.ts › compareDecimal` | catalogue + price hints, styles facets |
| Content | `category/content/schema.ts` (types + validator), `category/content/index.ts` (loader by code), `category/content/<code>.ts` × 14 (non-copy config; empty until approved), `src/i18n/messages/{th,en}/customer/category-content.json` (copy) | `src/i18n` | business (§4) |
| Head (`.head`, `#facts`) | `category/CategoryHead.tsx` | `Breadcrumbs`, `breadcrumbSchema`, `webPageSchema`, `JsonLd`, B1 VAT switch + price helper, `Stat` | facts.ts, content `intro` |
| Sibling chips (`#sibs`) replace the sidebar | `category/SiblingChips.tsx`; remove the `CatalogueNav` use from `CategoryView` (keep the component only if another page needs it, otherwise delete) | `orderCategories`, `categoryHref`, chip styles from `/products` Phase 1 | catalogue tree (no counts) |
| Sticky section nav (`#secnav`) | `category/sections.ts` (which sections render → nav items) | products Phase 1 `SectionNav` | derived |
| Use-case filter (`#uses`) | `category/UseCaseChips.tsx`, `category/useCases.ts` (pure counts; drop 0-count values and hide the group when no value narrows the list) + tests; **retire `CARD_FILTERS` / `passes` from the category page** | chip component from products Phase 1 | content `useCases[].productSlugs` |
| Rows view (≤ 8) (`.prow`) | `category/ProductRows.tsx`, `category/specChips.ts` (structure / material / sizes / custom-size → label, or "ดูในหน้าสินค้า") + tests | `ProductPicture`, `cardFacts`, `PriceHint`, B1 price helper, `ProductCard` slots | product detail |
| Grid (> 8) | — | `ProductGrid` (products Phase 1 card) | as today |
| Comparison table (`.cmpt`) + toggle | `category/CompareTable.tsx`, `category/ViewToggle.tsx` (`?view=table`) | `SegmentedControl` (or products Phase 1 toggle), products Phase 1 price-table container (own horizontal scroll) | detail + content |
| CTAs | — | `configureHref`, products Phase 1 RFQ tray "เพิ่มในใบขอราคา" | — |
| Size finder (`#sizes`) | `category/size-finder/fit.ts` (pure: clearance, rotation, smallest volume, utilisation, tip threshold) + `fit.test.ts`; `SizeFinder.tsx` (client), `SizeChart.tsx` (SVG, one scale, L × H), `SelectedSize.tsx` (`?size=`) | `DimensionInput` / `toMm`, `ProductIllustration` (iso preview must be the existing illustration, not new drawings), spec-label helper (A3) | `standardSizes`; prices only via C1 behind `category.sizePrices` |
| Multi-size (`#multi`) | none in Phase 1 (button hidden behind the Phase 2 flag `category.multiSize`, off) | — | Phase 2 decision |
| Guide (`#flutes`) | `category/Guide.tsx` (kind `flute` or `material`) | `MaterialSwatch`, `Meter` only if the business approves qualitative levels, `Card` | API material attributes (names, caliper, gsm, food grade) + content copy |
| Cross-link (`#custom`) | `category/CrossLink.tsx` | `NextStep`, `rfqHref`, styles `paths.ts` (`/styles?cat=`) | styles facet count, content `styleCategory` |
| FAQ (`#faq`) | `category/CategoryFaq.tsx` | `DisclosureList`, `faqPageSchema`, `faq-hygiene` | content `faq` |
| JSON-LD | in `CategoryView` / head | `itemListSchema`, `productSchema` (offers only with a real price), `breadcrumbSchema`, `faqPageSchema` | — |
| Analytics | `category/events.ts` (names from the prompt) | B1 analytics wrapper (`styles/catalog-events.ts` pattern; ingest names are a contract request already) | — |
| Copy | `src/i18n/messages/{th,en}/customer/catalog.json` (`category.*`, breadcrumbs "สินค้าและราคา") | — | — |

---

## 4. Per-category content file schema

Copy lives in i18n (CLAUDE.md: all copy through `src/i18n`). Structure and mappings live in a typed config file
per category. Nothing renders unless its entry is `status: "approved"`. Phase 1 ships the 14 files **with no approved
entries**, so the sections stay hidden until the business fills them in. Tests use a fixture, never shipped sample
text.

```ts
// src/features/customer/catalog/category/content/schema.ts
export type ReviewStatus = "draft" | "approved";            // only "approved" renders

export interface Reviewed {
  status: ReviewStatus;
  reviewedBy?: string;                                      // business owner (name or role)
  reviewedOn?: string;                                      // ISO date
}

export interface CategoryContent {
  categoryCode: string;                                     // API code, e.g. "corrugated"
  intro?: Reviewed & { key: string };                       // i18n key under customer.category-content.<code>.intro
  useCases?: Reviewed & {
    items: { id: string; labelKey: string; productSlugs: string[] }[];   // counts are computed live; unknown slugs are dropped
  };
  products?: Record<string /* slug */, Reviewed & {
    shortKey?: string;                                      // overrides descriptionTh only when approved
    surfaceKey?: string;                                    // "ผิว" until the API has a field (C4)
  }>;
  sizeFinder?: Reviewed & {
    productSlug: string;                                    // whose standardSizes drive the finder
    clearanceMm?: number;                                   // only if the API/settings do not own it (Q2)
    lowFitPercent?: number;                                 // tip threshold (prototype 45) (Q2)
  };
  guide?: Reviewed & {
    kind: "flute" | "material";
    titleKey: string;
    items: {
      materialCodes: string[];                              // API option codes; names/caliper/gsm read from the API
      titleKey: string;
      bodyKey: string;
      levels?: { strength?: 1|2|3|4|5; print?: 1|2|3|4|5; value?: 1|2|3|4|5 };  // only if the business approves (Q5)
    }[];
    compareLink?: boolean;                                  // honoured only when /materials has data
  };
  styles?: Reviewed & { styleCategory: string };            // e.g. "corrugated", "flexible" (Q6)
  faq?: Reviewed & { items: { questionKey: string; answerKey: string }[] };
}
```

```jsonc
// src/i18n/messages/th/customer/category-content.json (same keys in en)
{ "corrugated": { "intro": "", "useCases": { "ship": "" }, "guide": { "title": "", "b": { "title": "", "body": "" } },
  "faq": { "q1": "", "a1": "" } } }
```

Rules: an empty string or a draft entry hides the element. Prices, MOQ, lead times, counts and sizes **never** go into
content (they come from the API). Wording follows GLOBAL-RULES §1 (no factory words, no coverage, no counts of
partners).

---

## 5. Risks

1. **Per-size prices have no GET source.** 11 POSTs per render, uncacheable and rate-limited. Without C1 the chart
   ships without prices (flag off). Prices must also wait for A3's reconciliation, or two pages will disagree.
2. **VAT switch without the shared helper.** Computing "ก่อน VAT" locally would break CLAUDE.md and GLOBAL-RULES §5.
   C2 waits for B1.
3. **Detail fan-out.** Spec chips and the comparison table need `GET …/products/{slug}` per item (up to 10 per page,
   cached 300 s). Acceptable for ≤ 8-row categories. For larger ones, use the grid (no details) or contract request C2.
4. **Empty sections.** No category has content yet, so Phase 1 will look sparse (most sections hidden). This is
   correct (no sample data), but screenshots of all 14 must show clean hiding.
5. **Seed vs production data.** Counts (14 categories, one type each, 42 items) are UAT seed. The template must not
   assume one type per category. If production has more types per category, the existing type chips stay, built
   from data.
6. **Dimension order.** API names embed W × L × H. If the template shows `name`, it contradicts the spec-label order
   → show code + helper-formatted dims.
7. **Finder semantics.** Clearance ("0.5 ซม. ทุกด้าน" in copy vs +0.5 cm per dimension in the prototype code),
   standard-size basis (internal?) and `calc*` dims are unverified. Wrong answers here are sold as advice → unit
   tests + business sign-off (Q2, Q3).
8. **Removing `CARD_FILTERS` and the sidebar** changes URLs (`?f=` is ignored). Existing e2e `storefront.spec.ts`
   (catalogue → category → product) uses the mock dataset, where categories have more than one type. Keep the e2e
   green and add a mock category with one type.
9. **Image provenance.** All images are tagged `photo`, but their origin is unverified (GLOBAL-RULES §3).
10. **Styles mapping drift.** Style and catalogue category codes differ. A wrong map links to an empty or wrong
    library view → render only with count > 0.

## 6. Contract requests to file (`docs/contract-requests.md`, in Phase 1 item 1; not filed in Phase 0)

| id | method · path | purpose · fields |
|---|---|---|
| C1 `store.catalog.standard-size-prices` | `GET /v1/store/catalog/products/{slug}/standard-size-prices?quantity=300` (public, cacheable) | Price each standard size at the product's reference spec through `store.quotes.calculate`'s engine (no second formula, GLOBAL-RULES §5): `{ quantity, specs[], computedAt, sizes: { code, unitPrice (incl. VAT), unitPriceExVat, leadTimeBusinessDays, instant: boolean, reason? }[] }` |
| C2 `store.catalog.product-spec-summary` | add to `StoreProductCardDto` (or `?include=specSummary`) | `structureNames[]`, `materialNames[]`, `standardSizeCount`, `customSize {allowed, minMm, maxMm}`, so the list and comparison table need no detail fan-out |
| C3 `store.catalog.material-flute` | add to material option `attributes` | `fluteLabelTh/En`, `ply` (3 / 5), `surface` (kraft / white / …) as API values, not parsed from names |
| C4 `store.catalog.custom-size` | on product detail | explicit custom-size support + range per pattern (today only some patterns carry `constraints`) |
| C5 `store.catalog.category-content` (optional, if Q1 says the business edits content in the back office) | `GET /v1/store/catalog/product-categories/{code}/content` | intro, use-cases, guide, FAQ, review status |
| C6 style ↔ catalogue category map | on `StoreProductCategoryDto`: `styleCategory` | removes the content-file mapping |

Already open and needed: `store.catalog-materials` (the `/materials` page) and `store.analytics.catalog-events`
(event ingest names).

## 7. Phase 1 tasks, in order (one commit each, after approval)

0. Preconditions: B1, C1 (products Phase 1) and A3 merged forward. Create `design/category-redesign` from
   `design/products-redesign`. File contract requests C1–C4 (C5/C6 per Q1/Q6) with MSW mocks marked
   `// CONTRACT-REQUEST`.
1. `category/data.server.ts` + `facts.ts` (+ tests: min price via `compareDecimal`, MOQ/lead ranges, mixed vs
   "ทุกรายการ", null-safe).
2. Content schema, loader, 14 empty config files, i18n namespace (th/en), and a test fixture. Only `approved`
   renders (test).
3. Head: breadcrumb "หน้าแรก / สินค้าและราคา / {category}", H1, intro (content), VAT switch (B1 helper), facts for
   instant / quote / service.
4. Sibling chip row replaces the sidebar. Remove the "1 · ประเภท" counts.
5. Sticky section nav built from the sections that will render (finder only with standard sizes, guide only with
   content).
6. Use-case chips with live counts. Never render a 0-count value. Hide the group when no value narrows the list.
   Remove `CARD_FILTERS` / `?f=` from the category page (keep `sort` only if the products Phase 1 sort menu is kept
   here). Tests.
7. Rows view (≤ 8) with spec chips from API data, "ดูในหน้าสินค้า" for unknowns. Grid (> 8) reuses `ProductGrid`.
8. Comparison table + toggle (`?view=table`), its own horizontal scroll at 390 px.
9. CTAs: instant → "ปรับแต่งและดูราคา" (`/configure/{slug}`), quote → "เพิ่มในใบขอราคา" (shared tray).
10. `fit.ts` + tests (rotation, exact fit, no fit, invalid input, utilisation, low-fit tip) using the approved
    clearance rule (Q2).
11. Size finder UI + size buttons + to-scale chart (L × H, same scale) + selected-size panel + `?size=`. "สั่งเบอร์ X"
    → `/configure/{slug}?size=X`. "ดาวน์โหลดแบบกล่อง" hidden (no style variant). Multi-size button behind
    `category.multiSize` (off).
12. Per-size prices behind `category.sizePrices` (off until C1 is live). Test that they equal the configurator's
    `calculate` for the same size.
13. Guide (flute / material) from content + API material attributes. "เปรียบเทียบวัสดุทั้งหมด" only when `/materials`
    has data.
14. "ต้องการแบบอื่น": `/styles?cat=` with the live facet count (only if > 0) + quote CTA.
15. Category FAQ + FAQPage JSON-LD (only with approved items). ItemList + Product offers (only items with a real
    price) + BreadcrumbList.
16. Analytics: `category_use_filter`, `category_view_toggle`, `category_size_find{dims,result}`,
    `category_size_select`, `category_size_cta{size,cta}`, `category_guide_view`, `category_crosslink_styles`.
17. Gate: e2e for corrugated + one quote-only category + standard_product (grid). Screenshots of all 14 at 1440 and
    390 (+ dark). No horizontal scroll at 360/390. Wording grep (GLOBAL-RULES §1–3). Lighthouse budget.

## 8. Open questions

- **Q1** Who owns category content: a repo file reviewed by business (this plan), or the back office (C5)?
- **Q2** Finder clearance: 0.5 cm **per side** (+1.0 cm per dimension) as the copy says, or +0.5 cm per dimension as
  the prototype code does? And the low-fit tip threshold (45 %)? Both look like settings, so they should come from
  the API, not the content file.
- **Q3** Are standard sizes inside (internal) dimensions? The configurator sends them as `basis: "internal"`. Does
  the engine map them to the admin `calc*` dims (per flute)?
- **Q4** Should the size finder also run for quote-only categories with 3-D standard sizes (folding carton) as a
  fit-only aid, or only where the category is instant?
- **Q5** Flute guide: may we show qualitative strength / print / value levels? Who supplies them? (The prototype's
  meters and "หนาราว x มม." are fake. Only API `caliperMm` is real.)
- **Q6** Style ↔ catalogue category map: corrugated→corrugated, folding_carton→folding_carton,
  tag_sleeve→tag_sleeve, and are `flexible`→flexible_pouch, `rigid`→rigid_box, `label`→label_sticker right? Where
  do `insert` and the `paper_bag` family belong?
- **Q7** Which corrugated product drives the finder: the postal box only, or a switcher across the 5 products that
  have sizes?
- **Q8** Postal-box description "1–2 สี" vs options "ดำ · CMYK": which is true? Also the `[DEV]` label on the fruit
  box, and the W × L × H order in size names.
- **Q9** Service category: does it keep the quote CTA and the "ต้องการแบบอื่น" band? (Today `CategoryView` hides the
  trailing RFQ tile for service unless a type is RFQ, and all are RFQ on UAT.)
- **Q10** Mixed categories in production (instant + quote in one category): facts label wording.

## 9. What the user must verify locally

1. `http://localhost:3001/products/corrugated` (and any other category): the sidebar shows "1 · ประเภท" on every
   category, and the 5 chips show regardless of results. "ขอใบเสนอราคา" and "มีโปรโมชัน" give an empty list on
   corrugated. On `/products/standard-product`, any chip empties all 101 stock items.
2. In the back office: each category really holds one product type (UAT seed) or more (production?).
3. Product photos are real production photos (no generated images), GLOBAL-RULES §3.
4. With a non-UAT backend only: `/configure/uat-postal-box-b?size=C` prices size C. Compare with what C1 will
   return.
5. The data bugs in §1.3 (postal box "1–2 สี", fruit box "[DEV]" label, W × L × H in size names).
