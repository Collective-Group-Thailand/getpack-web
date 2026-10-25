# Studio entry: Phase 0 findings (A6, web)

Sources: this app's code on `fix/uat-phase0` (after A5), the vendored contract `src/lib/api/schema.d.ts`, `docs/decisions.md`, the dieline engine `packages/dieline`, and GET-only reads of the UAT API (`https://uat-api.getpack.co`, 2026-10-25). Nothing was submitted on UAT. The getpack-api source was not read; where its behaviour matters it is marked *confirm in getpack-api*.

## 1. Routes

| URL | File | What it is |
|---|---|---|
| `/studio` | `src/app/[locale]/(storefront)/studio/page.tsx` → `src/features/customer/studio/StudioHome.tsx` | Hub 1 (server page): 4 path cards, "แบบที่คนเริ่มบ่อย" (3), "แบบล่าสุดของคุณ" (3), help line |
| `/studio/new` | `src/app/[locale]/studio/[designId]/page.tsx` (`designId = "new"`) → `Studio.tsx` → `StartScreen.tsx` | **The editor route.** With no box (no `style`+`l`+`w`+`h` seed), the editor's empty canvas is `StartScreen`, which is hub 2. `?step=` cannot skip it: `lockedReason` returns `needsBox` and `initialStep` falls back to `start`. |
| `/studio/<id>` | same page | Opens a saved design. Shows `StartScreen` too while the design has no box, or for a signed-out account link (the "เข้าสู่ระบบเพื่อเปิดแบบนี้" callout). |
| `/studio/upload` | `src/app/[locale]/(storefront)/studio/upload/page.tsx` | Lists the products that have an instant price → `/configure/<slug>?design=own_file` (A5) |
| `/design/<id>` | `src/app/[locale]/design/[id]/page.tsx` | Legacy redirect → `/studio/<id>?…&step=start\|design` |

Who links to the old hub (bare `/studio/new` or `/studio/new?start=product|product=`):
- `StudioHome.tsx:56` and `:85` (`?start=product`)
- `account/designs/MyDesigns.tsx:187` and `:211`
- `learn/api.server.ts:52` (`actionHref` studio)
- `help/IntentPicker.tsx:29` (`?product=`)
- `home/StudioHeroPanel.tsx:101` (with `style` when known; otherwise only `product`/`material`/`pattern`)
- e2e: `designer-smoke.spec.ts:25`, `designer-editor.spec.ts:12`, `a11y.spec.ts:46`, `journeys/studio.ts:7`, `storefront-ux.spec.ts:209`

Links that carry a box seed, a template or an order are editor entries and must keep working:
- `studioHref()` in `studio/paths.ts`
- `VariantActions`, `StudioStyleLibrary`, `OrderedProducts`, `SampleDesign`, the e2e `BOX` constants

## 2. Every style count and path copy

### Style counts

| Where | Key / code | Text (th) | Source of the number |
|---|---|---|---|
| `/studio` card "เลือกแบบกล่องแล้วออกแบบ" | `studio.home.paths.box.body` / `bodyNoCount` (`StudioHome.tsx:50`) | "{count} แบบที่ผลิตได้จริง ใส่ขนาดของคุณ ระบบคลี่กล่องให้ วางโลโก้ ดูกล่อง 3D" | Sum of `GET /v1/store/styles` `facets.category` (`studio/page.tsx:32`) = **122** on UAT |
| `/studio` "ดูทั้ง {count} แบบ" | `studio.home.allTemplates` (`StudioHome.tsx:140`) | "ดูทั้ง {count} แบบ" | same, 122 |
| `/studio/new` card | `studio.startScreen.box.body` (`StartScreen.tsx:102`) | "เลือกจากคลัง {count} แบบ ใส่ขนาด แล้วออกแบบบนแผ่นคลี่จริงพร้อมดู 3D" | `STYLES.length` from `@getpack/dieline` = **30** (constant, not the API) |
| `/styles` fallback (only when the API library is empty) | `styles.studioLibrary.title` (`StudioStyleLibrary.tsx:37`) | "แบบกล่องในสตูดิโอ {count} แบบ" | `STYLES.length` = 30 |
| Home hero facts / templates | `home.hero.facts.library`, `home.templates.library`, `home.templates.all` | "{count} แบบ ออกแบบเองได้ทุกแบบ", "{count} แบบย่อยจาก {styles} แบบหลัก … ออกแบบเองได้ทุกแบบ" | `GET /v1/store/styles/variants` `meta.libraryTotal` (986) / `libraryStyles` (122); facet sum |
| `/styles` meta description | `styles.listDescription` | "… กว่า 100 แบบ …" | hard-coded |

### Path copy (th; en mirrors it)

| Path | `/studio` (`studio.home.paths.*`, after A5) | `/studio/new` (`studio.startScreen.*`) |
|---|---|---|
| Box | → `/styles`. "{count} แบบที่ผลิตได้จริง …" · "เริ่มเลย" | Opens the editor's "ตั้งค่ากล่อง" dialog (30 engine shapes). "เลือกจากคลัง {count} แบบ …" · badge "ยอดนิยม" (`startScreen.popular`, no data behind it) |
| Product | → `/studio/new?start=product` (dialog on the old hub). "วัดสินค้า ใส่ขนาด ระบบแนะนำทรงกล่องและขนาดภายในที่พอดี พร้อมราคาต่อชิ้น" | Opens the `DescribeProduct` dialog. "ใส่ขนาดสินค้า ระบบแนะนำแบบกล่องและขนาดภายในที่พอดี". Dialog hint `studio.describe.hint`: "…แนะนำกล่องที่ใส่ได้ 3 แบบ พร้อมเหตุผล" |
| File | → `/studio/upload`. "เลือกสินค้า ดูราคาทันที แล้วอัปโหลดไฟล์หลังสั่งซื้อ ทีมงานตรวจไฟล์ให้ก่อนผลิต" · "อัปโหลดไฟล์" | → `/configure/<slug>` **without** `?design=own_file`, or `/products` when there is no product. "ข้ามการออกแบบ ไปกำหนดสเปกและราคา แล้วอัปโหลดไฟล์ให้ทีมตรวจ" · "ไปกำหนดสเปก" |
| Reorder | → `/account/orders` (sign-in first for a guest). "…ปรับจำนวนแล้วสั่งได้เลย ไม่ต้องส่งไฟล์ใหม่" | same target. "…ปรับจำนวนแล้วสั่งได้ในไม่กี่คลิก" |
| Sample | none | "ลองเล่นกับแบบตัวอย่าง (ไม่บันทึก)" → `studioHref({style:"tuck-end", 70×40×150, step:"design"})` |
| Lead | "เลือกทางที่ตรงกับของที่มีในมือ ทุกทางจบที่กล่อง 3D กับราคาเดียวกัน — …" | "เลือกแล้วเราจะพาไปทางที่สั้นที่สุด — …" |
| Help | "…เราเปิดแบบร่างของคุณดูแล้วช่วยแก้ให้ได้ทันที" | none |

Also in the editor (not a hub): the step-① panel `StartPanel` with `studio.start.*` (sample "ลองเล่นกับแบบตัวอย่าง"), and `/studio/upload` with `studio.upload.*` (A5 copy, honest).

## 3. The truth

### 3.1 Style counts

| Number | Meaning | Evidence |
|---|---|---|
| **122** | Bases published in the style library, listed on `/styles`. Each has at least one variant priced (instant or RFQ) and makeable (D-243). | UAT `GET /v1/store/styles` (all pages) = 122; `styles/variants` `meta.libraryStyles` = 122, `libraryTotal` = 986; D-410 "122 bases, 986 variants" |
| 16 | Bases with an instant price (`pricePath = instant`); 106 are RFQ | UAT style list |
| 5 | Catalogue products with an instant price (what `/studio/upload` lists) | UAT `GET /v1/store/catalog/products` (42 products, 5 not RFQ; A5) |
| **81 bases / 772 variants** | What really opens in the Studio from `/styles` ("ออกแบบใน 3D Studio") | All 122 bases have an engine recipe (`ALL_RECIPES` = 210 recipes, 122 distinct bases). But `VariantActions.openStudio` opens only a variant whose recipe has numeric `length`/`width`/`height`. The other 214 variants (41 bases: tubes, bags, tags, labels, pouches, some specialty) show `styles.detail.studioUnavailable`. 14 of 16 instant variants open. *Offline reproduction of `recipeOfVariant` over the 986 UAT variants; spot-check locally.* |
| **30** | Engine core styles (`STYLES`, 20 bases), the choices in the editor's "ตั้งค่ากล่อง" dialog | `packages/dieline/src/styles/index.ts`; not a library or ordering count |

Conclusions:
- "122" on `/studio` is the right *library* number but overclaims with "ใส่ขนาดของคุณ ระบบคลี่กล่องให้ … ดูกล่อง 3D": that is true for 81 bases.
- "30" on `/studio/new` is an engine detail and should not be customer copy.
- The home page's "ออกแบบเองได้ทุกแบบ" is not true today (772 of 986 variants).

### 3.2 What the upload path really does

There is **no automatic check or price on the file before ordering** (A5, `docs/design/upload-redesign/FINDINGS.md`):
1. The customer picks a product on `/studio/upload`.
2. `/configure/<slug>?design=own_file` gives the price from the pricing service.
3. They order.
4. They upload on `/account/orders/<id>/artwork`, where the server preflight runs (9 checks, block/warn; D-070) and Prepress checks before production.

So the honest copy is GLOBAL-RULES §6: "อัปโหลดไฟล์หลังสั่งซื้อ ทีมงานตรวจไฟล์ให้ก่อนผลิต". `/studio` and `/studio/upload` already say this (A5). `/studio/new` does not: it says "ไปกำหนดสเปกและราคา แล้วอัปโหลดไฟล์ให้ทีมตรวจ" and goes to the configurator without `?design=own_file`, or to `/products`. An automatic pre-cart check arrives only with upload Phase 2.

### 3.3 "แบบที่คนเริ่มบ่อย": is there usage data?

**No usage data on UAT, and no per-style Studio usage anywhere in the contract.**
- `/studio` calls `listStyles({ sort: "popular", limit: 3 })`. D-245 defines `popular` as *favourites + saved quotes of the linked style over 90 days*: interest in a style, not "starts in the Studio".
- On UAT, `sort=popular` returns exactly the same order as `sort=name` and the default sort: PK-SP-11 กรวยป๊อปคอร์น, PK-RG-07 กระบอกกระดาษ, PK-SP-22 กล่องของขวัญทรงสอบ, … (Thai alphabetical). So every score is tied or zero, and the section shows the first three catalogue styles by name. No style has `featured = true`.
- Studio analytics (`useStudioFunnel`, `GET /v1/admin/analytics/studio-funnel`, D-286) are aggregate counts per step, tagged only by `styleFamily`. Nothing ranks bases by Studio use.
- PK-RG-07, one of the three shown, **cannot be opened in the Studio** (see 3.1).
- Production may have favourites or quotes; *confirm in getpack-api / production*. Even then, the heading claims "เริ่มบ่อย" (started often), which the data does not measure.

Result: today's heading is a claim with no data behind it (GLOBAL-RULES §3). A curated list already exists for the home page (`src/features/customer/home/templates.ts`, `HOME_TEMPLATE_CODES`); whether the Studio may use it is a business decision.

### 3.4 Other copy that is not true

- "ลองเล่นกับแบบตัวอย่าง (ไม่บันทึก)": the sample is an ordinary new design (`SampleDesign.tsx` doc). The editor autosaves 2.5 s after any change (`designer/data/persistence.ts`): to the account when signed in, to the browser for a guest. There is no no-save sample session. (Phase 1 task 1 assumes one exists.)
- The "ยอดนิยม" badge on `/studio/new` has no data behind it.
- The `/studio` lead "ทุกทางจบที่กล่อง 3D กับราคาเดียวกัน": upload ends in the configurator, and reorder prices again at today's cost (D-153).
- The `/studio` help "…ช่วยแก้ให้ได้ทันที" is a timing claim; LINE support runs 09:00–18:00.
- Outside this pack, customer-facing "โรงงาน" (GLOBAL-RULES §1):
  - `home.templates.body` ("ทุกแบบเป็นทรงที่โรงงานในเครือข่ายผลิตได้จริง")
  - `styles.studioLibrary.body` ("…เมื่อมีโรงงานรับผลิตแบบนั้น")
  - Owner: the home and styles packs.

## 4. Proposal

### 4.1 One hub at `/studio`
- `/studio` is the only "วันนี้อยากเริ่มจากอะไร" page (Phase 1 rebuilds it). Its product finder is inline, with `?start=product` scrolling to it.
- **Redirect, server side**, in `src/app/[locale]/studio/[designId]/page.tsx`, before any data load:
  - When `id === "new"` and the query has none of `style`, `template`, `order`, `item`: `permanentRedirect` (308; Next's equivalent of 301) from `@/i18n/navigation` to `/studio`, keeping the locale and **every other query param** (`start`, `product`, `material`, `pattern`, `utm_*`). Drop `step`.
  - `?start=product` → `/studio?start=product`; the hub scrolls to the finder (`id="finder"`).
  - `?product=x` → `/studio?product=x`; the hub carries the product into the finder and the editor links.
  - A rule in `next.config` cannot express "no style/template/order" cleanly together with the locale and `[designId]`, so the page-level check is simpler and can be unit-tested.
- Editor entries stay exactly as they are: `?style=&l=&w=&h=…`, `?template=`, `?order=&item=`, `/studio/<id>`. `/design/new` without a style should point straight to `/studio`, so there is no chain of two redirects.
- Repoint internal links to `/studio` directly: `StudioHome` (the finder anchor), `MyDesigns` ×2, `learn actionHref`, `IntentPicker`, and the no-style fallback of `StudioHeroPanel`. Update the e2e specs listed in §1. A blank editor start is no longer a public URL.
- `StartScreen` stays only as the editor's empty state (`/studio/<id>` with no box, the signed-out account link). Its four paths and copy come from the shared source in 4.2. Its "file" path goes to `/studio/upload`, or to `/configure/<slug>?design=own_file` when a product is in context. The "ยอดนิยม" badge and "(ไม่บันทึก)" go. Hard rule 2 says the editor itself is not changed; this is copy and links only.

### 4.2 One source of truth
- **Paths:** one module, e.g. `src/features/customer/studio/entry-paths.ts`, with each path's key, href builder (it knows product context and signed-in state) and i18n keys. Both hub and empty state read it, and both use one namespace, `studio.paths.*` in th and en. `studio.home.paths.*` and `studio.startScreen.{box,product,file,reorder}` are then removed.
- **Count:** one server helper reads the API's `meta.libraryStyles` (`getLibraryTotals`), the same number `/styles` and home use. It is labelled as the size of the library ("แบบกล่องในคลัง {count} แบบ"), not as "ออกแบบได้ทุกแบบ". `STYLES.length` stops being customer copy. If the business wants a Studio-ready number, it has to come from the API (open question 1). The web should not compute it from 986 variants on each request.
- **Upload copy:** exactly GLOBAL-RULES §6 until upload Phase 2.
- **"แบบที่คนเริ่มบ่อย":** use real usage when the API provides it. Otherwise use a curated list from config, under a neutral title such as "แบบที่แนะนำให้เริ่ม", never claiming popularity. Only styles that open in the Studio are listed.

## 5. Open questions

1. **Studio count.** Show 122 (library) with per-card Studio availability, or ask getpack-api for a Studio-ready count or flag (`studioReady` on `StyleCardDto` / `meta.studioStyles`; 81 bases on UAT)? If the second, it goes in `docs/contract-requests.md`.
2. **"เลือกแบบกล่อง" from the hub.** Go to `/styles` (81 bases open from there), or keep the editor's 30-shape "ตั้งค่ากล่อง" dialog as a hub entry? The second needs a new editor entry parameter, which hard rule 2 forbids in this pack.
3. **Usage ranking.** Will getpack-api expose per-style Studio starts (or a usage rank), or does the business supply a curated list? Is `HOME_TEMPLATE_CODES` acceptable, and should it hold 6 for the Studio? What is the section called without data?
4. **Sample session.** Build a real no-save mode (an editor change, out of scope here), or change the copy to "ลองเล่นกับแบบตัวอย่าง" with no save claim?
5. **Own fonts.** The pack's context says customers can add their own fonts; D-213/D-284 say OFL Studio fonts only, no customer-uploaded fonts in the first release. Under CLAUDE.md the decision record wins until the product owner confirms. This blocks Phase 1's proof line "ใช้ฟอนต์ของแบรนด์เองได้".
6. **Free `.ai` dieline.** `DielineDownloadFormat` in the contract includes `ai`, but A5 found no `.ai` output and the endpoint text lists PDF/DXF/SVG. *Confirm in getpack-api* before Phase 1 claims "ไฟล์แบบกล่อง .ai ฟรี".
7. **`?product=` on the hub.** Should the hub show "สำหรับ {name}" (as the old hub did), or only carry the product silently into the finder and editor links?
8. **"สั่งซ้ำ" only for customers with orders (Phase 1).** Which store endpoint gives an order count cheaply (`/v1/store/orders` `meta.total`)? *Confirm.*
