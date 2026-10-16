# U3 — Style Library at scale (frontend + `@getpack/dieline`)

> อ่าน `CLAUDE.md`, `docs/prompts/00-master-plan.md`, `docs/decisions.md`, `docs/design-tool/architecture.md`, `docs/design-tool/style-authoring.md`, `docs/design-tool/style-library-program.md` และไฟล์ข้อมูล `docs/design-tool/style-library-master.json` ก่อนทุก session
> ลำดับ: หลัง U-F0 (integration) · ขนานกับ U2 ได้ · ทำทีละ session (U3.1 → U3.6) · **ทุก session เริ่มด้วย gap analysis** เทียบกับโค้ดจริงใน `packages/dieline` และ `src/features/designer`
> ห้ามนำเข้า/วาดตาม/โมเดลใหม่จากเทมเพลต ม็อกอัป หรือไฟล์ของแพลตฟอร์มอื่น — ทุกโครงสร้างสร้างจากความรู้เชิงวิศวกรรมบรรจุภัณฑ์ มาตรฐานอุตสาหกรรม และ dieline ที่โรงงานพาร์ทเนอร์อนุญาตเท่านั้น

---

## Goal
Grow `@getpack/dieline` from ~30 hand-written styles to the **105 base structures / 960 structural variants** in `style-library-master.json`, every one validated, folded in 3D, priced (instant or RFQ) and makeable by at least one partner. Wave 2 must pass 881 producible variants. Counting rules are in `style-library-program.md` §1 — do not count sizes, materials, prints or mockup scenes.

## U3.1 — Module system (engine refactor, no new styles yet)
1. Introduce composable **modules** in `packages/dieline/src/modules/`:
   - `body/`: `tube4` (four panels + joint), `tray` (base + walls, corner strategies glued/lock/double-wall), `ngonTube` (n = 3, 6, 8), `taperedPail`, `pouchWeb` (front/back/gussets/seals), `flatShape` (rect, rounded, circle, oval, custom path), `cone`.
   - `closure/`: `straightTuck`, `reverseTuck`, `airplaneTuck`, `seal`, `snapLock123`, `crashLock`, `fourFlapLock`, `hingedLid`, `petal`, `gableHandle`, `rsc` / `hsc` / `fol` / `cssc` flap sets.
   - `feature/`: `window`, `hangTab` (euro slot, round hole, sombrero header), `thumbNotch`, `tearStrip`, `adhesiveStrip` (single / dual-return), `handHoles`, `vents`, `dispenser`, `neckLock`, `dustFlapLock`, `slitLock`.
   - `pieceSet/`: `lidAndBase`, `sleeveAndDrawer`, `bodyAndInsert`, `partitionGrid(rows, cols)`.
2. Each module declares: parameters with units and defaults, **constraints** (expressions over dims, caliper and other modules' params), the faces/edges it contributes (with roles cut, crease, perforation, half-cut, glue area), **hinges** for the 3D fold, and a manufacturability rule set.
3. A **recipe** (`StyleRecipe`, JSON) = body + closures (top/bottom or per side) + features + piece set + incompatibility rules + TH/EN names + public code + reference code (`verify` flag). `buildFromRecipe(recipe, dims, material)` returns the dieline, the hinge graph and derived min/max.
4. Re-express every existing style as a recipe; snapshot tests must show **byte-identical or explained** dieline output for all current presets (differences documented in PROGRESS with prepress sign-off).
5. ADR-0011 "Composable style recipes".

## U3.2 — Constraint solver & manufacturability rules
1. For any recipe + material: compute the valid ranges of L/W/H (and extra params) by combining module constraints; expose `validRanges(recipe, material)` and `explain(violation)` returning a reason code + the rule that failed (for the UI to translate).
2. Material classes (`paperboard`, `food_board`, `corrugated` by flute, `rigid` greyboard + wrap, `flexible` laminate, `paper`, `label_stock`, `shrink_film`) with caliper and rule sets (minimum panel width, cut-to-crease distance, slot width vs caliper, glue-flap width, window margin, minimum tuck depth, crash-lock minimum depth, seal widths for pouches).
3. Partner machine envelope check: given max sheet/web sizes from the API (capability data), return which partners can make the flat blank at the requested size (the API is authoritative; this is for instant UI feedback).
4. Property tests: any size inside `validRanges` builds without violation; any size outside fails with a reason code.

## U3.3 — Automatic 3D, virtual fold test, assets
1. Generate the 3D model from the hinge graph (react-three-fiber in the app, pure geometry in the package): fold angles, open/close animation, thickness from caliper, flexible/pouch as an inflated surface approximation, rigid as wrapped trays.
2. **Virtual fold test** in CI: for min / typical / max sizes and two calipers, the closed model's bounding box must equal the expected outer dimensions ± 1 mm, and closure faces must not intersect (collision check).
3. Asset pipeline (`pnpm styles:render`): per variant produce a 2D thumbnail, a 3D thumbnail (neutral kraft and white board, our own lighting presets), the dieline SVG, and a JSON manifest; stored under `packages/dieline/generated/` and published with the package (or uploaded by the API's drawing service — follow ADR-0007).
4. Generate TH/EN names and short descriptions for each variant from the recipe (module labels + feature phrases), reviewed by a human before publishing; never marketing claims.

## U3.4 — Waves of styles
Implement recipes from `style-library-master.json` in wave order. For each wave:
1. Implement missing modules first, then recipes; every variant must pass U3.2 + U3.3 gates and the existing dieline tests (closed loops, no overlaps, key dimensions).
2. Mark variants `publishable=false` until the API confirms a pricing path and at least one capable partner (U3 backend §3–§4); the library shows only publishable variants.
3. Update `docs/design-tool/style-mapping.md` and regenerate `docs/design-tool/styles/*.png`.
4. PROGRESS entry with counts: base, variants implemented, variants publishable, per category.
- **Wave 1**: all `wave = 1` rows (41 bases, ≈ 580 variants).
- **Wave 2**: `wave = 2` rows (cumulative 90 bases, ≈ 910 variants) — the milestone that passes 881.
- **Wave 3**: `wave = 3` rows (cumulative 105 bases, ≈ 960 variants).

## U3.5 — Library & configurator UX
1. **Style library** page in the customer zone: category tabs (กล่องกระดาษแข็ง, กล่องลูกฟูก, กล่องแข็ง, ถุงและซอง, ฉลาก, แท็กและปลอก, ตัวรอง/ช่องกั้น), faceted filters (closure, feature, use case, material class, printability, size range, instant vs RFQ), search with Thai + English synonyms (e.g. "หูช้าง" ↔ mailer), sort (popular, new, instant first), favourites, compare up to 3 styles side by side (dimensions ranges, materials, lead time, starting price from the API).
2. **Variant picker** inside a base style: toggles for each structural option (top/bottom closure, window, hang tab, insert …) with the 3D preview updating live and incompatible options disabled with the reason.
3. Every card and detail page shows the style code, the international name when verified, "ราคาทันที" or "ขอใบเสนอราคา", and the available size range for the selected material.
4. Performance: virtualised grid, thumbnails as AVIF with correct `sizes`, 3D only on detail/hover (lazy); Lighthouse marketing budget on the library route with 960 items.
5. SEO: one indexable page per base structure with its variants, structured data, Thai and English slugs; no thin pages per size.

## U3.6 — Partner dieline intake (UI) & structural design request
1. Admin/prepress screen to import a partner DXF/PDF, overlay it on the closest recipe, adjust parameters until it matches (deviation report ≤ 0.5 mm), then save as a new recipe or as a fixed-size template with the partner's permission record.
2. Customer "ไม่เจอแบบที่ต้องการ" flow: describe the product (dimensions, weight, use, photos) → creates a structural design request (API) → status in the account area; when approved the new style appears in the library and the requester is notified.

## Definition of Done (each session)
- `packages/dieline` unit + property tests, virtual fold tests and snapshot tests green; `pnpm styles:render` reproducible.
- Library and configurator run on the real API; counts in PROGRESS; axe + Lighthouse budgets; visual snapshots reviewed.
- No asset, template, model or wording from another platform anywhere in the repo (review checklist item).
