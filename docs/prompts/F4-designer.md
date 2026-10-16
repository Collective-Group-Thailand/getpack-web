# F4 — Online box designer v2 & `@getpack/dieline` engine

> 3D preview component built here is reused by the configurator (F3.2) and the proof viewer (F3.5) — D-152.

> อ่าน `CLAUDE.md`, `00-master-plan.md`, `design-system.md`, `docs/legacy/00-domain-context.md` (§3.4 Designs, §4 Pricing) ก่อน · ต้องทำ F0–F1 เสร็จแล้ว
> ทำทีละ Part ต่อ 1 session (A → E) · Part C ต้องการ designs API (backend B4.1) และ quote API (B2.5) — ใช้ mock ระหว่างรอได้
> ตัดระบบราคาตัวอย่าง (sample pricing) ของ BoxStudio ออกทั้งหมด — ราคามาจาก API เท่านั้น

---

You are a senior engineer building the getpack online box designer. Current state after F0: the editor lives in `src/features/designer` (Konva canvas, toolbar, side panels, setup modal, Zustand store with undo/redo, PNG/PDF/SVG/thumbnail export, localStorage designs) with routes `/[locale]/design/[id]` and `/[locale]/account/designs`; framework-free geometry lives in `packages/dieline` (`@getpack/dieline`: `Face`, `Dieline`, `DesignSpec`, `rsc()`, `tuckEnd()`, `tray()`, `buildDieline()`, `dielineSegments()`, `dielineToSvg()`, `insetConvex`).

Legacy Locopack used an **external design tool** (`UR_DESIGN_URL`) and an **external drawing generator** (`DRAWING_URL`); getpack does not migrate legacy designs (D-005); the backend stores new design documents in its `designs` / `design_assets` / `design_versions` tables. This workstream replaces both external tools: the engine and editor here, the drawing service in `getpack-api` (B4.1) using the **published** `@getpack/dieline`.

## Part A — Engine v2 (`packages/dieline` (`@getpack/dieline`))
1. **Geometry model**: faces with path edges — `Edge { kind: 'line'|'arc'|'bezier', from, to, …params, role: 'cut'|'crease'|'perforation'|'half_cut'|'glue_area'|'bleed' }`; faces may be non-convex and contain holes (windows, hang holes, handle cut-outs). Helpers for rect/trapezoid faces keep generators readable.
2. **Multi-piece dielines**: `Dieline { pieces: Piece[] }` (lid + base, sleeve + tray…), each with bounds and label.
3. **Style definition contract** — one file per style under `packages/dieline/src/styles/<id>.ts`:
   ```ts
   interface BoxStyleDef {
     id: string
     category: 'folding_carton' | 'corrugated' | 'tray_lid' | 'specialty'
     name: { th: string; en: string }; description: { th: string; en: string }
     params: ParamSchema[]            // L/W/H + style-specific: flap depth, tuck radius, lock type, glue side/width, window…
     defaults: ParamValues
     validate(v: ParamValues, material: MaterialSpec): Issue[]   // Thai + English messages
     build(v: ParamValues, material: MaterialSpec): Dieline      // applies caliper compensation
     faces3d?: HingeMap                                          // for 3D folding preview
     legacy?: { patternKeys: string[] }                          // mapping hints to legacy Locopack `pattern`/`sub_patterns`
   }
   ```
   Registry `packages/dieline/src/styles/index.ts`. Keep rule-of-thumb constants in `constants.ts` with comments for prepress engineers.
4. **Caliper compensation**: panel, flap and tuck dimensions adjusted by `MaterialSpec.caliperMm` (from the catalogue API: `paper` / `paper_grade` + `flute_type` concepts); formula documented per style.
5. **Robust offsetting** for safe zone/bleed on non-convex faces and curves (Clipper2 or equivalent; flatten curves to ≤ 0.2 mm only for offsetting).
6. **Exports** (pure functions): SVG (layers `CUT`, `CREASE`, `PERF`, `HALFCUT`, `GLUE`, true mm, real SVG arcs), **DXF** (same layers), PDF dieline (vector) — used both by the editor and by the backend drawing service (`getpack-api` B4.1, which consumes the published package).
7. **Migration** of BoxStudio-era localStorage designs (`specVersion`) so existing local designs still open.

8. **Publishing**: `@getpack/dieline` is versioned with Changesets and published to GitHub Packages on release (semver; breaking geometry changes = major). The public API is documented in `packages/dieline/README.md`; the backend pins a version. The package has zero runtime dependencies on React/DOM/Node-only APIs (runs in browser and Node).

## Part B — Style library (mapped to the legacy pattern catalogue)
First, **inventory the legacy Locopack pattern catalogue as the style reference** (nothing is migrated, D-005): read `pattern`, `sub_patterns`, `pattern_rel_standard_sizes`, `pattern_match_flute`, pattern size constraints (min/max w/l/h/b/s/cs/dl/dw) and `mapping_inputs` from `docs/legacy/03-legacy-schema.txt` and the legacy code/seeders (and from getpack's own catalogue endpoints once admins have created patterns) and write `docs/design-tool/style-mapping.md`: each Locopack pattern → a `BoxStyleDef` (existing or new), its parameters (including legacy `b`, `s`, `cs`, `dl`, `dw` meaning — find it in legacy code/drawing requests and document it), and constraints. **Cover the legacy pattern list plus the minimum reference set below; getpack admins create the live catalogue from these style definitions.** Where a legacy pattern's construction is unclear, compare with drawing files previously produced by `DRAWING_URL` (from `download_drawing_logs` / S3) and record assumptions.

Reference set (implement all that exist in Locopack's catalogue, plus these):
- Folding carton: straight tuck end; reverse tuck end; tuck top + snap-lock (1-2-3) bottom; tuck top + crash-lock (auto) bottom; seal end; tuck end with hang tab (euro slot option); sleeve; sleeve + tray drawer (two pieces); pillow box (arcs); gable/handle box; hexagonal tuck box.
- Corrugated: regular slotted container; half slotted container; full overlap slotted container; centre special slotted container; roll-end tuck-front mailer; wrap-around blank.
- Trays & lid/base: 4-corner glued tray; 6-corner glued tray; double-wall tray; two-piece telescope (lid sized from base + 2 × caliper + clearance; full/partial lid depth).
- Label/sticker, tag & sleeve, pouch: flat shapes (rect, rounded rect, circle, oval, custom die from uploaded SVG path) with bleed/safe zone, and sleeve/tag templates matching Locopack products.
- Options where sensible: window (rect/rounded/ellipse, validated inside one panel with margin), thumb notch, rounded tuck corners, glue flap side, grain direction arrow.

Attach FEFCO/ECMA codes only when verified.

## Part C — Integration with the getpack API (`src/features/designer`)
1. **Design documents**: replace localStorage with the designs API (`/v1/store/designs/*`): the editor document is JSON with a `schemaVersion`; autosave (debounced) with `If-Match`/ETag conflict detection and a resolve dialog; versions/history list; large assets via presigned upload (`design_assets`); offline draft in IndexedDB; one-time import of existing localStorage designs into the account after sign-in.
2. **Entry points**: from product pages/configurator (F3) with product (`mapping_input`), pattern, size and material preselected; from orders (design linked to an order item — legacy `design_uuid`, "design online"); from the admin zone (prepress opens a customer design read-only or as a copy — same components, read-only mode).
3. **Constraints & materials** come from catalogue endpoints (pattern min/max, paper/grade, flute caliper, available colours) — no hard-coded catalogue. Delete the old `catalog.ts` placeholders once wired.
4. **Price widget**: compact live price in the top bar calling `POST /v1/store/quotes` with the design's spec (size, material, print sides/colours inferred from artwork coverage, finishes used, quantity). **No local price calculation.**
5. **Semi-designs**: load semi-designs + templates/colours/fonts from the API as starting templates.
6. **Submit for print**: export the print PDF client-side or via the API (decide in an ADR; vector dieline on separate spot layers `CutContour` / `Crease`, artwork with 3 mm bleed, fonts embedded or outlined, images ≥ 300 dpi effective) → upload → create the artwork submission for the order item → preflight → proof flow with annotations (all R1).

## Part D — Editor v2 UX (`src/features/designer`, following `design-system.md`)
- Layout: top bar (name, save state, undo/redo, zoom, share, price widget, primary "สั่งผลิต"), left rail (Templates, Elements, Text, Uploads, Brand kit, Layers, Patterns/Backgrounds), canvas centre, right contextual properties panel, bottom status bar (flat size, current face, safe-zone warnings count).
- Canvas: face-aware editing (click a face to "focus" it — shows face name, rotates to upright for editing, e.g. top flaps), snapping & smart guides to face edges/centres/safe zone, rulers in mm, multi-select, group, align/distribute, lock, grids, clipping per face, text on path (optional), image crop & replace, background removal (optional service), colour picker with brand colours + CMYK approximation warning, shape library (original icons only), QR/barcode generator (EAN-13, QR) with quiet-zone check.
- **Live 3D preview** panel (`@react-three/fiber`): folds the dieline using `faces3d`, textures from the current artwork, orbit, open/close animation, lighting presets, export PNG mockup.
- Real-time checks panel: text in danger zone, low-res images, elements crossing folds/glue areas, thin strokes, small text, missing bleed — each clickable to select the element.
- Collaboration (phase-able): share view/comment link; comments pinned to canvas (reuse proof annotation model).
- Accessibility: all panels keyboard reachable, canvas actions have menu/keyboard equivalents, focus management, screen-reader labels for tools. Performance: 60 fps pan/zoom with 200 elements; lazy-load 3D and heavy panels.
- Mobile: view + light edits (text, replace image, colours) with a bottom-sheet UI; full editing is desktop/tablet.

## Part E — Quality gates
- `packages/dieline` (`@getpack/dieline`) Vitest for every style × preset × material: closed cut loops (≤ 0.01 mm gaps), no face overlaps, key dimensions equal inputs after compensation, `validate()` rejects out-of-range and accepts presets, SVG/DXF snapshots stable, 3D hinge map folds into a closed box within tolerance (bounding box = L×W×H ± 1 mm).
- Golden comparison vs legacy drawings is run by `getpack-api` (B4.1) using the published engine; provide the fixture generator and per-pattern SVG snapshots it needs.
- App: component tests, Playwright e2e (open from product page → design → price updates → submit for print → preflight result), visual regression of editor states, axe, Lighthouse budgets for the editor route (designer budget).
- Docs: `docs/design-tool/` (architecture, style authoring guide with a worked example, style-mapping table with thumbnails generated to `docs/design-tool/styles/*.png`, print-PDF spec for factories), ADRs (geometry model, 3D approach, PDF generation tooling), `docs/PROGRESS.md`.
- Final summary: styles implemented and mapped, patterns still on `DRAWING_URL` fallback and why, assumptions needing prepress confirmation.
