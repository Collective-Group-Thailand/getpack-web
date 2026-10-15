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
side-gusset pouches) through `pouchType`, so it names none. Regenerate this table when a recipe changes. Since U3.4 the wave recipes live in the
`@packio/dieline/library` entry (`Entry` = library), registered on demand with `registerLibrary()`;
a core style the waves extend keeps its pre-wave form in the main entry and its extended form in the
library, which replaces it by id (`main, extended in library`); `ALL_RECIPES` is the library's view. `Varies along` lists the master axes a recipe varies (values in brackets);
every combination is one variant (`variantsOf`).

| Style | Entry | Body / piece set | Top | Bottom | Features | Base | Fixed axes | Varies along | Variants |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hang-tag` | main, extended in library | `flatShape` (shape: tag) | — | — | `hangHole` | — | — | hang (2) | 2 |
| `pouch` | main | `pouchWeb` | — | — | — | — | — | — | 1 |
| `mailer` | main, extended in library | `tray` (preset glued) | `hingedLid` (front: tuck) | — | `rollOverWalls` (walls: front/left/right), `dieCutInsert` (floor: t; inset: t) | PK-CF-01 | — | mailer_front (2), tear_strip (2), adhesive (3), thumb (2), insert (2) | 48 |
| `pizza-box` | library | `tray` (preset glued) | `hingedLid` (front: tuck) | — | `rollOverWalls` (walls: front/left/right) | PK-CF-02 | — | thumb (2) | 2 |
| `wrap-around` | main, extended in library | `tube` | `endFlaps` | `endFlaps` | — | PK-CF-03 | — | joint (3) | 3 |
| `lock-corner-tray` | library | `tray` (preset glued) | — | — | `lockCorners`, `handHoles` | PK-CF-05 | — | handle (3) | 3 |
| `archive-box` | library | `tray` (preset glued) | `hingedLid` (front: tuck) | — | `handHoles` | PK-CF-06 | — | handle (3) | 3 |
| `produce-tray` | library | `tray` (preset glued) | — | — | `lockCorners`, `handHoles`, `vents` | PK-CF-08 | — | hand_holes (3), vents (3) | 9 |
| `partition-set` | library | `partitionSet` | — | — | — | PK-CI-01 | — | partition (6) | 6 |
| `pad-sheet` | library | `flatShape` (shape: rectangle) | — | — | `fingerNotch` | PK-CI-02 | — | thumb (2) | 2 |
| `rsc` | main, extended in library | `tube` (preset carton) | `rsc` | `rsc` | `handHoles` | PK-CS-01 | — | joint (3), hand_holes (3) | 9 |
| `hsc` | main, extended in library | `tube` (preset carton) | — | `rsc` | `handHoles` | PK-CS-02 | — | joint (3), hand_holes (3) | 9 |
| `fol` | main, extended in library | `tube` (preset carton) | `fol` | `fol` | `handHoles` | PK-CS-03 | — | joint (3), hand_holes (3) | 9 |
| `cssc` | main, extended in library | `tube` (preset carton) | `cssc` | `cssc` | `handHoles` | PK-CS-04 | — | joint (3) | 3 |
| `rsc-hand-holes` | library | `tube` (preset carton) | `rsc` | `rsc` | `handHoles` | PK-CS-06 | — | joint (3) | 3 |
| `full-telescope` | library | `lidAndBase` | — | — | `handHoles` | PK-CT-01 | — | lid_depth (2), hand_holes (3) | 6 |
| `hsc-lid` | library | `tube` (preset carton) | — | `rsc` | `handHoles` (fromTop: (lidDepth ?? max(15, round(height / 3))) + 15), `vents`, `telescopeLid` | PK-CT-02 | — | hand_holes (3), vents (3) | 9 |
| `display-tray` | library | `tray` (preset glued) | — | — | `displayHeader`, `lockCorners`, `dieCutInsert` (floor: t) | PK-DS-01 | — | corner (2), insert (2) | 4 |
| `ft-crash` | library | `tube` (preset carton) | `flipTop` | `crashLock` | `window`, `dieCutInsert` (rotate: true; floor: 3 * t) | PK-FT-01 | tuck_bottom=crash_lock | window (3), insert (2) | 6 |
| `ft-fourflap` | library | `tube` (preset carton) | `flipTop` | `fourFlapLock` | `window`, `dieCutInsert` (rotate: true; floor: 3 * t) | PK-FT-01 | tuck_bottom=four_flap_lock | window (3), insert (2) | 6 |
| `ft-seal` | library | `tube` (preset carton) | `flipTop` | `seal` | `window`, `dieCutInsert` (rotate: true; floor: 3 * t) | PK-FT-01 | tuck_bottom=seal | window (3), insert (2) | 6 |
| `ft-snap` | library | `tube` (preset carton) | `flipTop` | `snapLock123` (preset default) | `window`, `dieCutInsert` (rotate: true; floor: 3 * t) | PK-FT-01 | tuck_bottom=snap_lock_123 | window (3), insert (2) | 6 |
| `ft-tuck` | library | `tube` (preset carton) | `flipTop` | `tuck` (lid: back) | `window`, `dieCutInsert` (rotate: true; floor: 3 * t) | PK-FT-01 | tuck_bottom=tuck | window (3), insert (2) | 6 |
| `cavity-insert` | library | `insertBody` | — | — | — | PK-IN-01 | — | thumb (2) | 2 |
| `tray-insert` | library | `tray` (preset glued) | — | — | — | PK-IN-03 | — | — | 1 |
| `roll-label-circle` | library | `flatShape` (shape: circle) | — | — | — | PK-LA-01 | shape_flat=circle | — | 1 |
| `roll-label-custom` | library | `flatShape` (shape: custom_path) | — | — | — | PK-LA-01 | shape_flat=custom_path | — | 1 |
| `roll-label-oval` | library | `flatShape` (shape: oval) | — | — | — | PK-LA-01 | shape_flat=oval | — | 1 |
| `roll-label-rect` | library | `flatShape` (shape: rectangle) | — | — | — | PK-LA-01 | shape_flat=rectangle | — | 1 |
| `roll-label-rounded` | library | `flatShape` (shape: rounded_rectangle) | — | — | — | PK-LA-01 | shape_flat=rounded_rectangle | — | 1 |
| `flat-circle` | main | `flatShape` (shape: circle) | — | — | — | PK-LA-02 | shape_flat=circle | — | 1 |
| `flat-custom` | main | `flatShape` (shape: custom_path) | — | — | — | PK-LA-02 | shape_flat=custom_path | — | 1 |
| `flat-oval` | main | `flatShape` (shape: oval) | — | — | — | PK-LA-02 | shape_flat=oval | — | 1 |
| `flat-rect` | main | `flatShape` (shape: rectangle) | — | — | — | PK-LA-02 | shape_flat=rectangle | — | 1 |
| `flat-rounded-rect` | main | `flatShape` (shape: rounded_rectangle) | — | — | — | PK-LA-02 | shape_flat=rounded_rectangle | — | 1 |
| `wrap-label-rounded` | library | `flatShape` (shape: rounded_rectangle) | — | — | — | PK-LA-03 | tuck_corner=rounded | — | 1 |
| `wrap-label-square` | library | `flatShape` (shape: rectangle) | — | — | — | PK-LA-03 | tuck_corner=square | — | 1 |
| `telescope` | main, extended in library | `lidAndBase` | — | — | `window` | PK-LB-01 | — | lid_depth (2), corner (2), window (2), thumb (2) | 16 |
| `stand-up-pouch` | library | `pouchWeb` | — | — | — | PK-PB-01 | — | pouch_feat (16) | 16 |
| `flat-pouch` | library | `pouchWeb` | — | — | — | PK-PB-02 | — | pouch_feat (16) | 16 |
| `poly-mailer` | library | `polyMailer` | — | — | — | PK-PB-06 | — | adhesive (3), tear_strip (2) | 6 |
| `paper-bag` | library | `paperBag` | — | — | — | PK-PG-01 | — | bag_handle (5), bag_gusset (2) | 10 |
| `sleeve` | main, extended in library | `tube` (preset carton) | `openEnd` | `openEnd` | `window` | PK-SL-01 | — | window (2), thumb (2) | 4 |
| `sleeve-drawer` | main, extended in library | `sleeveAndDrawer` | — | — | `window`, `dieCutInsert` (target: drawer; floor: t) | PK-SL-02 | — | thumb (2), window (2), insert (2) | 8 |
| `band` | main, extended in library | `band` | — | — | — | PK-SL-03 | — | lock (2) | 2 |
| `pillow` | main, extended in library | `pillowTube` | — | — | `window` | PK-SP-01 | — | hang (4), window (2) | 8 |
| `gable` | main | `tube` (preset carton) | `gableHandle` | `snapLock123` (preset default; tongue: snapLockTongueFor(width)) | `window` | PK-SP-02 | tuck_bottom=snap_lock_123 | window (2) | 2 |
| `gable-crash` | library | `tube` (preset carton) | `gableHandle` | `crashLock` | `window` | PK-SP-02 | tuck_bottom=crash_lock | window (2) | 2 |
| `gable-fourflap` | library | `tube` (preset carton) | `gableHandle` | `fourFlapLock` | `window` | PK-SP-02 | tuck_bottom=four_flap_lock | window (2) | 2 |
| `gable-seal` | library | `tube` (preset carton) | `gableHandle` | `seal` | `window` | PK-SP-02 | tuck_bottom=seal | window (2) | 2 |
| `gable-tuck` | library | `tube` (preset carton) | `gableHandle` | `tuck` (lid: back) | `window` | PK-SP-02 | tuck_bottom=tuck | window (2) | 2 |
| `hexagonal` | main | `tube` (turn: 60) | `polygonTuckLid` | `polygonTuckLid` | — | PK-SP-03 | — | — | 1 |
| `crash-lock-bottom` | main, extended in library | `tube` (preset carton) | `tuck` (lid: back) | `crashLock` | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=crash_lock; hang=none | window (3) | 3 |
| `hang-tab-tuck` | main, extended in library | `tube` (preset carton) | `tuck` (lid: front) | `tuck` (lid: back) | `hangTab` (end: top), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=tuck | hang (3), window (3) | 9 |
| `reverse-tuck-end` | main, extended in library | `tube` (preset carton) | `tuck` (lid: back) | `tuck` (lid: front) | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=tuck; hang=none | window (3) | 3 |
| `seal-end` | main, extended in library | `tube` (preset carton) | `seal` | `seal` | `window` | PK-TE-01 | tuck_top=seal; tuck_bottom=seal; hang=none | window (3) | 3 |
| `snap-lock-bottom` | main, extended in library | `tube` (preset carton) | `tuck` (lid: back) | `snapLock123` (preset default) | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=snap_lock_123; hang=none | window (3) | 3 |
| `te-airplane-crash` | library | `tube` (preset carton) | `airplaneTuck` (lid: front) | `crashLock` | `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=airplane_tuck; tuck_bottom=crash_lock | hang (4), window (3) | 12 |
| `te-airplane-fourflap` | library | `tube` (preset carton) | `airplaneTuck` (lid: front) | `fourFlapLock` | `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=airplane_tuck; tuck_bottom=four_flap_lock | hang (4), window (3) | 12 |
| `te-airplane-seal` | library | `tube` (preset carton) | `airplaneTuck` (lid: front) | `seal` | `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=airplane_tuck; tuck_bottom=seal | hang (4), window (3) | 12 |
| `te-airplane-snap` | library | `tube` (preset carton) | `airplaneTuck` (lid: front) | `snapLock123` (preset default) | `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=airplane_tuck; tuck_bottom=snap_lock_123 | hang (4), window (3) | 12 |
| `te-airplane-tuck` | library | `tube` (preset carton) | `airplaneTuck` (lid: front) | `tuck` (lid: back) | `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=airplane_tuck; tuck_bottom=tuck | hang (4), window (3) | 12 |
| `te-reverse-crash` | library | `tube` (preset carton) | `tuck` (lid: front) | `crashLock` | `thumbNotch` (end: top), `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=crash_lock | hang (4), window (3) | 12 |
| `te-reverse-fourflap` | library | `tube` (preset carton) | `tuck` (lid: front) | `fourFlapLock` | `thumbNotch` (end: top), `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=four_flap_lock | hang (4), window (3) | 12 |
| `te-reverse-seal` | library | `tube` (preset carton) | `tuck` (lid: front) | `seal` | `thumbNotch` (end: top), `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=seal | hang (4), window (3) | 12 |
| `te-reverse-snap` | library | `tube` (preset carton) | `tuck` (lid: front) | `snapLock123` (preset default) | `thumbNotch` (end: top), `hangTab` (end: top; optional: true), `window` | PK-TE-01 | tuck_top=reverse_tuck; tuck_bottom=snap_lock_123 | hang (4), window (3) | 12 |
| `te-seal-crash` | library | `tube` (preset carton) | `seal` | `crashLock` | `window` | PK-TE-01 | tuck_top=seal; tuck_bottom=crash_lock; hang=none | window (3) | 3 |
| `te-seal-snap` | library | `tube` (preset carton) | `seal` | `snapLock123` (preset default) | `window` | PK-TE-01 | tuck_top=seal; tuck_bottom=snap_lock_123; hang=none | window (3) | 3 |
| `te-seal-tuck` | library | `tube` (preset carton) | `seal` | `tuck` (lid: back) | `window` | PK-TE-01 | tuck_top=seal; tuck_bottom=tuck; hang=none | window (3) | 3 |
| `te-straight-fourflap` | library | `tube` (preset carton) | `tuck` (lid: back) | `fourFlapLock` | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=four_flap_lock; hang=none | window (3) | 3 |
| `te-straight-seal` | library | `tube` (preset carton) | `tuck` (lid: back) | `seal` | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=seal; hang=none | window (3) | 3 |
| `tuck-end` | main, extended in library | `tube` (preset carton) | `tuck` (lid: back) | `tuck` (lid: back) | `thumbNotch` (end: top), `window` | PK-TE-01 | tuck_top=straight_tuck; tuck_bottom=tuck; hang=none | window (3) | 3 |
| `te2-airplane` | library | `tube` (preset carton) | `airplaneTuck` (lid: front) | `tuck` (lid: back) | `slitLock` (end: top) | PK-TE-02 | tuck_top=airplane_tuck | lock (2), tuck_corner (2) | 4 |
| `te2-reverse` | library | `tube` (preset carton) | `tuck` (lid: front) | `tuck` (lid: back) | `slitLock` (end: top) | PK-TE-02 | tuck_top=reverse_tuck | lock (2), tuck_corner (2) | 4 |
| `te2-straight` | library | `tube` (preset carton) | `tuck` (lid: back) | `tuck` (lid: back) | `slitLock` (end: top) | PK-TE-02 | tuck_top=straight_tuck | lock (2), tuck_corner (2) | 4 |
| `tag-circle` | library | `flatShape` (shape: circle) | — | — | `hangHole` (cx: diameter / 2; cy: 14) | PK-TG-01 | shape_flat=circle | hang (4) | 4 |
| `tag-custom` | library | `flatShape` (shape: custom_path) | — | — | `hangHole` (cx: size / 2; cy: size / 2) | PK-TG-01 | shape_flat=custom_path | hang (2) | 2 |
| `tag-oval` | library | `flatShape` (shape: oval) | — | — | `hangHole` (cx: length / 2; cy: width / 4 + 6) | PK-TG-01 | shape_flat=oval | hang (4) | 4 |
| `tag-rect` | library | `flatShape` (shape: rectangle) | — | — | `hangHole` (cx: length / 2; cy: 14) | PK-TG-01 | shape_flat=rectangle | hang (4) | 4 |
| `tag-rounded` | library | `flatShape` (shape: rounded_rectangle) | — | — | `hangHole` (cx: length / 2; cy: 14) | PK-TG-01 | shape_flat=rounded_rectangle | hang (4) | 4 |
| `cup-sleeve` | main | `cone` | — | — | — | PK-TG-02 | — | — | 1 |
| `card-circle` | library | `flatShape` (shape: circle) | — | — | — | PK-TG-05 | shape_flat=circle | — | 1 |
| `card-custom` | library | `flatShape` (shape: custom_path) | — | — | — | PK-TG-05 | shape_flat=custom_path | — | 1 |
| `card-oval` | library | `flatShape` (shape: oval) | — | — | — | PK-TG-05 | shape_flat=oval | — | 1 |
| `card-rect` | library | `flatShape` (shape: rectangle) | — | — | — | PK-TG-05 | shape_flat=rectangle | — | 1 |
| `card-rounded` | library | `flatShape` (shape: rounded_rectangle) | — | — | — | PK-TG-05 | shape_flat=rounded_rectangle | — | 1 |
| `tray` | main, extended in library | `tray` (preset glued) | — | — | `lockCorners`, `dieCutInsert` (floor: t) | PK-TR-01 | — | corner (2), insert (2) | 4 |
| `tray-6-corner` | main, extended in library | `tray` (preset glued) | `hingedLid` (front: glued_lips) | — | `dieCutInsert` (floor: t) | PK-TR-02 | — | insert (2) | 2 |
| `double-wall-tray` | main, extended in library | `tray` (preset glued) | — | — | `rollOverWalls` (walls: back/front), `dieCutInsert` (floor: t; inset: t) | PK-TR-03 | — | insert (2) | 2 |
| `roll-end-tray` | library | `tray` (preset glued) | `hingedLid` (front: tuck) | — | `rollOverWalls` (walls: front/left/right), `dieCutInsert` (floor: t; inset: t) | PK-TR-04 | — | tuck_corner (2), insert (2), thumb (2) | 8 |

### Wave 1 coverage (U3.4)

All 41 wave-1 bases have engine recipes; **468 of the master's 578 variants are drawn** (folding
carton 257 / 365, inserts 11 / 11, corrugated 116 / 116, flexible 48 / 48, labels 12 / 12, tags and
sleeves 24 / 26). A variant that cannot be made is not drawn — packio-api leaves it `no_recipe`
(D-243) and the library never shows it. In the library `hang-tag` (the F4 chamfered tag) no longer names
PK-TG-01: its shape is not a master `shape_flat`, and packio-api reads an axis a recipe does not
name as any value — the `tag-*` recipes draw PK-TG-01 (the main entry's `hang-tag` still names it). Every drawn variant passes the variant
gate (`model/variant-gate.test.ts`): a clean blank at the first preset it is valid at, and — when it
folds — the thick model closes to its outer size ± 1 mm with no collision.

| Base | Name | Category | Master variants | Drawn | Not drawn |
| --- | --- | --- | --- | --- | --- |
| PK-TE-01 | Tuck-end carton (configurable ends) | folding_carton | 228 | 147 | 81 |
| PK-TE-02 | Tuck-end with slit or friction lock | folding_carton | 16 | 12 | 4 |
| PK-FT-01 | Hinged flip-top carton | folding_carton | 30 | 30 | 0 |
| PK-DS-01 | Counter display tray with header card | folding_carton | 4 | 4 | 0 |
| PK-TR-01 | Four-corner glued tray | folding_carton | 4 | 4 | 0 |
| PK-TR-02 | Six-corner glued tray | folding_carton | 2 | 2 | 0 |
| PK-TR-03 | Double-wall tray | folding_carton | 2 | 2 | 0 |
| PK-TR-04 | Roll-end tray with tuck lid (paperboard mailer) | folding_carton | 8 | 8 | 0 |
| PK-SL-01 | Open-end sleeve | folding_carton | 6 | 4 | 2 |
| PK-SL-02 | Sleeve and drawer (matchbox) | folding_carton | 12 | 8 | 4 |
| PK-SL-03 | Belly band / wrap band | folding_carton | 2 | 2 | 0 |
| PK-LB-01 | Two-piece telescope (paperboard) | folding_carton | 24 | 16 | 8 |
| PK-SP-01 | Pillow box | folding_carton | 12 | 8 | 4 |
| PK-SP-02 | Gable handle box | folding_carton | 15 | 10 | 5 |
| PK-IN-01 | Die-cut cavity insert | insert | 2 | 2 | 0 |
| PK-IN-03 | Tray insert | insert | 1 | 1 | 0 |
| PK-CS-01 | Regular slotted container | corrugated | 9 | 9 | 0 |
| PK-CS-02 | Half slotted container | corrugated | 9 | 9 | 0 |
| PK-CS-03 | Full overlap slotted container | corrugated | 9 | 9 | 0 |
| PK-CS-04 | Centre special slotted container | corrugated | 3 | 3 | 0 |
| PK-CS-06 | Slotted container with hand holes | corrugated | 3 | 3 | 0 |
| PK-CT-01 | Full telescope, two trays | corrugated | 6 | 6 | 0 |
| PK-CT-02 | Half-slotted body with telescope lid | corrugated | 9 | 9 | 0 |
| PK-CF-01 | Roll-end tuck-front mailer | corrugated | 48 | 48 | 0 |
| PK-CF-02 | Pizza box | corrugated | 2 | 2 | 0 |
| PK-CF-03 | Wrap-around blank | corrugated | 3 | 3 | 0 |
| PK-CF-05 | Corrugated lock-corner tray | corrugated | 3 | 3 | 0 |
| PK-CF-06 | Archive / document box | corrugated | 3 | 3 | 0 |
| PK-CF-08 | Produce tray / die-cut fruit box | corrugated | 9 | 9 | 0 |
| PK-CI-01 | Cross partition set | insert | 6 | 6 | 0 |
| PK-CI-02 | Pad and divider sheet | insert | 2 | 2 | 0 |
| PK-PB-01 | Stand-up pouch | flexible | 16 | 16 | 0 |
| PK-PB-02 | Three-side-seal flat pouch | flexible | 16 | 16 | 0 |
| PK-PB-06 | Courier poly mailer | flexible | 6 | 6 | 0 |
| PK-PG-01 | Paper carrier bag | flexible | 10 | 10 | 0 |
| PK-LA-01 | Roll label | label | 5 | 5 | 0 |
| PK-LA-02 | Sheet sticker | label | 5 | 5 | 0 |
| PK-LA-03 | Wrap-around bottle label | label | 2 | 2 | 0 |
| PK-TG-01 | Hang tag | tag_sleeve | 20 | 18 | 2 |
| PK-TG-02 | Cup sleeve | tag_sleeve | 1 | 1 | 0 |
| PK-TG-05 | Insert / thank-you card | tag_sleeve | 5 | 5 | 0 |

Not drawn, and why:

- **PK-TE-01** — `hang` ≠ none on a straight-tuck or seal top (19 pairs × 3 windows less the 10 pairs with a free back panel): the hang tab stands on the back panel, which carries the lid or the closing flap.
- **PK-TE-02** — `tuck_top` = seal × lock × corner: a seal end has no tuck to lock.
- **PK-SL-01** — `window` = top_window: an open sleeve has no top panel.
- **PK-SL-02** — `window` = front_window: the matchbox shows its sleeve's top (drawn as top_window); its ends are open.
- **PK-LB-01** — `window` = front_window: the lid covers the base's front; a window in a partial lid's wall does not fit.
- **PK-SP-01** — `window` = top_window: a pillow has no top panel.
- **PK-SP-02** — `window` = top_window: the gable roof carries the handle, there is no top panel.
- **PK-TG-01** — `shape_flat` = custom_path with a euro slot or sombrero: a 32 mm slot does not fit inside an arbitrary outline (round hole only).

### Wave 2 coverage (U3.4)

**43 of the 49 wave-2 bases have engine recipes; 283 of the master's 331 variants are drawn**
(folding carton 105 / 137, inserts 8 / 8, corrugated 49 / 49, rigid 60 / 74, flexible and bags 51 / 52,
labels 6 / 6, tags and sleeves 4 / 5). With wave 1, **84 bases and 751 of 909 variants**. Every drawn
variant passes the variant gate and, when it folds, the fold gate at its minimum, typical and maximum
sizes; rigid-only recipes are folded on the rigid reference board. All new names and descriptions are
`pending` review (D-212); no industry codes are shown for the new bases (D-211).

| Base | Name | Category | Master variants | Drawn | Not drawn | Recipes |
| --- | --- | --- | --- | --- | --- | --- |
| PK-TE-03 | Double-wall tuck-front carton | folding_carton | 6 | 0 | 6 | — |
| PK-FT-02 | Flip-top with extended dust flaps | folding_carton | 10 | 10 | 0 | `ft2-tuck`, `ft2-snap`, `ft2-crash`, `ft2-seal`, `ft2-fourflap` |
| PK-DS-02 | Tear-away display carton | folding_carton | 20 | 20 | 0 | `tear-display-tuck`, `tear-display-snap`, `tear-display-crash`, `tear-display-seal`, `tear-display-fourflap` |
| PK-DS-03 | Auto-bottom display with raised back | folding_carton | 3 | 2 | 1 | `display-raised-back` |
| PK-SP-03 | Hexagonal carton | folding_carton | 12 | 6 | 6 | `hexagonal`, `hexagonal-reverse` |
| PK-SP-05 | Triangular prism carton | folding_carton | 12 | 12 | 0 | `triangular` |
| PK-SP-06 | Bottle carrier with handle | folding_carton | 6 | 6 | 0 | `bottle-carrier` |
| PK-SP-07 | Cake box | folding_carton | 9 | 2 | 7 | `cake-box` |
| PK-SP-08 | Food pail / noodle box | folding_carton | 3 | 0 | 3 | — |
| PK-SP-09 | Clamshell burger box | folding_carton | 1 | 0 | 1 | — |
| PK-SP-10 | Food boat tray | folding_carton | 1 | 1 | 0 | `food-boat` |
| PK-SP-12 | Presentation folder | folding_carton | 2 | 2 | 0 | `presentation-folder` |
| PK-SP-13 | Paperboard envelope / wallet | folding_carton | 2 | 2 | 0 | `board-envelope` |
| PK-IN-02 | Bottle-neck insert | insert | 1 | 1 | 0 | `neck-insert` |
| PK-CS-05 | Overlap slotted container | corrugated | 3 | 3 | 0 | `osc` |
| PK-CT-03 | Design-style telescope (double cover) | corrugated | 3 | 3 | 0 | `design-telescope` |
| PK-CF-04 | Book wrap folder | corrugated | 2 | 2 | 0 | `book-wrap` |
| PK-CF-07 | Shoe box | corrugated | 2 | 2 | 0 | `shoe-box` |
| PK-CZ-01 | Corrugated slide box | corrugated | 2 | 2 | 0 | `slide-corr` |
| PK-CG-01 | Corrugated crash-lock bottom box | corrugated | 9 | 9 | 0 | `rsc-crash` |
| PK-CG-02 | Corrugated carry box with handle | corrugated | 1 | 1 | 0 | `gable-carry-corr` |
| PK-CD-01 | Shelf-ready tray with tear-off top | corrugated | 6 | 6 | 0 | `srp-tray` |
| PK-CI-03 | Corner and edge protector | insert | 1 | 1 | 0 | `edge-protector` |
| PK-CI-04 | Bottle shipper with cells | insert | 6 | 6 | 0 | `bottle-shipper` |
| PK-RG-01 | Rigid lid and base | rigid | 24 | 16 | 8 | `rigid-lid-base` |
| PK-RG-02 | Rigid shoulder-neck box | rigid | 2 | 2 | 0 | `rigid-shoulder-neck` |
| PK-RG-03 | Rigid book-style box | rigid | 18 | 18 | 0 | `rigid-book` |
| PK-RG-04 | Collapsible rigid box | rigid | 6 | 0 | 6 | — |
| PK-RG-05 | Rigid drawer box | rigid | 4 | 4 | 0 | `rigid-drawer` |
| PK-RG-06 | Rigid hinged-lid box | rigid | 18 | 18 | 0 | `rigid-hinged` |
| PK-RG-07 | Paper tube / cylinder | rigid | 2 | 2 | 0 | `paper-tube` |
| PK-PB-03 | Centre-seal (pillow) pouch | flexible | 16 | 16 | 0 | `center-seal-pouch` |
| PK-PB-04 | Flat-bottom box pouch | flexible | 16 | 16 | 0 | `flat-bottom-pouch` |
| PK-PB-05 | Side-gusset bag | flexible | 16 | 16 | 0 | `side-gusset-bag` |
| PK-PB-07 | Bubble mailer | flexible | 1 | 1 | 0 | `bubble-mailer` |
| PK-PG-02 | SOS paper bag | flexible | 3 | 2 | 1 | `sos-bag` |
| PK-LA-04 | Tamper-evident seal | label | 5 | 5 | 0 | `tamper-seal-rect`, `tamper-seal-rounded`, `tamper-seal-circle`, `tamper-seal-oval`, `tamper-seal-custom` |
| PK-TG-03 | Cup carrier | tag_sleeve | 1 | 0 | 1 | — |
| PK-TE-04 | Tuck-end with integral partition | folding_carton | 4 | 0 | 4 | — |
| PK-TE-05 | Tamper-evident tuck-end | folding_carton | 20 | 20 | 0 | `te-tamper-tuck`, `te-tamper-snap`, `te-tamper-crash`, `te-tamper-seal`, `te-tamper-fourflap` |
| PK-TR-05 | Lock-corner tray with hinged lid | folding_carton | 6 | 4 | 2 | `tray-lid-lock` |
| PK-SP-16 | Lock-corner food box with window lid | folding_carton | 3 | 1 | 2 | `food-box-lock` |
| PK-SP-18 | Tall bottle carton with neck lock | folding_carton | 12 | 12 | 0 | `bottle-neck-carton` |
| PK-SP-19 | Dispenser carton | folding_carton | 5 | 5 | 0 | `dispenser-tuck`, `dispenser-snap`, `dispenser-crash`, `dispenser-seal`, `dispenser-fourflap` |
| PK-CF-09 | Five-panel folder | corrugated | 3 | 3 | 0 | `five-panel-folder` |
| PK-CF-10 | Self-seal e-commerce mailer | corrugated | 12 | 12 | 0 | `ecom-mailer` |
| PK-CG-03 | Tape-free shipping box | corrugated | 6 | 6 | 0 | `tape-free-box` |
| PK-LA-05 | Neck collar label | label | 1 | 1 | 0 | `neck-collar` |
| PK-TG-04 | Bag header card | tag_sleeve | 4 | 4 | 0 | `header-card` |

Not drawn because it cannot be made (18):

- **PK-DS-03** — `window` = top_window: an open display has no top panel.
- **PK-SP-03** — `tuck_top` = airplane_tuck or seal (× 3 windows): a hexagon's end is a polygon lid on one panel; airplane and seal ends are four-panel closures. Straight and reverse polygon tucks are drawn.
- **PK-TR-05** — `window` = front_window (× 2 inserts): the tuck-front lid's front flap covers the front wall.
- **PK-RG-01** — `window` = front_window (× 2 lid depths × 2 inserts × 2 thumbs): the lid covers the base's front (as PK-LB-01).
- **PK-PG-02** — `window` = top_window: a bag has no top panel.

Not drawn yet — makeable, waiting for the work named (30):

- **PK-TE-03** (6) — as drafted, a double-wall tray with a tuck-front lid is the roll-end tray (PK-TR-04): the back wall carries the lid, so it cannot roll over. Prepress to confirm the intended construction before a recipe is written.
- **PK-TE-04** (4) — needs an integral divider module (a fifth panel folded in as a partition).
- **PK-SP-08** (3) — needs tapered (trapezoid) tube walls for the pail.
- **PK-SP-09** (1) — with straight walls it is the six-corner tray (PK-TR-02); needs sloped clamshell walls and a front lock.
- **PK-TG-03** (1) — needs a carrier construction with a handle (a holder without one is not a carrier).
- **PK-RG-04** (6) — needs a collapsible rigid construction (hinged walls that fold flat).
- **PK-SP-07** (7) — a front window and side handles sit under the six-corner lid's lips; both need positions below the lip.
- **PK-SP-16** (2) — the lid's ears line the side walls where hand holes would go; needs handle positions clear of the ears.

New modules: `osc`, `displayTop`, `coverFlaps` (closures); `trayWindow`, `securityCuts`, `neckHole`,
`tearStrip`, `adhesiveStrip`, `dispenser`, `tearLine`, `tamperTuck`, `partitionInsert`, `neckLock`
(features); `foldedCard`, `presentationFolder`, `envelope`, `paperTube` (bodies); `rigidCase`,
`shoulderNeck` (piece sets). Extended: `flipTop` (`extended` wings), `polygonTuckLid` (any n, either
panel, a lid window), `hingedLid` (a lid window), `lidAndBase` (inserts), `paperBag` (`sos`, a front
window), `pouchWeb` (features on side-by-side webs, `flat_bottom`), `telescopeLid` (a bottom cover),
piece placement (`under`, `offset`). ⚠ Every new construction carries its "to be confirmed by
Prepress" note in its module's documentation.

### Wave 3 coverage (U3.4)

**12 of the 15 wave-3 bases have engine recipes; 45 of the master's 51 variants are drawn** (folding
carton 19 / 23, corrugated 13 / 15, rigid 6 / 6, flexible 1 / 1, labels 6 / 6). **All three waves: 96
of 105 bases, 796 of 960 variants.** Same gates, review state and code rules as wave 2.

| Base | Name | Category | Master variants | Drawn | Not drawn | Recipes |
| --- | --- | --- | --- | --- | --- | --- |
| PK-DS-04 | Easel-back display stand | folding_carton | 2 | 2 | 0 | `easel-display` |
| PK-SP-04 | Octagonal carton | folding_carton | 4 | 2 | 2 | `octagonal`, `octagonal-reverse` |
| PK-SP-11 | Cone / popcorn box | folding_carton | 1 | 0 | 1 | — |
| PK-CD-02 | Floor display unit | corrugated | 8 | 8 | 0 | `floor-display` |
| PK-CB-01 | Bulk bin / pallet box | corrugated | 2 | 2 | 0 | `bulk-bin` |
| PK-SL-04 | Sleeve with hinged lid | folding_carton | 6 | 6 | 0 | `sleeve-lid` |
| PK-SP-14 | Petal-close carton | folding_carton | 5 | 5 | 0 | `petal-tuck`, `petal-snap`, `petal-crash`, `petal-seal`, `petal-fourflap` |
| PK-SP-15 | Pyramid carton | folding_carton | 4 | 4 | 0 | `pyramid` |
| PK-SP-17 | Hot dog / snack tray | folding_carton | 1 | 0 | 1 | — |
| PK-CB-02 | Octagonal bulk bin | corrugated | 2 | 0 | 2 | — |
| PK-CB-03 | Pallet sleeve with cap and base tray | corrugated | 3 | 3 | 0 | `pallet-sleeve` |
| PK-RG-08 | Double-door rigid box | rigid | 6 | 6 | 0 | `rigid-double-door` |
| PK-PB-08 | Spouted pouch | flexible | 1 | 1 | 0 | `spouted-pouch` |
| PK-LA-06 | Peel-back booklet label | label | 5 | 5 | 0 | `booklet-label-rect`, `booklet-label-rounded`, `booklet-label-circle`, `booklet-label-oval`, `booklet-label-custom` |
| PK-LA-07 | Shrink sleeve label | label | 1 | 1 | 0 | `shrink-sleeve` |

Not drawn because it cannot be made (2):

- **PK-SP-04** — `tuck_top` = airplane_tuck or seal: an octagon's end is a polygon lid (as PK-SP-03).

Not drawn yet — makeable, waiting for the work named (4):

- **PK-SP-11** (1) — tapered walls (as PK-SP-08).
- **PK-SP-17** (1) — a cradle cut into the end walls' free edges; tray walls cannot be shaped yet.
- **PK-CB-02** (2) — an eight-sided slotted flap bottom for the octagonal bin.

New modules: `petal` (closure; replaces its `planned` entry), `bookletHinge` (feature), `easel`,
`pyramid`, `shrinkSleeve` (bodies), `floorDisplay` (piece set); `rigidCase` gains `doors`,
`pouchWeb` a `spout`, `telescopeLid` a full-depth `lid`.

## 4. Patterns the engine does not draw

For these, prepress supplies the die file through the drawing job's upload (admin prepress, F2 2.4)
the way Locopack called `DRAWING_URL`; the catalogue leaves `dielineKey` empty, so the configurator
shows no 3D preview and the designer is not offered.

| Legacy | Why not yet |
| --- | --- |
| pid 5 ไส้ (folding cushion / insert with `x` cells) | The legacy `x`-cell cushion (`dw = d + l + 2r`, `dl = r(x+1) + wx + d`) depends on the product it holds and needs a sample. Since U3.4 a die-cut cavity insert (`cavity-insert`, PK-IN-01), inserts inside boxes (`insert` axis) and partition sets (`partition-set`, PK-CI-01) are drawn |
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
- **Wave 1 (U3.4)**, all ⚠ until Prepress signs them off: airplane-tuck wings cut back 0.3 × reach
  at the panel and 0.15 × reach at the tuck; four-flap lock flaps tiled at 45°; slit lock = two
  10 × 1 mm slits 2 mm from the tuck crease; flip-top lid = side + t with a lip of a third of the
  height (12–25 mm) outside the front; lid window in the lid face; sombrero hole 30 mm brim, 12 mm
  crown; lock corners = 1.5 mm slits where each corner flap lands (no lock tab drawn); display header
  in line with the back wall; die-cut insert = platform with a 60 % cavity on legs of a third of the
  height, 1.5 mm + t clearance; mailer tab lock = two tabs at ¼ and ¾ (no receiving slots drawn),
  tear strip = two perforations 8 mm apart, adhesive strips 6 mm wide; finger holes Ø ≤ 20 mm;
  hand holes 90 × 30 mm and clip-in handle slots 20 × 6 mm 50 mm apart; vents Ø 12 mm or 30 × 10 mm;
  stitched joint = flap ≥ 35 mm without a glue area, taped joint = no flap; partition slots
  t + 1 mm wide, half the height; pouch zipper 8 mm under the top seal, tear notch 3 mm deep 4 mm
  under it, hang hole Ø 6 mm in the top seal, window = cut-out with a film patch; poly-mailer
  strips 8 mm on the flap; paper bag turn-over 50 mm, bottom flaps half the gusset + 15 mm.
- A pillow box is at most half as thick as it is wide (`pillow.too_thick`): beyond that its end
  lenses pass a half circle and the neighbouring flaps overlap (found by the property test, U3.4).

### Library completion (D-408, 2026-10-15)

**105 of 105 bases, 894 of 894 variants drawn.** The master file's `excluded_combinations` leave out 66 of the 960
combinations no factory can build (straight tuck + hang tab 45; top windows where the top is open or not a face 13;
seal / airplane tops on polygon cartons 8). Every remaining variant passes the variant and fold gates, and packio-api's
strict `drawableBy` with the real engine (`v0.57.0`).

| Base | Added | Recipes / modules |
| --- | --- | --- |
| PK-TE-01 | seal top under a hang tab (36) | `te-sealhang-{tuck,snap,crash,seal}`, closure `sealHang` (front flap covers the end; slotted flaps skip a zero-depth panel) |
| PK-TE-02 | seal top, the lock on the bottom tuck (4) | `te2-seal`; `slitLock` places a bottom lid's slits on its tuck crease |
| PK-TE-03 | new base (6) | `te3-double-wall`, `te3-double-wall-window` (front window on a single front wall) |
| PK-TE-04 | new base (4) | `te4-partition` (reverse tuck, partition 1 × 2 / 2 × 2) |
| PK-LB-01, PK-RG-01 | front window (16) | `lidAndBase`: below a partial lid's rim, or through the base and the turned-over full lid (aligned in 3D) |
| PK-SL-02 | side window (4) | `sleeveAndDrawer`: through the sleeve side and the drawer's long wall |
| PK-TR-05, PK-SP-07 | front window (3) | `trayWindow` `wall-front` |
| PK-SP-07, PK-SP-16 | handles (8) | `handHoles` side / insert |
| PK-SP-08, PK-SP-11 | new bases (4) | `food-pail`, `popcorn-box` on body `taperedTray` (trapezoid walls, corner glue flaps folded by the walls' dihedral, dust + meeting top flaps, die-cut or wire handle) |
| PK-SP-09, PK-SP-17, PK-TG-03 | new bases (3) | `burger-clamshell`, `snack-tray`, `cup-carrier` |
| PK-CB-02 | new base (2) | `octagonal-bin` (square telescope cap: `telescopeLid` takes the inside across as an expression) |
| PK-RG-04 | new base (6) | `rigid-collapsible` (`rigidCase`, magnet / ribbon) |
| PK-TG-01 | custom tag euro / sombrero (2) | `tag-custom` |

⚠ As before, every new construction's clearances, flap depths and hole positions are "to be confirmed by Prepress".

### Market survey additions (D-409, 2026-10-15)

A survey of Packhelp, Pakfactory, Packlane, Refine, PackMojo, Pacdora, templatemaker.nl, packsdo, FEFCO / ECMA
catalogues and Thai printers (`docs/design-tool/style-survey-2026-10.md`) found 61 structures we lacked. The first
18 are in: **123 bases, 987 variants, every one drawn.**

| Base | Name | Recipe(s) / module |
| --- | --- | --- |
| PK-CS-07 | Slotted box with 1-2-3 snap bottom | `rsc-snap` |
| PK-CS-08 | Slotted box with tuck-in lid | `rsc-tuck-lid` |
| PK-CS-09 | Multi-depth shipping box | `rsc-multi-depth`, feature `depthScores` |
| PK-SL-05 | Holster / slipcase | `holster` |
| PK-TE-06 | Five-panel hanger box (60 variants) | `hanger5-*`, `hangTab` `ply: 2` |
| PK-DS-05 | Table tent card | `tent-card`, body `tentCard` |
| PK-DS-06 | Corrugated dump bin | `dump-bin` (open top + `shapedHeader`) |
| PK-TG-06 | Folded leaflet (bi / tri / Z / gate) | `folded-leaflet`, body `leaflet` |
| PK-TG-07 | Blister / hang card | `hang-card` |
| PK-TG-08 | Bottle necker | `bottle-necker` |
| PK-SP-20 | Ice-cream cone holder | `cone-holder` (circle cavities) |
| PK-SP-22 | Tapered gift box | `tapered-gift` (`taperedTray`, negative taper) |
| PK-TR-06 | Nestable tapered tray | `nestable-tray` |
| PK-SP-23, PK-SP-24 | Paper cup, paper bowl | `paper-cup`, `paper-bowl`, body `cupBlank` |
| PK-SP-25, PK-SP-26 | Triangular, pentagonal carton | `triangular-carton`, `pentagonal-carton` |
| PK-IN-04 | Corrugated U-liner | `u-liner`, body `uLiner` |

Also new on existing bases (parameters, not variants): **cavity inserts cut to the product** (`cavityShape`
rectangle / circle / bottle, `cavityGrid`, product size) on every tuck end and tray with an insert, and a **shaped
display header** (`headerShape` arch, peak, wave, scallop, cloud, flower or the customer's SVG profile) on
front-hinged tuck ends.
