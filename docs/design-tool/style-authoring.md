# Authoring a box style

Since U3.1 a style is a **recipe**: a JSON file in `packages/dieline/src/recipes/data/` that
names the **modules** it is made of and sets their sizes, plus the parameters, defaults, presets
and names a customer sees (ADR-0011). `styleFromRecipe` turns it into the `BoxStyleDef` the
registry exposes, so the designer's setup dialog, the configurator, the drawing service in
packio-api and the tests read it as before. The geometry model is ADR-0008; this is the how-to.

Most new styles are a new recipe over existing modules. A **new construction** — a closure, a
feature or a body nobody has drawn yet — is a new module first (§3), then its recipes.

## 1. Rules that are not optional

- **Millimetres, y down, origin top-left, printed side facing you.** `assemble` anchors the sheet
  at the origin for you.
- **Every edge has a role**: `cut`, `crease`, `perforation`, `half_cut`, `glue_area`, `bleed`. A
  fold between two faces is **one edge listed by both faces with the same end points**;
  `dielineLines` draws it once and the fold finds it as a hinge.
- **Faces and pieces are named by label keys** from `labels.ts` (`FACE_LABELS`, `PIECE_LABELS`),
  never by words in the geometry. `parseRecipe` refuses an unknown label.
- **Caliper is the recipe's job, in the open.** Inside sizes come in; the body's `dims` add the
  make-up allowances (`a.panel`, `a.depth`, `a.trayDepth`, `a.flap`, `a.gluePanel` — catalogue
  flute allowances win over caliper-derived ones) so the folded box is the size the customer typed.
  Never a board in a recipe.
- **Rules speak both languages and keep their codes.** A constraint's `code` is what the UI
  translates (`tuck.too_deep`); its `message` is the Thai and English fallback.
- **Legacy mapping**: `legacy.patternKeys` lists the Locopack patterns the style draws; catalogue
  aliases stay in `STYLE_ALIASES`. Update [style-mapping.md](style-mapping.md) in the same change.

## 2. A recipe, read line by line

`recipes/data/tuck-end.json`, shortened:

```jsonc
{
  "schemaVersion": 1,
  "id": "tuck-end", // the engine id designs and dielineKey carry — never change it
  "base": "PK-TE-01", // its row in style-library-master.json …
  "variant": { "tuck_top": "straight_tuck", "tuck_bottom": "tuck", "hang": "none" }, // … and the axis values it stands for
  "category": "folding_carton",
  "name": { "th": "กล่องฝาเสียบ (บน-ล่างทางเดียวกัน)", "en": "Straight tuck end" },
  "description": { "th": "…", "en": "…" },
  "materials": ["paperboard", "corrugated"],
  "params": [
    { "ref": "length", "min": 20, "max": 400 }, // a params.json entry with this style's limits
    { "ref": "width", "min": 15, "max": 300 },
    { "ref": "height", "min": 20, "max": 450 },
    "tuckDepth", "tuckCorners", "dustFlapDepth", "thumbNotch",
    "glueWidth", "glueSide", "grain",
    "window", "windowPanel", "windowWidth", "windowHeight", "windowOffsetX", "windowOffsetY", "windowRadius"
  ],
  "defaults": { "@extends": "carton" }, // sets.json, with this style's own keys on top
  "presets": "carton", // or a list of { id, label, values }
  "body": { "module": "tube", "preset": "carton" },
  "closures": {
    "top": { "module": "tuck", "with": { "lid": "back" } },
    "bottom": { "module": "tuck", "with": { "lid": "back" } } // "front" here makes a reverse tuck end
  },
  "features": [{ "module": "thumbNotch", "with": { "end": "top" } }, { "module": "window" }],
  "legacy": { "patternKeys": ["pid:1", "mapping:1", "folding-truck-end-box", "…"] }
}
```

The `carton` preset of `tube` is the compensation, as data:

```jsonc
"dims": { // evaluated in order; later ones may use earlier ones
  "front": "length + a.panel",
  "side": "width + a.panel",
  "closingSide": "side - a.gluePanel", // the panel the glue flap closes on, t narrower
  "depth": "height + a.depth",
  "glue": "glueWidth ?? glueWidthFor(width)" // the customer's value, or the legacy table
},
"panels": [{ "id": "front", "label": "front", "width": "front" }, "…"],
"depth": "depth", "glue": "glue", "glueRight": "glueSide == 'right'", "grain": "front", "root": "front"
```

A recipe may override any of it with `"with": { … }` (a top-level key replaces the preset's).

**Variants**: `"variants": { "<axis>": { "<value>": { …parameter values } } }` lists the
structural options along master-file axes (`window`, `hang`, `hand_holes`, `lid_depth`, `thumb` …,
only axes of the recipe's `base` row); every combination is a variant, keyed with the fixed
`variant` axes (`variantsOf`). Each axis value needs a phrase in `AXIS_PHRASES`
(`recipes/variants.ts`) — construction words, never claims; generated names stay `pending` until
approved into `recipes/names.reviewed.json` (D-212). Sizes, materials and prints are never variants.

**Outer size**: the fold gate holds the thick 3D model to `outerSize` (default: nominal + 2t per
axis). Set it for an open axis (`"height": "height"` on a sleeve, `"height + t"` on a tray) or a flap
that wraps a wall (`"width": "width + 3 * t"` on a mailer), and say why in the PR.

**Optional parts:** `pieceSet` instead of `body` for separately cut pieces (`lidAndBase`,
`sleeveAndDrawer`); `constraints` for rules of this style alone (they run before the modules');
`closedSize` (`{ "length", "width", "height" }` expressions) when the closed shape is not the
inside L × W × H — a gable's roof, a lid over its base, a hexagon across its corners; `codes` for
industry codes Prepress has verified (D-211); `incompatible` for module pairs the recipe refuses.

### Expressions

Sizes, rules and closed sizes are expressions (`src/expr.ts`): `+ - * /`, comparisons,
`and or not`, `a ?? b` (b when a is unset), `c ? a : b`, numbers and `'strings'`. Names: every
parameter (numeric ones as numbers), the body's `dims` (they shadow a parameter of the same name),
`t` (caliper), `a.panel` … (allowances), `material.kind`, `material.flute`, `pi`, `C.<NAME>` for a
number in `constants.ts`. Functions: `min max abs floor ceil round sqrt sin cos tan number` and the
legacy tables `tuckDepthFor(L)`, `glueWidthFor(W)`, `snapLockTongueFor(W)`, `slotWidth()`.

A constraint holds when its `require` is **true** and fails only when it is **definitely false**:
a comparison with an unset value is unknown, and unknown never fails.

```json
{
  "id": "pillow.thickness",
  "code": "pillow.too_thick",
  "severity": "error",
  "param": "thickness",
  "require": "thickness <= width / 2",
  "message": { "th": "ความหนาต้องไม่เกินครึ่งหนึ่งของความกว้าง", "en": "Thickness must be at most half the width" }
}
```

A rule of the material rather than the style reads the class's manufacturing rules as
`rule.<name>` (`rule.minTuck`, `rule.minPanel`, `rule.seal.min` — `src/rules/materials.ts`) and is
marked `"stage": "manufacturing"`: `explain()` and the solver run it, `validate()` does not (it
keeps the checks the storefront shipped with until U3.5 moves the UI onto `explain()`). A
manufacturing rule that needs the geometry or a module's settings goes in
`src/rules/module-rules.ts`, keyed by module id — outside the module, so pages that only draw never
load it.

Rules run in a fixed order — the recipe's own, then each module's (body, top, bottom, features:
its data rules, then its coded check) — and a constraint id runs once.

## 3. A new module

A module (`packages/dieline/src/modules/<slot>/…`) is a construction a factory would recognise.
It declares, in `ModuleDef` (`modules/types.ts`):

| Field | What |
| --- | --- |
| `id`, `slot`, `status`, `label` | `body` · `closure` · `feature` · `pieceSet`; `implemented` or `planned`; Thai and English |
| `params` | parameter keys it reads (add new ones to `recipes/params.json`) |
| `constraints` | data rules (a function of its settings when they differ by setting) |
| `check` | a coded rule over the built geometry (a window inside its panel) |
| `processes` | what a factory needs (`PROCESSES`: `die_cut`, `folder_gluer_crash_lock`, `window_patching`…) — the capability matrix (U3.B3) matches on these |
| `contributes` | the face kinds and line roles it adds |
| `hinges` | its part of the fold: roots, angles, stages, placement |
| `presets` | named settings recipes start from |
| `tube` / `tray` / `tubeHoles` / `wrapClosure` / `flatHoles` / `build` | the geometry, by slot and by the body it attaches to (`fits`) |

Draw with the `construct/` builders (`buildTube`, `buildTray`, `slottedFlaps`, `tuckClosure`…)
rather than from scratch; read sizes from `ctx.dims` and settings from `cfg`, evaluating
expressions with `ctx.num()`. Register it in `modules/index.ts`. A module listed as `planned`
(`modules/planned.ts`) becomes `implemented` when its first recipe lands.

## 4. Then

- **Register the recipe**: import it in `recipes/index.ts` and add it to `RECIPES` (the order is
  the pickers' order within a category).
- **Run the matrix**: `pnpm --filter @packio/dieline test`. Every recipe passes `parseRecipe`;
  `styles.test.ts` builds every style × preset × allowed reference material and asserts closed cut
  loops (≤ 0.01 mm), free edges cut, no overlapping faces, no dangling cuts (`checkDieline`), the
  sheet anchored at the origin, every face and piece labelled in both languages, `validate()`
  accepting the presets and rejecting sizes outside the range, and the folded bounding box equal to
  the nominal size within the caliper allowance ± 1 mm.
- **The baseline**: `fixtures/baseline/<style>.json` pins every build, fold and validation. A new
  recipe writes its file on the first run; a changed one fails until it is accepted with
  `vitest -u` **and** the difference is explained in PROGRESS (prepress signs off a geometry change).
- **Accept the fixtures**: `pnpm --filter @packio/dieline fixtures` writes the SVG/DXF snapshots;
  review them like code — they are what packio-api's golden comparison reads.
- **Assets**: `pnpm styles:render` re-renders every variant's dieline SVG and 2D/3D thumbnails
  into `packages/dieline/generated/` and rewrites `generated/manifest.json` — commit the manifest
  (CI's `styles:render:check` fails when it is stale). `pnpm style:thumbnails` still redraws the
  docs contact sheet in `docs/design-tool/styles/`.
- **Changeset**: a new style is a `minor` change of `@packio/dieline` (`pnpm changeset`).

## 5. Common mistakes

- **Two edges where there should be one** — a crease drawn twice with slightly different ends is
  two cuts to `checkDieline` and no hinge to the fold. Build shared edges from the same numbers.
- **Folding the wrong way** — the fold always goes away from the print; if a flap ends up inside
  out, the face order or the root is wrong, not the angle's sign.
- **The same rule written twice** — reuse a module's constraint (it runs once per id) rather than
  copying it into the recipe under another id.
- **A preset that is only nearly valid** — presets are test inputs; `validate` must return no
  errors for every material the style allows.
- **`not` as an operand** — `x + not y` is a syntax error; logic operators combine comparisons.
