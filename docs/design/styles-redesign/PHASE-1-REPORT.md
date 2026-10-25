# /styles redesign — Phase 1 report

Branch `design/styles-catalog-redesign` (from `main`), 2026-10-25. Decisions: `PLAN.md` §0.1 (all recommendations approved), plus **"whatever staff may change later is data from the API, not code"**.

## Summary

The library page is rebuilt to the prototype on the repo's own stack (`src/ui`, next-intl, server rendering from `searchParams`, the BFF): header fix, compact head with live search, category rail, one filter system (sidebar ≥ 1040 px, bottom sheet below), toolbar, active-filter chips, the new card, compare tray, quick view over `?style=`, LINE button, empty state, catalog analytics and "แสดง x จาก y". Nothing fake is rendered: every element whose data the API does not have is left out, and each gap is a contract request.

What staff control (no release needed): categories and their order, facets/values/counts (API), quick search terms, compare limit, material swatches, trust content (`store.style-library.settings`, requested), the LINE OA id (`store.support.channels`), featured badges and curation (existing `styles.curate`).

## Commits

| Commit | What |
|---|---|
| `7c2f37c2` | reference pack (prototype, tokens, CSV, prompts) |
| `b262ecf1` | Phase 0 plan |
| `ff79d267` | contract requests: `store.style-library.settings` (+ mock), card commercial fields, ex-VAT price, multi-value facets, catalog analytics |
| `e7162b6e` | header: no overlap 1024–1180 px, avatar initials, drawer < 1040 px |
| `211ad2de` | URL state v2 + facet grouping (+ unit tests) |
| `0f5eb02b` | `instant` status tone (light/dark/HC, contrast-gated) |
| `d45549b5` | copy (TH verbatim / EN), "แบบย่อย" → "ตัวเลือก", material swatches setting |
| `593e1519` | compare limit from settings (D-246 default 3) |
| `a4033e17` | `ProductCard` slots, `zap` icon |
| `abcf0e92` | filters + sheet, live search, sort/copy/search-tracking, quick view, LINE |
| `e72116dc` | the redesigned page |
| `0a9c7ccd` `ac672465` | width/rail/LINE-panel fixes; quick view click capture; card foot wrap |
| `b6395e9f` `abbad1b2` | e2e updates, pill fixes, canonical rule, prettier |

## Files

New in `src/features/customer/styles/`: `FilterPanel`, `FilterSheet`, `FilterSheetBody`, `LibrarySearch`, `LibraryControls`, `QuickView`, `QuickViewHost`, `LineFloat`, `catalog-events`, `facet-groups` (+test), `compare-limit`, `query.test`. Rewritten: `query`, `StyleCardFace`, `StyleCardActions`, `StyleCardView`, `StyleResults`, `CompareTray`, `LibraryViews`, `app/[locale]/(storefront)/styles/page.tsx`. Touched: `SiteHeader`, `AccountButton`, `ProductsMenu`, `DropdownMenu` (heading), `ProductCard`, `Badge`, icon registry, tokens, `compare-store`, `VariantPicker` (compact), `VariantActions` (`onAction`), style and compare pages, messages, contract registry, mocks, e2e.

## Checks

- `pnpm typecheck` ✅ · `pnpm lint` ✅ (one pre-existing warning in `SearchSelect`) · `pnpm test:app` ✅ 1,245 tests (12 new) · `pnpm contrast` ✅ 150 pairs, 3 themes · prettier ✅.
- Header measured on the dev server with a signed-in-width avatar: no overlap at 1024 (drawer), 1040, 1054, 1180, 1440.
- 390 px: no horizontal scroll; bottom sheet focus-trapped, Escape returns focus to "ตัวกรอง"; quick view opens by click and by URL, Escape closes it and focus returns to the card; live search, "/", chips, canonical verified in the browser.
- **Not run here:** `pnpm e2e` and Lighthouse need `pnpm build`, which ran out of memory in this sandbox (8 GB). e2e specs were updated for the new UI — please run `pnpm e2e --grep "style library"` and `pnpm lhci` locally. Field data: the existing Web Vitals RUM (posted through the BFF) covers LCP/INP/CLS for `/styles`; watch the `customer-marketing` budget (LCP ≤ 2.0 s, CLS ≤ 0.05).

## Screenshots

In the session's outputs (`styles-phase1-screens/`): 1440 light, 1054 light, quick view at 1440, 390 dark (cards). The filter sheet at 390 px was verified through the DOM and e2e; the browser pane did not repaint for a screenshot of it.

## Missing data (UI hidden until it exists)

| UI | Needs | Request |
|---|---|---|
| Card spec row: size range, MOQ, lead time | `StyleCardDto.sizeRange`, `moqUnits`, `leadTime` | `store.styles.card-commercial` |
| Quick view MOQ, tier table 500/1,000/3,000/5,000 | MOQ; tier prices from the pricing engine | `store.styles.card-commercial` (+ Phase 2 API) |
| "ราคาประมาณ" for quote styles | — blocked by D-220 (decision C3) | — |
| "ราคารวม VAT" switch | `StylePriceDto.unitPriceExVat` | `store.styles.price-ex-vat` |
| Several values per facet (OR) | repeatable params + disjunctive counts + `meta.total` | `store.styles.multi-facets` (UI ready: `MULTI_VALUE_FACETS`) |
| "ค้นหาบ่อย", compare limit, material swatches, trust block, tax-invoice note | staff settings | `store.style-library.settings` (mocked) |
| catalog_* analytics in getpack's own reports | ingest names | `store.analytics.catalog-events` (GTM meanwhile) |
| LINE button | `lineOaId` set in support channels | (exists; your local API returns none, so it is hidden) |
| "สั่งกล่องตัวอย่าง" | a per-style sample flow (today's needs a quote) | Phase 2 question |
| Search by size tab | per-style min/max dims + `size` filter | Phase 2 (API) |

## Open questions

1. **Instant tone vs D-180.** The ochre `instant` tone is darker and browner than the promotional amber and always text-on-tint with an icon — please confirm Marketing is fine that it is still in the amber family.
2. **Pagination in the URL.** The list is cursor-paged (D-410); "โหลดเพิ่ม" is not URL-addressable. Offset pages would need the API to accept `page` — worth requesting?
3. **Images.** Kept the repo's `ProductCard` `<img>` (declared size, BFF origin) instead of `next/image`, per its documented reason; first row eager/high priority. OK?
4. **Sync folder.** `.claude-sync/` (git bundles used to move commits from the sandbox) is excluded via `.git/info/exclude`; delete it whenever you like.
