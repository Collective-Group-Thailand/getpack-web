---
"@getpack/dieline": major
---

Engine v2 — breaking. Faces are closed contours of line, arc and Bézier edges, each with a
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
