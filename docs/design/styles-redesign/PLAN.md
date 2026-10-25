# /styles redesign — Phase 0 plan

Status: **draft, waiting for approval** · Phase 0 (discovery, no code) · 2026-10-25
Inputs read: `PROMPT-styles-redesign.md` (shared context + phases), `styles-redesign-prototype.html` (UI + "ดูสิ่งที่เปลี่ยน" spec), `design-tokens.css`, `catalog-commercial-data-template.csv`, repo `CLAUDE.md`, `docs/decisions.md`, `docs/performance-budgets.md`, `src/lib/api/schema.d.ts`, and the current `/styles` code. Header bug reproduced on the running dev server (`localhost:3001`).

---

## 0. Blocking conflicts — need a decision before Phase 1

`CLAUDE.md` says `docs/decisions.md` overrides everything else, and hard rule 10 says stop and ask. These items in the brief contradict an accepted decision, a repo rule, or the API as it is:

| # | Brief says | Repo / decision says | Options |
|---|---|---|---|
| C1 | API prices are **ex-VAT**; "รวม VAT" switch multiplies by 1.07 in the UI | `StylePriceDto.unitPrice` is **"per piece incl. VAT"** (D-220, D-247). `CLAUDE.md`: "never computes money… never do arithmetic on it"; `studio/no-money-arithmetic.test.ts` enforces it | (a) drop the switch, label prices "รวม VAT" (they already are); (b) API adds `unitPriceExVat` (contract request) and the switch picks one of two API values — no arithmetic in web |
| C2 | Compare **up to 4** | **D-246: up to 3**; `COMPARE_LIMIT = 3`, `store.styles.compare` takes 3 | keep 3 (copy "0/3"), or product owner amends D-246 + API |
| C3 | "ราคาประมาณ ฿a–b/ใบ" for quote-only styles (card + quick view) | **D-220: no reference config / no instant path → no hint, "never an estimate"** | drop estimates; or product owner amends D-220 (then API work) |
| C4 | Fonts: Anuphan headings + **IBM Plex Sans Thai** body + **IBM Plex Mono**, loaded via `next/font` (Google) | **ADR-0001**: self-hosted only, no runtime Google Fonts; Anuphan is *the one UI face* (body + headings), JetBrains Mono for codes, ≤ 180 KB of fonts | keep Anuphan + JetBrains Mono (recommended); or new ADR to add IBM Plex via `next/font/local` (+~60–90 KB) |
| C5 | Tokens: brand `#17573F` / dark `#56BC91`, radius 8/12/16, warm paper `#F6F5F1` | Theme tokens in `src/ui/tokens/*` (ADR-0003): primary `#0F5F4E` / dark `#2AA88E`, radius 10 control / 14 card / 16 panel. Changing them changes **every page in all three zones** | map the prototype onto existing tokens, add only the new `instant` status colour (recommended); or a site-wide brand-token update as its own reviewed change |
| C6 | URL params `view=all`, `page`, `/packaging/[slug]` landing pages | D-410: views are `/styles` and `/styles?view=variants`; pages are cursor-paged (`meta.nextCursor`, no page numbers); use-case landing pages already exist at **`/styles/for/[useCase]`** (+ `/styles/options/[topic]`) | keep `view=variants` + cursor (add `page` only if API adds offsets); grow `/styles/for/[useCase]` into the landing pages instead of a second route tree (recommended) |
| C7 | Multi-select facets, OR within a group (`use=a,b`) | `GET /v1/store/styles` takes **one value per facet** (`closure`, `feature`, `useCase`, …). Only the variants endpoint has disjunctive `option[]` | contract request for array params + disjunctive counts; until then single-select per group (radio-like checkboxes) |
| C8 | Analytics events `catalog_*` via existing lib | `track()` takes a **closed union** (`FUNNEL_EVENTS`) and the API ingest (`AnalyticsEventName`) accepts none of `catalog_*` | contract request for a `catalog` ingest name/shape; meanwhile push to GTM `dataLayer` (GA4, consent-gated) only |
| C9 | LINE OA ID from env `NEXT_PUBLIC_LINE_OA_ID` | Already an API setting: `store.support.channels` → `lineOaId` (`getSupportChannels()`); CLAUDE.md: configurable values come from the API | use `lineOaId` from the API, hide when null (recommended, no env var) |
| C10 | Perf budget LCP < 2.5 s, CLS < 0.1 | `docs/performance-budgets.md`, customer-marketing set: **LCP ≤ 2.0 s, CLS ≤ 0.05, initial JS ≤ 150 KB** (currently ~257 KB) | follow the stricter repo budget |

Smaller ones I'll take the conservative route on unless told otherwise: the rename "แบบย่อย" → "ตัวเลือก" applies to the storefront `styles.json` keys only (admin copy untouched); "สั่งกล่องตัวอย่าง" is hidden (the sample flow `POST /v1/store/samples` needs a `quoteId`, there is no per-style sample).

---

## a. Mapping — prototype section → files → reused components

| Prototype section | Create / modify | Reuse |
|---|---|---|
| Header (overlap fix, avatar initials, hamburger < 1040px, cart count) | modify `src/features/customer/shell/SiteHeader.tsx`, `features/customer/auth/AccountButton.tsx` (name only in menu/tooltip) | `MobileProductsMenu` drawer, `CartButton` (already has count), `Avatar`, `DropdownMenu`, `Tooltip`, `HeaderSearch` |
| Breadcrumb + H1 + lede with totals | modify `app/[locale]/(storefront)/styles/page.tsx`; new `features/customer/styles/LibraryHead.tsx` | `Breadcrumbs`, `getLibraryTotals()` (`libraryStyles` / `libraryTotal`) |
| Big live search ("/" focus, ค้นหาบ่อย, tabs คำ/ขนาด) | new `styles/LibrarySearch.tsx` (client, debounced `router.replace`) | `SearchInput`, `Tabs`, `Kbd`; size tab hidden until size data (Phase 2) |
| Category rail | new `styles/CategoryRail.tsx` (server, links) — replaces chip nav in `page.tsx` | `ProductThumb`/`productFamilyOf` icons, `facetLabel` |
| Filters sidebar + bottom sheet | new `styles/FilterPanel.tsx`, `styles/facet-groups.ts` (+test); remove sidebar block + CSS-checkbox toggle from `page.tsx` | `Switch`, `Checkbox`, `DisclosureList`, `MaterialSwatch`, `Sheet` (≤ 1040px), `Badge` chips |
| Active filter chips + ล้างทั้งหมด | new `styles/ActiveFilters.tsx` | `Badge`/`IconButton` |
| Toolbar (count, view toggle, sort, VAT, copy link) | new `styles/LibraryToolbar.tsx`; `LibraryViews.tsx` becomes the toggle | `SegmentedControl`, `NativeSelect`/`DropdownMenu`, `Switch` (if C1-b), `Toast` |
| Product card | modify `StyleCardFace.tsx`, `StyleCardActions.tsx` (heart on image, compare checkbox), `cardWords()` | `ProductCard` (extend in `src/ui` for spec row / 2-line clamp), `Badge`, `storeImageSrc`, `previewSrc` |
| Results grid + load more | modify `StyleResults.tsx` (progress "แสดง x จาก y") | `VirtualGrid`, `Meter` |
| Compare tray | modify `CompareTray.tsx` (thumbnails, toast at limit) | `compare-store.ts`, `/styles/compare` page, `Toast` |
| Quick view drawer (`style=` param) | new `styles/QuickView.tsx` (dynamic import), reads `getStyle(code)` | `Sheet`, `Tabs`, `DescriptionList`, `VariantPicker`, `DielineDownloadEntry`, `StylePreview3D` (Phase 3), `studioHref`, `variantRfqHref` |
| LINE button | new `features/customer/shell/LineFloat.tsx` | `getSupportChannels().lineOaId`, `Popover`; "ฝากเบอร์ให้โทรกลับ" → existing `store.support.handoff` (`/help/chat`) |
| Empty state | `page.tsx` | `EmptyState`; "ขอแบบใหม่จากทีม" → `/account/structural-requests/new` (D-273, already used) |
| Analytics | new `styles/catalog-events.ts` | `lib/analytics/track.ts` / GTM (see C8) |
| Wizard (P2) | new `styles/HelpMeChoose.tsx` (dynamic) | `Dialog`, `Stepper`, `RadioCards` |
| SEO landing (P2) | grow `styles/for/[useCase]/page.tsx` | `JsonLd`, `alternateUrls`, `sitemap.ts`, `app/llms.txt` |
| Trust section (P2) | new `styles/TrustBlock.tsx` | `features/customer/trust/api.server.ts` (guarantee, network stats D-201, reviews) — no certs/logos/photos source exists |
| Account menu / ทำต่อ (P3) | `AccountButton.tsx` | routes `/account/designs`, `/account/quotes`, `/account/company`, `/account/orders`, `features/customer/repeat` |

## b. Data gap — UI needs vs API today

Checklist = CSV columns + quick-view/card fields. **Card** = `StyleCardDto` (`GET /v1/store/styles`); **Detail** = `StyleDetailDto` (`GET /v1/store/styles/{code}`).

| Field | Status | Where / note |
|---|---|---|
| style_code | available | `code` |
| name_th / name_en | available | `nameTh` / `nameEn` (card + detail) |
| family_th | derivable | `family` code → `styles.families.*` i18n |
| category | available | `category` |
| length/width/height min/max | **detail only** | `sizeRanges[]`: mm, **inside** size (D-182), per `materialClass`, every bound nullable, `source` recipe/pattern_rules. Not on card → card size range = missing |
| moq_units | **missing** | no style-level MOQ in any style DTO |
| lead_time_days_min/max | **detail only** | `leadTime { minDays, maxDays } \| null`; not on card |
| price_mode | available | `pricePath` (`instant` \| `rfq`) |
| starting price | available (instant) | `startingPrice { unitPrice (incl. VAT), quantity, computedAt }` — null without a D-220 hint |
| price_est_low/high/basis | **missing + blocked by D-220** (C3) | basis qty derivable from `startingPrice.quantity` for instant only |
| tier prices 500/1,000/3,000/5,000 | **missing** | one starting price only; would need configurator quote per qty (API) |
| ex-VAT price | **missing** (C1) | — |
| recyclable / plastic_free / certifications | **missing** | — |
| dieline .ai download | available | `DielineDownload` already offers pdf / ai / dxf / svg (sign-in, T12) |
| dieline image (hover / แบบคลี่ tab) | derivable | `/style-previews/{code}` (`previewSrc`, drawn by `@getpack/dieline`) + detail `assets[kind=dieline_svg]` |
| 3D | partial | `assets[kind=thumbnail_3d]`, `StylePreview3D.tsx` exists |
| photo / thumbnail | available | `thumbnailUrl`, `photo { url, alt }` |
| options / chips | available | `options[]` (`axis:value`) → `topicsOf()` |
| variant count | available | `variantCount` |
| use cases | detail only + facet | detail `useCases[]`; list facet `useCase` |
| material + swatch | derivable | `materialClass` + `MaterialSwatch` (colour map in web) |
| facet counts | available, single-value | `facets.*` — only one value per facet in the query (C7); disjunctive counts confirmed for `category` only |
| total matches | derivable | no `meta.total` on the style list; today = sum of category facet counts |
| library totals | available | variants `meta.libraryStyles` / `libraryTotal` |
| instant-only count ("· 16 แบบ") | available | `facets.pricePath` |
| LINE OA ID | available | `store.support.channels.lineOaId` |
| account initials | available | `getActor().displayName` |
| ค้นหาบ่อย terms | **missing** | no config; brief allows config now → needs a settings/CMS source (not hard-coded) |
| trust: certificates, food-grade docs, production photos, customer logos | **missing** | only guarantee / network stats / reviews exist |
| sample per style | **missing** | sample flow needs a quote |
| account: projects, team & approvers, tax-invoice data, pending-quote badge | partial | `/account/designs`, `/account/company`, `/account/quotes` exist; pending count unknown (Phase 3) |
| size-fit search | **missing** | no `size` param on the list; fit needs per-style ranges server-side |

Consequence for Phase 1 cards: spec row (size / MOQ / lead time) will be **empty for every card** until the list DTO carries them — I will not N+1 the detail endpoint from the grid. Proposed contract request `store.styles.card-commercial`: add `sizeRange` (overall min/max mm), `leadTime`, `moqUnits`, `useCases` to `StyleCardDto`.

## c. Facet structure today and grouping

- `closure` and `feature` values are `axis:value` (e.g. `tuck_bottom:crash_lock`); `facetLabel()` renders them as **"{axis}: {value}"** — the repeated prefix ("ก้นกล่อง: ก้นล็อกอัตโนมัติ", "ก้นกล่อง: ก้นล็อก 4 ปีก" …) the brief wants removed.
- Other facets are flat codes: `category`, `family`, `materialClass`, `pricePath`, `useCase`.
- Plan (`facet-groups.ts`, pure + unit-tested): split each value at the first `:`, group by axis, heading = `axisLabel(axis)`, item = `valueLabel(axis, value)`; axis order follows `VARIANT_GROUPS` (ฝาบน, ก้นกล่อง, หน้าต่าง, หูแขวน, more) then the API's order. Groups:
  1. `ราคาทันทีเท่านั้น` switch ← `pricePath=instant` (top, with count)
  2. ฝาและการปิด ← `closure` axes (sub-groups per axis)
  3. ลูกเล่น ← `feature` axes (sub-groups per axis)
  4. เหมาะกับ ← `useCase` as chips
  5. วัสดุ ← `materialClass` with swatches
  6. ตระกูลโครงสร้าง ← `family`
- Each sub-group: first 5 + "ดูเพิ่มอีก N รายการ"; counts from the API; zero-count values hidden unless selected.

## d. Header bug — cause

Reproduced at 1054 px with a signed-in name (Piyapan Pakpisitjaloen): nav spans x 115–569 while the logo ends at 143 and the search icon starts at 541 → "สตูดิโอออกแบบ" over the logo, "ติดต่อ" (533–569) under the search icon. Signed-out it fits (right column 364 px).

Cause: the desktop bar is `grid-cols-[auto_1fr_auto]` from `lg` (1024 px). The right `auto` column grows with the account **name** (`max-w-[10em]`, shown from `lg`) to 489 px; the middle `1fr` track then collapses to 350 px, narrower than the five `whitespace-nowrap` links (454 px). The nav sits in a `flex justify-center` cell, so it overflows **symmetrically** — over the logo on the left and under the search on the right. It stops at ~1150 px (1180 px clears by 35 px; 1280 px by 27 px).

Fix (Phase 1 #1): avatar + initials only in the bar (name in tooltip/menu), `minmax(0,1fr)` middle track with `justify-content: safe center`, and hamburger below 1040 px (custom breakpoint, today the drawer stops at `lg`).

## e. Risks

- Initial JS: storefront is ~257 KB vs 150 KB budget; filters/sheet/quick view must stay server-rendered or dynamic (no new Radix on first load).
- Live search with `router.replace` re-renders the server page per keystroke (debounce 160 ms + `useTransition`); the BFF/API rate limit must tolerate it.
- Quick view via `?style=` must not make every quick-view URL indexable: canonical stays `/styles`, the style's own page `/styles/{slug}` remains the indexable one.
- Removing `view=variants`' separate filter system ("one system only") affects the D-410 variants grid; plan keeps `VariantsView` behind the toggle and aligns its UI, not its API.
- Cursor paging + "แสดง x จาก y" needs `total` — derived from facet sums (exact only while category counts ignore their own filter).

## f. Open questions (besides C1–C10)

1. "ค้นหาบ่อย" source: OK to add an API setting (contract request) and hide the row until it exists?
2. Should the header changes (global component) ship in this branch, or a separate one? They affect every storefront page.
3. VAT preference persistence "account setting if logged in" — no such account field exists; contract request, or browser-only for now?
4. Commit the reference pack (`docs/design/styles-redesign/*`) to the branch so later phases can read it? (done in this branch — see below; revert if not wanted)

## g. Phase 1 — ordered tasks (after decisions)

1. Contract requests in `docs/contract-requests.md` (+ MSW mocks marked `// CONTRACT-REQUEST`): card commercial fields, multi-value facets, catalog analytics ingest, (C1-b ex-VAT price), quick-search terms.
2. Token mapping: add `instant` / `instant-subtle` semantic tone (light + dark, contrast test), nothing else unless C5 says so.
3. Header fix + avatar initials + hamburger < 1040 px (+ e2e at 1024/1054/1180/1440).
4. `query.ts` → URL contract v2 (parse/serialise, defaults omitted, `style` param) + unit tests.
5. `facet-groups.ts` + tests.
6. Page head: breadcrumb, H1, lede with totals, compact height.
7. Live search (debounce, "/", tabs shell).
8. Category rail.
9. Filter panel (desktop) + bottom sheet (≤ 1040 px) + active chips.
10. Toolbar: count, view toggle, sort, copy link (+ VAT per C1).
11. Card anatomy (+ `src/ui` ProductCard extension, equal heights, 228 px grid).
12. Compare tray (limit per C2, thumbnails, toast).
13. Quick view drawer (dynamic import, `style=` param, focus trap/Esc/return focus).
14. LINE float button from `lineOaId`.
15. Empty state.
16. Analytics wrapper per C8.
17. Load more progress + verification: lint, typecheck, tests, Lighthouse mobile, screenshots, report.
