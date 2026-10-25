# Studio editor redesign — Phase 0 plan (A7, web)

Branch `fix/uat-phase0` · 2026-10-25 · discovery only, no code changed.
Sources: getpack-web code, `src/lib/api/schema.d.ts`, getpack-api `fix/uat-phase0` @ `b23f270` (read-only clone),
UAT GET only (`/v1/store/catalog/products/uat-postal-box-b`, `…/configurator`, `/v1/store/catalog/price-hints`).
No price `calculate` / `studio.quote` call was made (POST). GLOBAL-RULES.md applies over this plan.

## 1. Editor map (as built)

| Area | Where | What it does today |
|---|---|---|
| Routes | `src/app/[locale]/studio/[designId]/page.tsx` | `/studio/new?product=&style=&l=&w=&h=&sv=&rv=&template=` starts a design; `/studio/<uuid>` opens an account design (404 if not the customer's); `?step=start\|box\|design\|check\|order`; `?order=&item=` links an order's artwork. `/studio` (home), `/studio/upload`. Admin: `features/admin/prepress/AdminDesigner.tsx` (same editor, mode `admin`). Shared links: `features/customer/designer/SharedEditor.tsx` / `SharedDesign.tsx`. |
| Shell | `features/customer/studio/Studio.tsx` → `features/designer/components/Editor.tsx` | 5 steps (StepBar), rail (`shell/panels.tsx`: box, templates, elements, text, uploads, brand, background, layers, comments), canvas, side column (price dock + tabs properties / checks / preview), status bar, phone bottom bar, onboarding (`StudioGuide`). Views `split \| flat \| 3d`, sides outside/inside. |
| State | `features/designer/store/editor.ts` (zustand), `store/status.ts` | document, selection (multi, groups), focused face, zoom 0.1–4, toggles (labels, safe zone, grid, rulers, snapping), clipboard, side, print mode, bleed; undo/redo 200 steps (whole-content snapshots). |
| Document | `features/designer/types.ts`, `document.ts` (schema v2), `data/api.ts` | `spec` (engine DielineSpec + productDims, studio choices: print method/sides/coating/finishes/basis/style variant/design service, patternId, material) and `content` (`elements[]`, `pattern` background incl. gradient/image, `acknowledged[]`). Elements: text (fontSize **mm**), image (asset, natural px, colour space, crop), rect/circle/shape (SVG path in 100×100 box), code (qr/ean13/ean8/upca/code128). Base: x, y, rotation, scaleX/Y, opacity, locked, groupId, name, clipFaceId, `side?: "inside"`, templateRole, studioElementId, finish. **No artwork variants** (only style variants, D-407). v1 (BoxStudio) migrated on read. Server keeps the document opaque. |
| Canvas | `components/DesignCanvas.tsx` (Konva) | wheel zoom, stage drag pan, shift+drag marquee, Transformer handles, snapping (`lib/snapping.ts`) with guide lines, rulers (mm), panel labels, bleed/safe overlays, comment pins, print-mode capture. |
| 3D | `components/Preview3D.tsx` (react-three-fiber), `BoxPreview3D`, `ARView` (model-viewer glTF/USDZ), `Presentation` | live texture of each side (1024/2048 px), fold from the engine's hinge map, AR, presentation scenes. |
| Preflight | `lib/checks.ts`, `lib/fixes.ts`, `data/rules.ts`, `panels/ChecksPanel.tsx`, `customer/studio/checks.ts` | 15 rule ids from one catalogue shared with getpack-api (D-278 `studio.print_rules`, vendored `contract/studio-rules.json`): image_resolution, bleed, safe_zone, min_text_size, hairline, rich_black_small_text, rgb_out_of_gamut, spot_colour_count, crosses_crease, crosses_glue, barcode_across_fold, barcode_invalid, white_ink_needed, finish_min_feature, element_right_missing (+ off_sheet). Fixes: move_inside, extend_to_bleed, min_text, min_stroke, min_code, nearest_spot, in_gamut. Acknowledgements saved (`/checks/acknowledgements`). Shown as a tab, no canvas markers. Separate from the artwork-submission preflight (9 checks, D-070). |
| Autosave / history | `data/persistence.ts`, `storage.ts`, `components/VersionHistory.tsx` | modes local / store / admin / shared; autosave 2500 ms (artwork), **400 ms** (box); `If-Match`, 412 → conflict choice; JSON Patch when only artwork changed (D-276); IndexedDB backup; versions list, name, compare, restore; version locked by an order (D-276). |
| Upload | `panels/UploadsPanel.tsx`, `/v1/store/designs/{id}/assets` | PNG/JPEG/WebP/SVG → design asset (kinds image/font/logo/svg in the contract). |
| Export | `export.ts`, `print.ts`, `export-files.ts`, `customer/studio/renders.ts` | PNG; browser print PDF = artwork as RGB JPEG tiles at 300 dpi + vector die on spot layers (TrimBox/BleedBox); dieline SVG/DXF/PDF; order renders uploaded for the server print PDF (D-280). No PDF/X-4, no CMYK, no .ai, no import. |
| Brand kit | `panels/brand-kit.ts` (localStorage `getpack.brandkit`), `panels/CompanyBrandKits.tsx` | personal kit = colours + logo in this browser only; company kits via API (palette with optional CMYK, font pairs from studio fonts, logos, D-282). Font upload is admin-only, OFL only (D-284). |
| Sharing / permissions | `ShareLinks.tsx`, `ShareDialog.tsx`, `comments/*` | links scoped view/comment/edit, many per design, expire after `configurations.share_link_days`, revocable (D-285); comment/edit need sign-in, edit needs company membership; comments threaded, anchored to face UV or flat mm. Design-service hand-off `/studio/{id}/design-service` (D-286). |
| Pricing | `customer/studio/PriceDock.tsx`, `pricing.ts`, `spec.ts`, `state.ts` | see §2. |

## 2. Price consistency (report; fix owned by A3 = PDP Phase 0)

### 2.1 What each surface prices
All three use the **same engine** (`QuoteEngineService.price`, getpack-api): listing = D-220 hint (reference
configuration priced by the engine, cheapest quantity step, rounded up to the satang, refreshed hourly; UAT
`computedAt` 2026-10-26T00:23+07:00); configurator = `store.quotes.calculate`; editor = `store.studio.quote`
(signed in) or `calculate` (guest), with the spec built by the configurator's own builder
(`stateForDesign` → `buildConfiguration`). The figures differ because the **specs differ**:

| | Listing ฿15.70 | Configurator ฿17.26 | Editor ฿14.79 |
|---|---|---|---|
| Source | `startingPricePerPiece` (D-220) | live calculate, API defaults | studio quote of saved version |
| Size (L × W × H) | 00 = 140 × 97.5 × 60 (catalogue standard size) | 00 (first standard size) | **150 × 100 × 80** = dieline engine preset "S" of slotted styles (`packages/dieline/src/recipes/sets.json`), not a catalogue size → corrugate `standardSize=false` (die block charged) |
| Material | KA125 B | KA125 B (default) | KA125 B |
| Print | CMYK, area `top` (UAT seed reference) | **ดำ** (API `isDefault`), area `top` | **inferred from artwork** (`inksFor`): nothing if empty/white-only, ดำ for 1–3 flat colours, CMYK for a photo or ≥ 4 colours |
| Quantities in request | [300] | tier list (100…5000) | [300] |
| Design fee | none | none (`own_file`) | none (`online_designer`) |

Definite causes: (1) listing reference spec ≠ configurator default spec (CMYK vs ดำ); (2) the editor never offers
the product's standard sizes and starts from the engine preset, so it prices a different size; (3) the editor's
ink depends on the artwork.

Hypotheses to confirm (A3, needs a POST calculate / admin staff view, not run here):
- ฿14.79 is the unprinted price (empty or white-only draft) — a larger box at a lower price fits this.
- CMYK (฿15.70) < ดำ (฿17.26) although the UAT seed prices ดำ "like CMYK": ranking is per quantity by buy cost
  incl. plates and delivery, and tier-B envelopes restrict by print type (D-234), so the two inks may land on
  different factory/print-type paths; or UAT price data changed after seeding. The flat 100/300/500 tiers belong
  to the same investigation.

Also found: `inksFor` prices 2–3 flat colours as one black ink when ดำ is the product's only spot ink; `inferPrint`
drops white (on kraft, white needs ink).

### 2.2 Proposed fix (after approval; A3 first, editor only verifies — GLOBAL-RULES §5)
1. API (A3): the reference configuration = the configurator's default spec (one source) + equality test per
   instant product. The default print is a business decision (Q1).
2. Spec label (A3 helper, ยาว × กว้าง × สูง, mm) under every price; the editor dock reads
   "ราคานี้สำหรับ …" from the priced configuration (prefer spec lines from the API, contract request C5).
3. Editor: a design opened from a product with standard sizes starts on the configurator's default size and the
   box step lists the standard sizes; custom sizes stay, labelled as custom (Q3).
4. Editor dock always states the print priced; an empty design's price per Q2.
5. Web unit test: `stateForDesign` for a design on the default spec ⇒ same `buildCalculateBody` configuration as
   `initialState(configurator)` at the same quantity.

## 3. Gap list vs the prototype

Legend: ✅ exists · ◐ partial · ✗ missing · ⚠ conflicts with a rule/decision.

### Phase 1 — shell, canvas, inspector
- ✗ Mode switch ง่าย/มืออาชีพ, first-open chooser (3 cards + file link), mode saved to account.
- ◐ Top bar: steps ✅ (5 steps; prototype shows ออกแบบ · ตรวจงาน · สั่งผลิต), name ◐, save status ✅, undo/redo ✅;
  ✗ issue badge on step, ✗ price chip, ✗ theme toggle in editor, ◐ สั่งผลิต disabled only when empty (must be
  disabled on blocking errors).
- ◐ Inspector: properties + checks tabs exist; ✗ tabs ออกแบบ / ตรวจงาน / สั่งผลิต; price dock sits above tabs.
- ◐ Canvas: fit exists (`fitSignal`) but dieline shows at 15–28 % with 3D floating over it; zoom 10–400 % → 20–600 %;
  ✗ ⇧1 fit, ✗ Space+drag (stage drag pans today), ✅ ⌘/Ctrl wheel, ✅ labels, ✅ bleed/safe.
- ◐ 3D picture-in-picture that never covers the dieline at fit and opens Mockup.
- ◐ Selection: ✅ click/shift/marquee/snapping/arrows/⌘D/Delete/Esc; ✗ Alt disables snapping, ✗ ⌘] ⌘[ shortcuts
  (store has `reorder`), ✗ size label in mm while resizing, text resize in pt.
- ✗ Live preflight markers on canvas; ✗ "พร้อมพิมพ์" state tied to blocking rules in the status bar (verify).
- ✗ Analytics events listed in the pack.
- ⚠ Finish picker (foil/spot UV/emboss/window) offered ungated in `PropertiesPanel` — hard rule 4.
- ⚠ Box autosave 400 ms < 800 ms (hard rule 6); fonts not loaded via FontFace.

### Phase 2 — easy mode
- ✗ Easy rail set and hidden pro features; ✗ "ออกแบบเสร็จใน 4 ขั้น"; ✗ quick actions; ✗ 9-cell position grid;
  ✗ plain-language image quality; ✗ pt slider (text stored in mm).
- ◐ Auto-fix: one-click fixes exist for 7 kinds; ✗ "แก้ทั้งหมด"; ✗ "move into the panel with most overlap, 4 mm";
  ✗ text < 6 pt → 7 pt rule (thresholds come from Prepress settings, not the pack — keep settings as the source);
  ✗ switch to 4 สี with the price change shown first.
- ✗ Smart nudge toast. ◐ Templates come from `/v1/store/studio/templates` (empty today); content is business's.

### Phase 3 — pro mode
- ✗ Toolbox V H Z T R E L P I C; ✗ pen tool, line tool, eyedropper; ✓ rect/circle exist as elements.
- ◐ Multi-select ✅; ✗ align/distribute for multi in inspector (`lib/align.ts` exists — verify); ✅ ⌘C/X/V (paste
  offset to verify +5 mm).
- ◐ Rulers ✅; ✗ guides from rulers saved with the document.
- ◐ Inspector: X/Y/W/H/rotation/opacity ✅ (verify mm); ✗ flip H/V, rotate 90°, tracking, line height, gradient
  fill, HEX+CMYK, dash style, mono image; ✗ remove background (D-284: not before launch); crop ◐ (field exists).
- ◐ Layers ✅ (lock, rename, reorder); ✗ hide. ✗ สีในงาน panel. ✗ รุ่น (variants). ✅ ประวัติ.
- ✗ Print view menu (guide toggles partly exist), ✗ ink simulation on kraft (D-279 soft proof unset), ✗ separations.
- ◐ Export: ✗ PDF/X-4 CMYK outlined, ✗ .ai, ✅ SVG/PNG/DXF dieline, ✗ import PDF/.ai. ◐ Shortcut sheet exists.

### Phase 4 — collaboration, mockups, variants
- ◐ Share: view/comment/edit ✅ (D-285); ⚠ "อนุมัติแบบ" scope and comments without an account conflict with D-285.
- ✅ Comment pins + threads; ◐ team replies/notifications (verify).
- ◐ Mockup: presentation/PNG/AR exist; video export — verify; mark "เร็วๆ นี้" only what does not export.
- ✗ Variants (document + pricing + order). ✅ design-service hand-off exists (D-286); ✗ brief from the chooser.

### Phase 5 — advanced (document only, later)
- Finish layers exist in the document (`finish`) but must stay hidden until factory confirmation.

### Phase 6 — leadership features
- All ✗; several need business data (carrier tables, smart QR, shop integrations, roles, material data).

## 4. Schema changes (document v3, additive)

All new fields are optional; v2 documents read unchanged. `DOCUMENT_SCHEMA_VERSION` 2 → 3.

| Field | Shape | Notes |
|---|---|---|
| `BaseElement.flipX`, `flipY` | boolean | keeps width/height positive; renderer applies negative scale |
| `BaseElement.hidden` | boolean | not printed, not checked, not priced (layers hide) |
| `BaseElement.variable` | boolean | "เปลี่ยนตามรุ่น" — overridable per variant |
| `fillGradient` (text, shapes) | `{ kind: "linear", from: hex, to: hex, angle: deg }` | `fill` kept as fallback/first colour for older readers and ink counting |
| `strokeDash` (shapes) | `"solid" \| "dashed" \| "dotted"` | stroke none = `strokeWidth: 0` (existing) |
| Pen / line | reuse `type: "shape"` with `path` (SVG d, normalised to the 100×100 box) + `closed?: boolean` | no new element type → API hairline check (`rect/circle/shape`) still applies; open path = stroke only |
| `TextElement.letterSpacing`, `lineHeight` | number (1/1000 em), ratio | font size stays **mm** in storage; UI shows pt (1 pt = 0.3528 mm) — no migration |
| `ImageElement.mono` | boolean | "ภาพสีเดียว" for black/spot print |
| `DesignContent.guides` | `{ axis: "x" \| "y", at: mm, side?: "inside" }[]` | saved with the document |
| `DesignContent.variants` | `{ id, name, quantity?: number, overrides: Record<elementId, { text?, fill?, fillGradient? }> }[]` | base document = first variant; pricing per variant needs the API (C3) |
| Mode preference | account preference `editorMode: "easy" \| "pro"` | not in the document; contract request C1; fallback localStorage |

## 5. Migration of existing drafts
- Read path: `readDesign` accepts v2 and v3; a v2 draft opens as-is (no field rewritten until the next edit).
- Write path: the first save after an edit writes v3 (JSON Patch keeps small diffs).
- Older builds reading v3: unknown fields are ignored; `fill` stays meaningful; hidden elements would show in old
  viewers → ship the reader before the writer (one release gap) and make every renderer skip unknown types.
- Server: `evaluateDocument` (getpack-api `print-rules.ts`) and the order render (D-280) must learn `hidden`,
  `fillGradient`, `strokeDash`, variants — API change in the editor branch's API counterpart.
- Locked versions (D-276) are never rewritten.

## 6. Contract requests (to `docs/contract-requests.md` when implemented)
- C1 `PATCH /v1/store/me/preferences` + `editorMode`.
- C2 Personal brand kit (no company), or auto company — after Q7.
- C3 Variants: price and order a design with N variants (quantities per variant).
- C4 Customer font upload for brand kits — only if Q6 changes D-284/D-282.
- C5 `StudioQuoteDto` returns the priced spec lines (as `boxSpecLines`) for the spec label.
- C6 Server rules and render understand document v3 fields.

## 7. Risks
1. Price trust: until A3 lands, the editor shows a price for a different spec than listing/configurator.
2. Two preflight engines (studio rules D-278 vs artwork preflight D-070) vs GLOBAL-RULES §5 "one engine (Upload
   Phase 2)": reconcile before building canvas markers on top of the studio rules.
3. Finish picker exposed today (hard rule 4) — hide in Phase 1.
4. Ink inference under-prices multi-colour artwork on single-spot products and ignores white.
5. Performance: undo keeps whole-content snapshots (200 × 50 objects is fine; images are URLs); 3D texture redraw
   must stay on animation frames; 60 fps with 50 objects to be measured.
6. Prototype sample data must not ship: templates, brand kit, history entries, other-quantity prices, the +฿350 per
   variant surcharge, CMYK values, spot library, avatars, mockup/video, background removal.
7. Copy rules: no "โรงงาน" for our production, no automatic-check claim before ordering.
8. Shared links: edit scope + variants + brand lock need clear permission rules (D-285 company membership).

## 8. Open questions (business / owners)
1. Default/reference print for `uat-postal-box-b`: ดำ or CMYK (A3 + business).
2. How the editor prices an empty or white-only design.
3. Editor default size = configurator default standard size? Custom sizes orderable from the editor?
4. 2–3 flat colours on a product with only one spot ink: CMYK, block, or ask.
5. White on kraft: ink (white underprint, hard rule 4) or not printed.
6. Customer font upload vs D-284 (OFL only) / D-282 (studio fonts in company kits).
7. Personal brand kit for customers without a company.
8. Share "อนุมัติแบบ" scope and comments without an account vs D-285.
9. Price for variants, inside print, per-variant minimum.
10. CMYK display without an ICC profile: show only brand-kit CMYK values?
11. Mode preference as an account field (C1).
12. Preflight ownership: studio rules vs Upload Phase 2's 12 checks; which thresholds (text 6/7 pt, stroke
    0.25/0.3 mm, 150/300 dpi) Prepress sets in settings.
13. Which "fake" prototype exports are real today (PNG set, AR, video) — verify before labelling "เร็วๆ นี้".

## 9. Verify locally (not done in Phase 0)
1. Signed in, open the ฿14.79 draft: is any artwork/colour placed? Add one black text → does the price change?
2. Configurator `uat-postal-box-b`, size 00 · KA125 B · 300: switch to "พิมพ์ 4 สี (CMYK)" → ฿15.70?
3. Configurator custom 150 × 100 × 80 · KA125 B, no print / ดำ → compare with ฿14.79.
4. Admin calculate staff view (internal): selected print type and price-list version for ดำ vs CMYK.
(2–4 are POST calculations — run only where that is allowed.)
