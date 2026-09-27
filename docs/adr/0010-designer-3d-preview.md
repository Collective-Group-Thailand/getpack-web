# ADR-0010 — The designer's 3D preview is WebGL, folded by the engine, loaded on demand

**Status:** Accepted (2026-09-27) · F4 Part D

## Context

The configurator's 3D preview (F3 3.2) is six CSS-3D faces sized from L × W × H: cheap, no
artwork, and only for boxes. The designer has to show *this* dieline — any of the 30 styles,
flaps, locks, windows, two-piece boxes — folded, with the customer's artwork on it, and let
them watch it close. It must not slow the editor's first paint, nor break on the mid-range phone
design-system.md §1.6 names.

Options:

- **CSS 3D per face** — no triangulation of non-rectangular faces (hexagonal, pillow, rounded
  tucks), no lighting, no holes; one DOM node per face does not scale to 30+ faces.
- **three.js directly** — full control, but the scene graph, resize, DPR and disposal would be
  hand-written in an effect.
- **three.js through `@react-three/fiber`** — the same renderer, declared as React; resize, DPR
  clamping and on-demand rendering are the library's.

## Decision

- **WebGL through `@react-three/fiber` + `three`**, in `Preview3D.tsx`, loaded with
  `next/dynamic({ ssr: false })` only when the 3D tab opens. three.js is never in the editor's
  first chunk, let alone the storefront's.
- **Geometry comes from the engine, not the preview.** Each face is `facePolygons` →
  `triangulate` (Clipper2, holes kept), once per dieline; every frame applies the
  **`foldDieline`** transforms at the slider's progress. The preview, the upright-face rotation
  (`uprightAngles`), the tests and the drawing service fold identically. A flat piece (label,
  card) has no hinge map and is shown flat.
- **Printed side out.** The engine's flat has the printed side facing +Z and folds away from it;
  triangles are wound to face +Z, the outside is the artwork texture (`FrontSide`), the inside the
  board colour (`BackSide`).
- **The texture is the canvas itself**: the sheet drawn at up to 2048 px without guides
  (`renderDieline`, sheet laid flat by `withFlatWorld` when a face is focused), UVs = sheet
  millimetres ÷ sheet size, redrawn 700 ms after the last change while the tab is open.
- **Controls are buttons as well as drag** (rotate, tilt, reset — WCAG 2.5.7), a fold slider and
  "play" (eased 1.8 s; a jump under `prefers-reduced-motion`), three lighting presets in neutral
  whites and a warm tungsten (physics, not brand colour), and PNG export from the renderer
  (`preserveDrawingBuffer`). `frameloop="demand"`: nothing renders while nothing changes.

## Consequences

- The designer route gains three.js (~150 KB gzip) *only* after the 3D tab opens; the Lighthouse
  designer budget measures the editor without it.
- `@react-three/fiber` adds three.js elements to the global JSX namespace, which made
  `React.ElementType`'s union reject children; `Stat` narrows its polymorphic `as` (the one place
  that relied on the bare union).
- WebGL unavailable (old devices, some VMs): the canvas stays empty with its accessible name; the
  2D sheet remains the authority. A static fallback image is a follow-up if analytics show it
  matters.
- The configurator keeps its CSS preview (ADR not changed): there the budget is 150 KB and there is
  no artwork yet.
