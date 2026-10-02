# `@packio/dieline`

The box geometry engine behind Packio's configurator, online designer and the drawing service
that sends factories their cutting dies (`packio-api` B4.1). It is **framework-free**: no React,
no DOM, no Node-only API — the same code runs in the browser, in a Node service and in tests.
Its one dependency, [`clipper2-ts`](https://github.com/countertype/clipper2-ts) (BSL-1.0), is
pure TypeScript and is only reached by the offsetting and export functions.

```ts
import { getStyle, dielineToSvg, dielineToDxf, dielineToPdf, validateStyle } from "@packio/dieline";

const board = { caliperMm: 0.45, kind: "paperboard" } as const; // from the catalogue API
const values = { length: 70, width: 40, height: 150, window: "rounded", windowWidth: 40 };

validateStyle("tuck-end", values, board); // [] — or Issues with Thai and English messages
const dieline = getStyle("tuck-end").build(values, board);
dieline.width; // flat sheet size in mm, anchored at the origin
dielineToSvg(dieline); // true-size SVG: CUT, CREASE, PERF, HALFCUT, GLUE layers, real arcs
dielineToDxf(dieline); // R12 DXF, same layers
dielineToPdf(dieline); // vector PDF, each layer a spot colour (CutContour, Crease…)
```

All lengths are millimetres, in the sheet's own frame: x right, **y down**, seen from the
printed side (the outside of the box).

## Geometry model

| Type           | What it is                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Edge`         | `line`, `arc` (centre, radius, `clockwise` as drawn in y-down) or cubic `bezier`, with a `role`                          |
| `EdgeRole`     | `cut` · `crease` · `perforation` · `half_cut` · `glue_area` · `bleed` — also the export layer                            |
| `Face`         | `id` (stable, artwork anchors to it), `label` (key into `FACE_LABELS`), `kind`, closed `outline`, `holes`, inner `marks` |
| `Piece`        | One separately cut blank (`lid`, `base`, `sleeve`, `drawer`…) with its faces, bounds and annotations (grain arrow)       |
| `Dieline`      | `styleId`, `pieces`, overall `width` × `height`                                                                          |
| `MaterialSpec` | `caliperMm`, `kind` (`paperboard`, `corrugated`, `rigid`, `label`, `flexible`), `flute`, optional catalogue `allowances` |

A fold between two faces is listed by **both** faces with the same end points; `dielineLines()`
returns every line once, with the faces it belongs to. `checkDieline()` proves a dieline is
cuttable and foldable: face ids unique, every outline and hole closed within 0.01 mm, every
free edge a cut, every fold shared by two faces, no overlapping faces, no cut ending in
mid-board, each piece one connected blank.

## Box styles

Each style is one file in `src/styles/` implementing `BoxStyleDef` and listed in
`src/styles/index.ts`:

```ts
interface BoxStyleDef {
  id: string; // "tuck-end", "rsc", …
  category: "folding_carton" | "corrugated" | "tray_lid" | "specialty" | "flat";
  name: Localized;
  description: Localized;
  codes?: { fefco?: string; ecma?: string }; // verified codes only
  params: ParamSchema[];
  defaults: ParamValues;
  presets: StylePreset[];
  materials: MaterialSpec["kind"][];
  validate(v: ParamValues, material: MaterialSpec): Issue[]; // schema + material + geometric rules
  build(v: ParamValues, material: MaterialSpec): Dieline; // caliper compensation applied
  faces3d?: HingeMap | ((v: ParamValues, material: MaterialSpec) => HingeMap); // how it folds
  legacy?: { patternKeys: string[] }; // Locopack pattern / drawing-service keys
}
```

| Function                                | Does                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `STYLES`                                | Every style, in catalogue order                                                          |
| `getStyle(key)` / `resolveStyleId(key)` | A style by id or catalogue alias (`rte` → `reverse-tuck-end`); `resolveStyleId` → `null` |
| `buildStyle(key, values, material)`     | `getStyle(key).build(...)`                                                               |
| `validateStyle(key, values, material)`  | Issues (`code`, `severity`, `param`, `message.th`, `message.en`)                         |
| `resolveValues(style, values)`          | Values with the style's defaults filled in                                               |
| `hingeMapOf(style, values, material)`   | The fold map for the 3D preview                                                          |

Compensation rules and every rule-of-thumb constant live in `src/constants.ts` with their
source (legacy calculator, common practice, or ⚠ awaiting prepress confirmation). The authoring
guide with a worked example is `docs/design-tool/style-authoring.md` in packio-web.

## Recipes and modules

Since U3.1 every style is a **recipe** — JSON in `src/recipes/data/` naming the modules it is made
of (a body or piece set, a closure per end, features), their sizes as expressions, and the
parameters, presets and names (ADR-0011). The registry above is built from them; nothing about
`STYLES` or `getStyle` changed.

```ts
import { buildFromRecipe, MODULES, parseRecipe, RECIPES } from "@packio/dieline";

const recipe = parseRecipe(json); // RecipeError { code, path } when it is not usable
const { dieline, hinges, limits } = buildFromRecipe(recipe, { length: 70, width: 40, height: 150 }, board);
MODULES.filter((m) => m.status === "planned"); // declared for U3.4, `module.not_implemented` if built
MODULES.find((m) => m.id === "crashLock")!.processes; // ["die_cut", "folder_gluer_crash_lock"]
```

| Export                                      | Does                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `RECIPES`                                   | The 30 recipes, registry order                                                          |
| `parseRecipe(raw)`                          | Checks a recipe: modules, slots, fit, parameters, labels, every expression and function |
| `buildFromRecipe(recipe, values, material)` | `{ dieline, hinges, limits }`                                                           |
| `styleFromRecipe(recipe)`                   | The `BoxStyleDef` the registry holds                                                    |
| `recipeConstraints(recipe)`                 | Every data rule in run order, deduplicated                                              |
| `MODULES` / `getModule(id)` / `PROCESSES`   | The module catalogue and the factory-process vocabulary (U3.B3 capability matrix)       |
| `compileExpression`, `namesOf`, `callsOf`   | The recipe expression language (`src/expr.ts`)                                          |

## Solver, materials and machines

`validate()` is the storefront's check as it shipped; `explain()` is the full answer (U3.2): the
schema, the material, every recipe and module rule, the geometry checks and the material class's
**manufacturing rules**, each as a `Violation { code, severity, rule, param, params, expected,
actual }` — codes and numbers for the UI to translate.

```ts
import { explain, fitsEnvelope, recipeProcesses, sizeRanges, validRanges } from "@packio/dieline";

explain(recipe, { length: 40, width: 80, height: 100 }, board);
// [{ code: "handle.too_narrow", rule: "constraint", param: "length", expected: { min: 60 }, actual: 40.45, … }]
validRanges(recipe, board); // [{ param: "length", domain: [20, 400], at: 150, intervals: [[59.55, 400]] }, …]
sizeRanges(recipe, board); // { length: { min: 59.55, max: 400 }, … } — the widest span around any preset
fitsEnvelope(dieline, board, machinesFromTheApi, recipeProcesses(recipe)); // per machine: fits, reasons, missing, rotated
```

| Export                                | Does                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `MATERIAL_CLASSES`, `materialClassOf` | `paperboard` `food_board` `corrugated` `rigid` `flexible` `paper` `label_stock` `shrink_film`; `MaterialSpec.class` or implied by `kind`   |
| `materialRules(m)`                    | Caliper range, minimum panel, cut-to-crease distance, glue flap, slot, window margin, tuck depth, crash-lock depth, seal widths (⚠ values) |
| `explain` / `isBuildable`             | Every rule a size breaks / whether it passes every error rule                                                                              |
| `validRanges` / `sizeRanges`          | Valid intervals per size parameter with the others held (sampled, boundaries to 0.01 mm) / per material for the library                    |
| `fitsEnvelope` / `recipeProcesses`    | Which machine envelopes (from the API) can cut each piece, either way round; the processes a recipe needs                                  |
| `dielineManufacturing`                | The whole-dieline rules: the caliper belongs to the class, no cut running beside a crease                                                  |

## Offsetting, 3D and exports

| Function                                            | Does                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `safeZone(face, mm)` / `offsetFace(face, mm)`       | Clipper2 offset of a face with its holes; curves are flattened to ≤ 0.2 mm only here                                                 |
| `bleedOutline(piece, mm)` / `pieceOutline(piece)`   | The piece's outer shape grown by the bleed (windows shrink)                                                                          |
| `facePolygons`, `overlapArea`, `triangulate`        | Polygon helpers for rendering, checks and 3D meshes                                                                                  |
| `foldDieline(d, map, progress)`                     | A column-major 4×4 transform per face, 0 = flat, 1 = closed; walls fold before flaps                                                 |
| `foldedBounds(d, map)`                              | The closed box's bounding box (hangers and handles ignored)                                                                          |
| `dielineToSvg(d, { margin, bleedMm, annotations })` | True-size SVG, layer groups `CUT` `CREASE` `PERF` `HALFCUT` `GLUE` (+ `BLEED`, `NOTES`)                                              |
| `dielineToDxf(d)`                                   | AutoCAD R12, mm, same layers; circular arcs as `ARC`                                                                                 |
| `dielineToPdf(d, { bleedMm, images, title })`       | PDF 1.6 bytes: spot-colour separations with overprint in optional-content layers, TrimBox/BleedBox, optional JPEG artwork underneath |
| `migrateSpec(spec)` / `remapV1Point(...)`           | BoxStudio-era `{ style, dims, paperId }` → `DielineSpec`; artwork points onto the same face                                          |

`FACE_LABELS` / `PIECE_LABELS` hold the Thai and English name for every label key.
`REFERENCE_MATERIALS` are typical boards for tests and previews only — never a catalogue.

## Golden fixtures for packio-api

`patternFixtures()` draws every legacy Locopack pattern key the registry maps (`legacy.patternKeys`)
with its style's first preset on the style's first reference material, and returns the key, the
style, the full parameter values, the material, and the SVG and DXF. packio-api feeds the same
values to the legacy drawing service and compares. The snapshots of that output ship in the
package as `fixtures/patterns/<key>.svg` (plus every style × preset in `fixtures/svg` and
`fixtures/dxf`); regenerate them with `pnpm --filter @packio/dieline fixtures` and review the diff.

```ts
import { patternFixtures } from "@packio/dieline";

for (const f of patternFixtures()) {
  // f.patternKey "pid:3" · f.styleId "sleeve" · f.values { length, width, height, … } · f.svg
}
```

## Migrating from 0.x

| 0.x                                          | 1.x                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `buildDieline(style, dims)`                  | `getStyle(style).build({ length, width, height }, material)`             |
| `dieline.faces`, `face.points`, `face.folds` | `allFaces(dieline)`, `face.outline` (edges with roles), `flattenContour` |
| `face.name` (Thai text)                      | `faceLabel(face.label).th` / `.en`                                       |
| `dielineSegments(d)`                         | `dielineLines(d)` (roles instead of `cut`/`fold`, curves kept)           |
| `faceCentroid(face)`                         | `faceBounds(face)`                                                       |
| `insetConvex(points, mm)`                    | `safeZone(face, mm)` — robust for concave faces, holes and curves        |
| `dielineToSvg(d, margin)`                    | `dielineToSvg(d, { margin })`                                            |

## Publishing

Versioned with Changesets and published to GitHub Packages from `main`
(`.github/workflows/release-dieline.yml`); semver, and a geometry change that moves any line is
a **major**. packio-api pins the version it consumes. The package ships `dist/` and `fixtures/`
— per-style SVG/DXF snapshots the drawing service's golden comparison uses. See
`docs/adr/0007-dieline-package.md` for ownership and `docs/adr/0008-dieline-geometry-model.md`
for why the model is shaped this way.
