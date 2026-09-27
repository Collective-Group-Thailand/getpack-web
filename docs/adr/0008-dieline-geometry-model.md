# ADR-0008 — `@packio/dieline` geometry model v2: edges with roles, pieces, a style registry

**Status:** Accepted (2026-09-27) · F4 Part A

## Context

The BoxStudio engine described a face as a convex polygon of points plus the indices of its
fold edges. That was enough for three rectangular styles and nothing else Packio sells: pillow
boxes and rounded tucks need arcs, windows and hang holes need holes, crash-lock bottoms need
glue areas, tear strips need perforations, lid-and-base boxes are two blanks, and the factory
needs to know which line is a cut, a crease or a half-cut. The convex inset used for safe
zones folded over itself on any concave face. Three `switch` cases in one file could not grow
into the Locopack catalogue (F4 Part B) and the drawing service (packio-api B4.1) needs the same
geometry the customer designed on.

## Decision

- **An edge is the unit of meaning.** `Edge = line | arc | bezier`, each with a `role`
  (`cut`, `crease`, `perforation`, `half_cut`, `glue_area`, `bleed`). The role is the export
  layer and the die's instruction; a curve stays a curve (true SVG arcs, DXF `ARC`), and is
  flattened only for offsetting and meshing, to ≤ 0.2 mm.
- **A face is a closed contour with holes and marks**, may be non-convex, and has a stable `id`
  (artwork anchors to it) and a label **key** (words live in `FACE_LABELS`, Thai and English).
  Two faces sharing a fold both list it with identical end points; `dielineLines()` de-duplicates.
  This keeps generators simple — draw each face whole — and lets `checkDieline()` prove a blank is
  closed, cuttable and foldable.
- **A dieline is pieces.** A telescope box is a lid blank and a base blank; each piece has its
  own bounds, and the layout places them side by side.
- **Styles are data plus two functions.** One file per style implements `BoxStyleDef`
  (`params` with legacy keys, `defaults`, `presets`, `materials`, `validate`, `build`,
  `faces3d`, `legacy.patternKeys`) and joins a registry; aliases (`rte`, legacy drawing names)
  resolve through one table. Shared constructions (a four-panel tube with closures, a cross
  tray) keep style files short.
- **Caliper compensation is the engine's.** Customers give inside sizes; a `MaterialSpec`
  (caliper from the catalogue, optional flute make-up allowances) decides every score. The
  rules and all rule-of-thumb constants are in `constants.ts` with their source.
- **Folding is maths, not rendering.** Hinges are found from shared creases; `foldDieline()`
  returns a 4×4 transform per face for any progress between flat and closed, so the WebGL
  preview, tests (closed box = L × W × H ± allowances) and the drawing service agree.
- **Exports are pure functions** returning strings or bytes: SVG, R12 DXF, and a hand-written
  PDF 1.6 writer (spot-colour separations with overprint in optional-content layers, TrimBox /
  BleedBox, optional JPEG tiles) — no DOM, no PDF library.
- **Clipper2 for offsetting**, isolated in `offset.ts`; the style registry never imports it, so a
  storefront page that draws a box does not download it.

## Consequences

- A major version (1.0.0). The app moved in the same change; packio-api consumes 1.x.
- New styles cost one file and zero test code: the quality gate iterates the registry
  (every style × preset × reference material: closed loops, no overlaps, dimensions, validation,
  SVG/DXF snapshots, closed fold).
- BoxStudio-era designs still open: `migrateSpec` maps the spec and `remapV1Point` moves each
  element to the same place on the same face of the new layout (the v1 builders are frozen in
  `legacy/v1.ts` for exactly that).
- Compensation values marked ⚠ in `constants.ts` need prepress confirmation before launch.
