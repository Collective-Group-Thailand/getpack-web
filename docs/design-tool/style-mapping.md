# Style mapping — Locopack patterns → `@packio/dieline` styles

F4 Part B. Packio migrates nothing from Locopack (D-005); this table uses the legacy pattern
catalogue as a **reference** so that Packio admins can create the live catalogue from styles the
engine can draw. Admins set a catalogue pattern's `dielineKey` to a style id below (or one of its
aliases); the configurator, the designer and the drawing service (packio-api B4.1) all resolve it
with `resolveStyleId()`.

Sources (all read-only, `legacy/locopack-web`): migrations for `pattern`, `sub_patterns`,
`pattern_rel_standard_sizes`, `pattern_match_flute`, `flute_type`, `mapping_inputs`;
`backup db/Dump20190828.sql` (patterns 1–13); `app/Libraries/Folding/PatternArea.php` (folding blank
formulas); `app/Models/CalculatorCorrugate.php` (corrugated); `app/.../PouchCalculator.php`;
`app/Http/Controllers/DownloadDrawingController.php` (the drawing-service calls);
`database/json/factory_rel_pattern_conditions.json` (newer pattern names).

**What the repository does not contain.** There is no complete pattern table: the only dump has
patterns 1–13 and predates the size-constraint columns, no seeder fills `pattern`, `sub_patterns`,
`mapping_inputs`, `standard_sizes` or `flute_type`, and **no real min/max size values exist
anywhere** (the only one is the contract example `{"maxW":500,"minW":30}`). The pattern list
below is therefore rebuilt from hard-coded ids, code comments and view lists; names that disagree
between sources are flagged. No drawing files produced by `DRAWING_URL` (the `download_drawing_logs`
S3 objects) are in the repository, so constructions could not be compared against them — every
place that would have needed it is marked ⚠ and listed under assumptions.

## 1. Legacy size variables

| Variable | Meaning in Locopack | Where it is defined | Packio parameter |
| --- | --- | --- | --- |
| `l`, `w`, `h` / `d` | Length, width, height (depth) — labelled ยาว / กว้าง / สูง (มม.) | `folding/cs-v2.vue:40-58`; `pattern.min_l…max_h` | `length`, `width`, `height` (inside, mm) |
| `b` | **Pouch:** bottom gusset including seal (ขนาดก้นซองรวมรอยซีล). **Folding pid 16:** the lock-bottom tongue, 3 / 5 / 10 mm by width. **Condition #7:** a flap allowance by width (≤ 120 → 20, else 30) | migration `2023_01_10_165715:17`; `PatternArea.php:536-564`; `calculate_conditions` | `pouch.bottom`; `snap-lock-bottom.lockTongue` |
| `s` | Pouch side gusset including seal (ขนาดข้างซองรวมรอยซีล) | migration `2023_01_10_165715:20`; `pouch/cs.vue:46-65` | `pouch.gusset` |
| `cs` | Pouch centre seal (ขนาด center seal); forced to 10 mm on the web | migration `…:23`; `PouchCalculator.php:218-219` | `pouch.centerSeal` (default 10) |
| `dl`, `dw` | The flat **blank** (die-line) length and width — calculator outputs (`products.dl/dw`); `pattern.min/max_dl/dw` are pouch limits | `CorrugateCalculator.php:964-965`; `corrugated/cs.vue:716-720` | Not inputs: the engine's `dieline.width` × `dieline.height` |
| `x` | Number of cells in an insert (จำนวนช่อง) | `select-pattern.vue:24` (`required_x`) | — (inserts not drawn, see §4) |
| `c` | Overlap value (ค่า overlap); corrugated flute column `col_c` = flap allowance | `select-pattern.vue:29`; `CalculatorCorrugate.php` (`Flap = floor(W/2)+c`) | `MaterialSpec.allowances.flap` |
| `f` | Tuck depth by length (≤ 150 → 15, ≤ 300 → 20, else 25) | `calculate_conditions` #1 | `tuckDepth` (default = this rule, `tuckDepthFor`) |
| `g` | Glue flap by width (≤ 150 → 15, else 25); corrugated `col_g` | `calculate_conditions` #2 | `glueWidth` (default = this rule, 35 on corrugated) |
| `r` | Partition/insert allowance by width (#4, #5); **tags:** corner radius (default 5) | `calculate_conditions`; `DownloadDrawingController.php:90` | `hang-tag.cornerSize`, `flat-rounded-rect.cornerRadius` |
| `dim` | Tag hole diameter, 3 or 6 mm | `DownloadDrawingController.php:90` | `hang-tag.hole` |
| `nd`, `nl`, `nw` | Next-part size offsets for nested multi-part products (sleeve over tray…) | `FoldingCalculator.php:300-305, 619-635` | Built into two-piece styles (lid from base, sleeve from drawer) |
| `col_a`, `col_dd`, `col_fh`, `z`, `ct` | Flute make-up allowances: per panel (`SLL = L + col_a`), depth (`SLH = D + dd`), outside (`ODL = L + 2·fh`) | `CalculatorCorrugate.php`; `ShippingUtils.php:334-335` | `MaterialSpec.allowances.panel` / `.depth`; caliper otherwise |
| `G`, `SLT`, `TFC`, `BFC`, `DC` | Drawing-only parameters for mapping 30 (RSC for presale); abbreviations only, no expansion found | `download_drawing.blade.php:137-166` | ⚠ unknown — not used |

## 2. Constraints

`pattern` carries `min_w … max_h`, `min_b … max_cs`, `min_dl … max_dw`, `l_must_more_than_w`
(default on), `l_must_more_than_h`, `w_must_more_than_h` ("0.95 × w ≥ h", LOC-1586) and `fix_size`
(size chosen from `pattern_rel_standard_sizes` only). None of the values are in the repository.

In Packio there are two layers, and the stricter wins:

1. **The engine's limits** — each style's `params[].min/max` is what its geometry can draw (e.g. a
   tuck end 20–400 × 15–300 × 20–450 mm) plus geometric rules in `validate()` (tuck deeper than the
   box, window outside its panel, board too thick for the size, hand holes that do not fit).
2. **The catalogue's limits** — admins enter each pattern's commercial and factory limits in the
   pattern's `constraints` (the configurator already reads `minL/maxL/minW/maxW/minD/maxD`), and
   `fix_size` becomes the pattern's standard sizes. The designer applies both (F4 Part C).

`l_must_more_than_w` is kept as a **warning** on the slotted family (`size.width_exceeds_length`),
not a block: the geometry is valid either way.

## 3. Pattern → style

Status: ✅ drawn by the engine · ≈ drawn by the nearest style, construction to confirm · ✖ not drawn (§4).

### Folding carton (legacy packaging type 1)

| Legacy | Name (2019 dump / newer JSON) | Drawing key | Packio style | | Notes |
| --- | --- | --- | --- | --- | --- |
| pid 1 · mapping 1 | แบบเปิดฝาบน (กล่องฝาเปิดบน) | `folding-truck-end-box` | [`tuck-end`](styles/tuck-end.png) | ✅ | Blank `f + (w−1) + (d+1) + (w−1) + f` × `(w−1) + l + w + l + g`: lid w−1, depth d+1, one side panel w−1 — the same shape as the engine's compensation (lid and closing panel reduced, depth + 2t). Mapping 1 switched to pid 16 when w ≥ 60 and l ≥ 60 (`Converter.php:174-183`) |
| pid 16 · mapping 94 | แบบเปิดฝาบน/ฝาล่างขัดล็อก | `folding-truck-end-snap-lock-bottom` | [`snap-lock-bottom`](styles/snap-lock-bottom.png) | ≈ | Tongue `b` 3 / 5 / 10 by width kept as `lockTongue`. ⚠ Locking shapes simplified |
| pid 17 | ทั่วไป (ฝาล่างขัดล็อก) / "overlap2" | — | `snap-lock-bottom` | ≈ | Names disagree between sources; taken as the lock-bottom variant |
| pid 7 | แบบป๊อปอัพฝาเปิดบน | — | [`crash-lock-bottom`](styles/crash-lock-bottom.png) | ≈ | ⚠ "Pop-up" read as auto/crash-lock bottom (the bottom pops open square) |
| pid 6 | แบบหูแขวนฝาเปิดบน | — | [`hang-tab-tuck`](styles/hang-tab-tuck.png) | ≈ | Blank `max(36 + 25 + d + 0.5 + w − 1 + f, …)`: a hanger of ~36–61 mm above the lid; hanger height is a parameter |
| pid 8 | แบบป๊อปอัพหูแขวน | — | `hang-tab-tuck` | ≈ | Hanger + pop-up bottom: the engine's hang-tab style has a tuck bottom. ⚠ Combine with crash-lock later if demanded |
| pid 2 | ถาด (Tray) | — | [`tray`](styles/tray.png) | ✅ | Blank `2(f + (d−1) + 8 + d) + w + 16` suggests double walls with an 8 mm lock — ⚠ `double-wall-tray` may be the closer match |
| pid 3 | ปลอก (Sleeve) | — | [`sleeve`](styles/sleeve.png) | ✅ | Blank `d + 1` × `g + (l+1) + (w+1) + (l+1) + (w+1)`: panels + 1 (≈ t), depth open — exactly the engine's sleeve |
| pid 4 | ฝาครอบ (Cover) | — | [`telescope`](styles/telescope.png) | ≈ | A cover over a tray; the lid-from-base rule replaces `nd/nl/nw` |
| pid 31 (sub 5 ถาด, sub 6 ปลอก) · mapping 10 | ฝาสไลด์ | `folding-slide-box` | [`sleeve-drawer`](styles/sleeve-drawer.png) | ✅ | Two pieces; the sleeve is sized from the drawer (`nw/nl/nh` → clearance) |
| pid 32 (sub 7 ถาด, sub 8 ฝา) · mapping 11 | ฝาครอบ | `folding-cover-box` | `telescope` | ✅ | Two pieces. Legacy code disagrees whether mappings 10/11 point at pid 2 or 3/4 (`Calculator.php:478` vs `PatternAPIController.php:295`) |
| pid 9 | แบบทรงบ้าน (กล่องทรงบ้าน) | — | [`gable`](styles/gable.png) | ≈ | Blank `45 + 1 + 40 + d + 0.5 + w − 1 + f`: a 45 mm handle over a 40 mm roof — the engine's roof is 45°, handle height a parameter |
| pid 10 | แบบฝาพับ (กล่องฝาครอบนอก) | — | [`tray-6-corner`](styles/tray-6-corner.png) / [`mailer`](styles/mailer.png) | ≈ | Blank `d/2 + w + 0.5 + d + 0.5 + w − 1 + b`: a base, a hinged lid and a front flap. ⚠ Which of the two is closer needs a sample |
| pid 11 | แบบขนมญี่ปุ่น (กล่องฝาสองชั้น) | — | — | ✖ | Double-lid construction unclear (§4) |
| pid 12 | แบบขนมฝาเสียบข้าง (สแน็คบ๊อก เสียบข้าง) | — | — | ✖ | §4 |
| pid 13 | แบบขนมฝาเปิด (สแน็คบ๊อก ข้างเรียบ) | — | — | ✖ | §4 |
| pid 14, 15 | ทั่วไป overlap / non-overlap | — | [`flat-rect`](styles/flat-rect.png) | ✅ | Blank = `w × l`: a flat printed sheet. The dump and the JSON swap which id is overlap |
| pid 5 | ไส้ (Folding Cushion) | — | — | ✖ | Insert with `x` cells (§4) |
| pid 45–48 | กล่องอาหาร ทรงเหลี่ยม / คางหมู ฝาพับ, ถาดอาหารคางหมู | — | — | ✖ | Fixed sizes from `pattern_rel_standard_sizes.dl/dw` with an SVG per size (§4) |

### Corrugated (legacy packaging type 3)

| Legacy | Name | Drawing key | Packio style | | Notes |
| --- | --- | --- | --- | --- | --- |
| pid 19 · mapping 30 | ฝาชน (RSC) | `corrugate-rsc`, `corrugate-rsc-3d` | [`rsc`](styles/rsc.png) | ✅ | FEFCO 0201. Blank `g + 2(L+a) + 2(W+a) − 3` × `2·floor(W/2) + 2c + D + dd`: the engine uses the flute's `col_a / col_c / col_dd` when the catalogue carries them. Legacy also switched pid 19 to "die-cut" (`pattern_type 2`) outside `find_pattern_type` limits — a production-method choice, not a geometry one |
| pid 39 · mapping 73 (70) | ฝาซ้อน (full overlap) | `corrugate-rsc-full-overlap` | [`fol`](styles/fol.png) | ✅ | FEFCO 0203; `Flap = W + c` |
| — | — | — | [`hsc`](styles/hsc.png), [`cssc`](styles/cssc.png) | ✅ | FEFCO 0200 / 0204 — reference set, not in the legacy list |
| pid 26 · mapping 50 | กล่องฝาเปิดบน | `corrugate-truck-end-box` | `tuck-end` on E-flute | ≈ | Same construction on corrugated board; legacy dW uses conditions `i, j, k, m` whose values are not in the repository |
| pid 20 · mapping 31 | ฝาเสียบเดี่ยว | `corrugate-single-flap` | [`mailer`](styles/mailer.png) | ≈ | ⚠ Formula (`D + W + (D+a) + (W + c + 2fh) + …`) reads as a folded mailer with one tuck; to confirm with a sample |
| pid 21 · mapping 48 | ฝาเสียบคู่ (หูช้าง) | `corrugate-double-flap` | `mailer` | ≈ | "Elephant ear" die-cut mailer with ear locks; ⚠ ear-lock shape not drawn |
| pid 22 · mapping 32 | ฝาเสียบคู่ ผนังบน 2 ชั้น | `corrugate-double-flap-top-parnel` | `mailer` | ≈ | Double top panel; ⚠ |
| pid 23 | ฝาเสียบคู่ ผนังข้าง 2 ชั้น | — | `mailer` | ≈ | Double side walls — the engine's mailer already rolls its side walls |
| pid 25 · mapping 49 | อาหารทะเล | `corrugate-food` | `mailer` | ≈ | Same formula as pid 20 in legacy |
| pid 27 · mapping 51 | หูหิ้ว ไม่มีขอบ | `corrugate-handle-box-no-rim` | [`gable`](styles/gable.png), or `rsc` with hand holes | ≈ | ⚠ "Handle box" drawn as a gable carry box; an RSC with `handles: side` covers the plain hand-hole case |
| pid 28 · mapping 52 | หูหิ้ว มีขอบ | `corrugate-handle-box-with-rim` | `gable` | ≈ | ⚠ The "rim" is not drawn |
| pid 29 (sub 1 ตัว, sub 2 ฝา) | Tele / ถาดฝาชน | — | [`telescope`](styles/telescope.png) | ✅ | Lid `W, L, D + 2fh − ct` in legacy; the engine sizes the lid from the base + 2 × caliper + clearance |
| pid 30 (sub 3 ถาด, sub 4 ปลอก) · mapping 56 | ฝาสไลด์ | `corrugate-slide` | `sleeve-drawer` | ✅ | |
| pid 38 | ถาด | — | `tray` | ✅ | |
| pid 24 | ทั่วไป (flat sheet, dL = L, dW = W) | — | `flat-rect` | ✅ | |
| — | — | — | [`wrap-around`](styles/wrap-around.png) | ✅ | Reference set; no legacy pattern |

### Labels, tags & sleeves, pouches (legacy packaging types 2, 5, 6)

| Legacy | Name | Drawing key | Packio style | | Notes |
| --- | --- | --- | --- | --- | --- |
| pid 18 · mapping 25, 59 | สติกเกอร์สี่เหลี่ยม | `square` | [`flat-rect`](styles/flat-rect.png) / [`flat-rounded-rect`](styles/flat-rounded-rect.png) | ✅ | |
| mapping 24 | สติกเกอร์วงกลม (sent as a diameter) | `circle` | [`flat-circle`](styles/flat-circle.png) | ✅ | |
| — | — | — | [`flat-oval`](styles/flat-oval.png), [`flat-custom`](styles/flat-custom.png) | ✅ | Reference set: oval; any closed SVG path (curves kept) |
| pid 33 · mapping 57 | ป้ายกระดาษ Tag ตัดมุม | `tag-cut` | [`hang-tag`](styles/hang-tag.png) `corners: chamfer` | ✅ | Sizes S 40×60, M 40×80, L 50×100, XL 60×120 (`tag-sleeve.csv`) as presets; `r` = 5, hole `dim` 3 / 6 |
| pid 34 · mapping 58 | ป้ายกระดาษ Tag มุมมน | `tag-curve` | `hang-tag` `corners: rounded` | ✅ | |
| pid 35 | แผ่นพิมพ์กระดาษ | — | `flat-rect` | ✅ | |
| pid 36 · mapping 60 | ปลอกแก้ว | — | [`cup-sleeve`](styles/cup-sleeve.png) | ≈ | Legacy sizes A 7.5×26, O 8.5×26 cm read as a flat band; Packio unrolls the cup's frustum from its two diameters. ⚠ Confirm the legacy product was a tapered sleeve |
| mapping 66 | สายคาด | `strap` | [`band`](styles/band.png) | ✅ | |
| pid 37 | ทั่วไป non-overlap (`dl = l + g`) | — | `band` | ≈ | A strip with a glue allowance |
| pid 40 · mapping 76 | 3 side seal | `pouch-3-seal` | [`pouch`](styles/pouch.png) `three_side` | ✅ | Blank `2l × w` (legacy adds the factory tolerance `t`, which is the factory's, not the template's) |
| pid 41 · mapping 77 | center seal pillow bag | `pouch-center-seal` | `pouch` `center_seal` | ✅ | `2w + 2cs` × l |
| pid 42 · mapping 78 | center seal gusset | `pouch-center-seal-gusset` | `pouch` `center_seal_gusset` | ✅ | `2w + 2s + 2cs` × l |
| pid 43 · mapping 79 | 4 side seal | `pouch-4-seal` | `pouch` `four_side` | ✅ | `2w + 2s` × l |
| pid 44 · mapping 80 | standing pouch | `pouch-standing` | `pouch` `standing` | ✅ | `l + b + l` × w |

### Reference set coverage (F4 Part B list)

| Reference style | Packio style |
| --- | --- |
| Straight tuck end · reverse tuck end | `tuck-end` · `reverse-tuck-end` |
| Tuck top + snap-lock (1-2-3) · + crash-lock (auto) bottom | `snap-lock-bottom` · `crash-lock-bottom` |
| Seal end | `seal-end` |
| Tuck end with hang tab (euro slot option) | `hang-tab-tuck` (`hangHole: euro | round | none`) |
| Sleeve · sleeve + tray drawer | `sleeve` · `sleeve-drawer` |
| Pillow box (arcs) | `pillow` (true arcs) |
| Gable / handle box | `gable` |
| Hexagonal tuck box | `hexagonal` |
| RSC · HSC · FOL · CSSC | `rsc` · `hsc` · `fol` · `cssc` (+ `handles: side`) |
| Roll-end tuck-front mailer | `mailer` (FEFCO 0427) |
| Wrap-around blank | `wrap-around` |
| 4-corner · 6-corner glued tray · double-wall tray | `tray` · `tray-6-corner` · `double-wall-tray` |
| Two-piece telescope (full / partial lid) | `telescope` (`lid: full | partial`) |
| Label / sticker shapes, custom die | `flat-rect`, `flat-rounded-rect`, `flat-circle`, `flat-oval`, `flat-custom` |
| Tag, sleeve and pouch templates | `hang-tag`, `cup-sleeve`, `band`, `pouch` |
| Options: window (rect / rounded / ellipse, inside one panel with margin) | every four-panel carton and `sleeve` (`window*` parameters, 6 mm margin rule) |
| Options: thumb notch · rounded tuck corners · glue flap side · grain arrow | tuck styles (`thumbNotch`, `tuckCorners`) · tube styles (`glueSide`) · every box (`grain`) |

FEFCO codes are attached only where verified: 0200 (HSC), 0201 (RSC), 0203 (FOL), 0204 (CSSC),
0427 (mailer). No ECMA codes are attached.

### Recipes and the style library master (U3.1)

Every style is now a recipe (`packages/dieline/src/recipes/data/<id>.json`, ADR-0011) made of
modules. `base` is the master-file row (`style-library-master.json`) the style is a variant of,
and `variant` the axis values it stands for — informational; the public code and its immutability
are the API's (D-184). `pouch` draws several master rows (stand-up, three-side, centre-seal,
side-gusset pouches) through `pouchType`, so it names none. Regenerate this table when a recipe changes.

| Style | Body / piece set | Top | Bottom | Features | Base | Variant |
| --- | --- | --- | --- | --- | --- | --- |
| `tuck-end` | `tube` (preset carton) | `tuck` (lid: back) | `tuck` (lid: back) | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=tuck; hang=none |
| `reverse-tuck-end` | `tube` (preset carton) | `tuck` (lid: back) | `tuck` (lid: front) | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=tuck; hang=none |
| `snap-lock-bottom` | `tube` (preset carton) | `tuck` (lid: back) | `snapLock123` (preset default) | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=snap_lock_123; hang=none |
| `crash-lock-bottom` | `tube` (preset carton) | `tuck` (lid: back) | `crashLock` | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=crash_lock; hang=none |
| `seal-end` | `tube` (preset carton) | `seal` | `seal` | `window` | PK-TE-01 | tuck_top=seal; tuck_bottom=seal; hang=none |
| `hang-tab-tuck` | `tube` (preset carton) | `tuck` (lid: front) | `tuck` (lid: back) | `hangTab` (end: top), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=tuck |
| `sleeve` | `tube` (preset carton) | — | — | `window` | PK-SL-01 | — |
| `sleeve-drawer` | `sleeveAndDrawer` | — | — | — | PK-SL-02 | — |
| `gable` | `tube` (preset carton) | `gableHandle` | `snapLock123` (preset default) | `window` | PK-SP-02 | tuck_bottom=snap_lock_123 |
| `hexagonal` | `tube` | `polygonTuckLid` | `polygonTuckLid` | — | PK-SP-03 | — |
| `rsc` | `tube` (preset carton) | `rsc` | `rsc` | `handHoles` | PK-CS-01 | joint=glue_flap |
| `hsc` | `tube` (preset carton) | — | `rsc` | `handHoles` | PK-CS-02 | joint=glue_flap |
| `fol` | `tube` (preset carton) | `fol` | `fol` | `handHoles` | PK-CS-03 | joint=glue_flap |
| `cssc` | `tube` (preset carton) | `cssc` | `cssc` | `handHoles` | PK-CS-04 | joint=glue_flap |
| `mailer` | `tray` (preset glued) | `hingedLid` (front: tuck) | — | `rollOverWalls` (walls: ['front', 'left', 'right']) | PK-CF-01 | mailer_front=tuck |
| `wrap-around` | `tube` | `endFlaps` | `endFlaps` | — | PK-CF-03 | joint=glue_flap |
| `tray` | `tray` (preset glued) | — | — | — | PK-TR-01 | corner=glued |
| `tray-6-corner` | `tray` (preset glued) | `hingedLid` (front: glued_lips) | — | — | PK-TR-02 | — |
| `double-wall-tray` | `tray` (preset glued) | — | — | `rollOverWalls` (walls: ['back', 'front']) | PK-TR-03 | — |
| `telescope` | `lidAndBase` | — | — | — | PK-LB-01 | — |
| `pillow` | `pillowTube` | — | — | — | PK-SP-01 | — |
| `flat-rect` | `flatShape` (shape: rectangle) | — | — | — | PK-LA-02 | shape_flat=rectangle |
| `flat-rounded-rect` | `flatShape` (shape: rounded_rectangle) | — | — | — | PK-LA-02 | shape_flat=rounded_rectangle |
| `flat-circle` | `flatShape` (shape: circle) | — | — | — | PK-LA-02 | shape_flat=circle |
| `flat-oval` | `flatShape` (shape: oval) | — | — | — | PK-LA-02 | shape_flat=oval |
| `flat-custom` | `flatShape` (shape: custom_path) | — | — | — | PK-LA-02 | shape_flat=custom_path |
| `hang-tag` | `flatShape` (shape: tag) | — | — | `hangHole` | PK-TG-01 | — |
| `cup-sleeve` | `cone` | — | — | — | PK-TG-02 | — |
| `band` | `band` | — | — | — | PK-SL-03 | — |
| `pouch` | `pouchWeb` | — | — | — | — | — |

## 4. Patterns the engine does not draw

For these, prepress supplies the die file through the drawing job's upload (admin prepress, F2 2.4)
the way Locopack called `DRAWING_URL`; the catalogue leaves `dielineKey` empty, so the configurator
shows no 3D preview and the designer is not offered.

| Legacy | Why not yet |
| --- | --- |
| pid 5 ไส้ (folding cushion / insert with `x` cells) | An insert's construction (`dw = d + l + 2r`, `dl = r(x+1) + wx + d`) depends on the product it holds; needs a sample and a partition model |
| pid 11 กล่องขนมญี่ปุ่น / ฝาสองชั้น | Double-lid construction cannot be read from the formula alone (`w − w/8 + d + …`) |
| pid 12, 13 snack boxes | Formulas suggest trays with side tucks; shape of the tucks unknown |
| pid 45–48 food boxes (fixed sizes) | Each standard size had its own SVG (`pattern_rel_standard_sizes.svg_file`, S3) — not in the repository; they are fixed-size stock dies, best uploaded as files |
| mapping 30 presale parameters `G`, `SLT`, `TFC`, `BFC`, `DC` | Meaning not recoverable; the RSC is drawn without them |

## 5. Assumptions awaiting prepress confirmation

- Caliper compensation (`constants.ts`): panels + 1 t, depth + 2 t (+ 1 t for trays), meeting flaps
  + t/2, glue-side panel − 1 t; hexagon panels + t·tan 30°. Legacy folding used fixed ±0.5 / ±1 mm on
  ~0.45 mm board, which this reproduces within 0.1 mm.
- Snap-lock and crash-lock bottoms: simplified lock shapes (tongue into a notch; 45° crease with a
  glue triangle). Compare with a die sample before launch.
- Pop-up (pid 7, 8) = crash-lock; handle boxes (pid 27, 28) = gable; single/double flap corrugated
  (pid 20–23, 25) = mailer; pid 10 = six-corner box or mailer; pid 2 tray may be double-walled.
- Windows keep ≥ 6 mm of board to every cut and crease; hand holes 90 × 30 mm, 30 mm below the top.
- Slot width on corrugated flaps = 2 × caliper, at least 3 mm; paperboard flaps share a slit.
- Pillow crease bow = a third of the thickness; cup-sleeve presets are indicative, not measured cups.
- Dust flap reach = min(0.45 L, 0.9 W); tuck shoulder 1.5 mm; tuck corner radius 6 mm (capped at half
  the tuck).
