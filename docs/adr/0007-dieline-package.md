# ADR-0007 — `@packio/dieline`: ownership and publishing

**Status:** Accepted (2026-09-22) · extracted in F0 Session 0.1, grown in F4 Part A

## Context

Box geometry — the flat layout, the cut and crease lines, the safe zones, the true-size
SVG — is needed in three places: the customer configurator and online designer in this
app, the drawing service in `packio-api` (B4.1), and the tests of both. In the BoxStudio
app it sat in `src/lib` next to Konva and React code, so it could not be used anywhere
else and nothing stopped a DOM call creeping in.

## Decision

The geometry engine is a **separate, framework-free package published from this
repository**, and this repository owns it (D-002).

- `packages/dieline` is the only workspace package. It imports nothing from `src/`, and
  has **no React, DOM, Konva or Next dependency** — `buildDieline`, `dielineSegments`,
  `dielineToSvg`, `faceCentroid`, `insetConvex`, `flat`, `PX_PER_MM` and the geometry types.
- Rendering stays in the app: Konva components, the canvas pattern tiles in
  `features/designer/patterns.ts`, PNG and PDF export all need a DOM and are not part of
  the engine.
- For workspace consumers `exports` points at TypeScript source and Next transpiles it;
  `publishConfig` swaps `main`, `types` and `exports` to `dist/` and targets **GitHub
  Packages**, so the published artifact is compiled JavaScript with declaration files.
- Releases go through **Changesets**: a change other repositories would notice ships with
  a changeset, and `pnpm changeset publish` runs after `pnpm build:packages`.
- The package carries its own Vitest suite. The unit tests written before the extraction
  moved with it and must stay green — they are the contract.

## Consequences

- `packio-api`'s drawing service consumes a versioned package instead of copying formulas,
  so a geometry fix reaches production in one place. A breaking geometry change is a major
  version and a coordinated bump, not a silent behaviour difference between quote and
  production file.
- Face `name` values are still Thai strings inherited from BoxStudio. They become i18n keys
  in F4 Part A; until then no new code should render them as final copy.
- `insetConvex` does not detect an inset larger than half the smallest span: it returns a
  mirrored polygon instead of `null`. The behaviour is pinned by a test so it cannot change
  silently, and F4 Part A decides whether to fix it.
