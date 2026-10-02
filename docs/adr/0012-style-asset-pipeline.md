# ADR-0012 — Style asset pipeline and the thickness model

**Status:** Accepted (2026-10-02) · U3.3

## Context

The style library (U3.4–U3.5) needs, for every structural variant, a 2D and a 3D thumbnail, the
dieline as SVG and words for it; the virtual fold test needs a 3D model that knows the board's
thickness. ADR-0010 put the WebGL preview in the app, folded by the engine with zero-thickness
faces. Thumbnails had been drawn by Playwright from the SVG (`pnpm style:thumbnails`, docs only).

Questions:

1. **Where the thickness lives** — in the app's renderer, or in the engine.
2. **How thumbnails are rendered** — a headless browser with WebGL, or the engine.
3. **Where the files live** — committed, published, or uploaded.

## Decision

- **Thickness is the engine's** (`src/model/thickness.ts`, `foldModel`): every face becomes a slab
  of the caliper. Walls sit centred on their crease plane; faces that close onto a plane lie
  inward of it and stack inward in fold order (lid over dust flaps, tuck behind its panel); a
  face folded through 180° stacks toward the box interior whichever way its print faces; a flap
  wrapping a wall one caliper out is centred; walls glued back to back sit each on its own side;
  rigid board adds its paper wrap. With panels scored at inside + t this gives outer = inside +
  2t on a closed axis by construction. The app's `Preview3D` draws the same slabs (printed
  surface with the artwork, board surface and cut edges in the board colour); three.js stays lazy.
- **Outer size is recipe data** (`outerSize`, default nominal + 2t per axis): an open axis, a
  tray's height + t, a mailer's wrapping front + 3t. The virtual fold test holds the model to it
  at the smallest, a typical and the largest valid size on two calipers per category (± 1 mm),
  with a collision check for faces passing through each other; D-182's basis conversion can read
  the same numbers.
- **Thumbnails are rendered by the engine's own rasteriser** (`src/render/`): z-buffered,
  flat-shaded triangles with our own three-light "Packio studio" preset on neutral kraft or white
  board, and the flat dieline with cuts, dashed creases and glue areas — supersampled 2×, PNG
  encoded by the script. No browser, no GPU: the same bytes on every run, so reproducibility is a
  CI check (`pnpm styles:render:check`), and packio-api's drawing service can run it in Node
  (U3.B5) instead of a headless GL worker.
- **Files**: `pnpm styles:render` writes `packages/dieline/generated/<style>/<variant>/` (dieline
  SVG, 2D, 3D kraft, 3D white) and `generated/manifest.json` (variant key and axes, generated
  names and review state, processes, recipe hash, preset, values, each asset's sha256). **Only the
  manifest is committed**; the images are build output (at wave 2, ≈ 900 variants × 4 files would
  put tens of megabytes of PNG in git), rendered before publishing and shipped in the package's
  `files`, as ADR-0007 publishes fixtures.
- **Names are generated, never published unreviewed**: `describeVariant` composes Thai and English
  from the recipe name, axis phrases and module labels — construction words only; a test forbids
  claims. Each stays `pending` until Marketing (wording) and Prepress (terms) approve it into
  `recipes/names.reviewed.json` (D-212).

## Consequences

- The fold gate found a real defect: on the smallest sleeves the legacy glue-flap table gives a
  flap wider than the panel it is glued inside; a manufacturing rule now excludes those sizes
  (`mfg.glue_flap_too_wide`), and one preset that breaks it is recorded for prepress.
- Thumbnails are plain by design — flat shading, no artwork, no scenes. Product photography and
  mockup scenes are U4's (studio), never third-party assets.
- The pillow box keeps F4's flat-panel approximation (curved panels deferred); its outer size is
  the approximation's, within the gate's tolerance on paperboard.
- `pnpm style:thumbnails` (Playwright, docs contact sheet) stays for `docs/design-tool/styles/`.
