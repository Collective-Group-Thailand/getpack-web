# @getpack/dieline

## 1.0.0

### Major Changes

- 89b7f94: Engine v2 — breaking. Faces are closed contours of line, arc and Bézier edges, each with a
  role (`cut`, `crease`, `perforation`, `half_cut`, `glue_area`, `bleed`); faces may be
  non-convex and carry holes; a dieline is a set of pieces. Box styles are data-driven
  `BoxStyleDef`s in a registry (`STYLES`, `getStyle`, `resolveStyleId`) with parameter
  schemas, bilingual `validate()` and caliper compensation from a `MaterialSpec`. New:
  Clipper2-based offsetting (`safeZone`, `bleedOutline`), a geometry checker
  (`checkDieline`), 3D folding transforms (`foldDieline`, `foldedBounds`), exports to layered
  SVG with true arcs, R12 DXF and a vector PDF with spot-colour layers (`dielineToPdf`), and
  `migrateSpec` / `remapV1Point` for BoxStudio-era designs. Removed: `buildDieline(style,
dims)`, `dielineSegments`, `faceCentroid`, `insetConvex`, `flat` — see README "Migrating
  from 0.x".

### Minor Changes

- 56fb931: First extraction of the box geometry engine out of the app: `buildDieline` for RSC,
  straight tuck end and tray, `dielineSegments`, `dielineToSvg`, `faceCentroid`,
  `insetConvex`, `flat` and `PX_PER_MM`, with no React or DOM dependency.
- 6a12265: `patternFixtures()` and `fixtures/patterns/*.svg`: one drawing per mapped legacy Locopack pattern, for getpack-api's golden comparison against the legacy drawings.
- 218102d: Styles are composable recipes (ADR-0011): JSON recipes over body, closure, feature and piece-set
  modules, sizes and rules as expressions. `RECIPES`, `parseRecipe`, `buildFromRecipe`,
  `styleFromRecipe`, `MODULES`, `PROCESSES` and the expression helpers are new; every existing style
  builds, folds and validates byte for byte as before.
- daf4df3: Constraint solver and manufacturability (U3.2): material classes with rule sets
  (`MaterialSpec.class`, `materialRules`), `explain()` with codes, expected and actual values,
  `validRanges()` / `sizeRanges()`, `fitsEnvelope()` for partner machine envelopes and
  `recipeProcesses()`. `validate()` is unchanged.
- 4b6c894: Automatic 3D, virtual fold test and assets (U3.3): `foldModel` (board thickness), `modelBounds`,
  `collisions`, `inflatedPouch`, `outerSizeOf` and recipe `outerSize`; structural variants
  (`variants`, `variantsOf`, `describeVariant` with review-pending names); a software rasteriser
  (`render2D`, `render3D`, `renderSurface`) and `generated/` assets with a manifest. New
  manufacturing rule `mfg.glue_flap_too_wide`.
