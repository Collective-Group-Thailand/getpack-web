# Design tool — architecture

How the online box designer is put together: the geometry engine, the editor, where designs are
kept, and the files it makes. Decisions are in ADR-0007 (engine ownership), ADR-0008 (geometry
model), ADR-0009 (print file), ADR-0010 (3D preview), ADR-0011 (composable style recipes) and ADR-0012 (asset pipeline, thickness).

```
@packio/dieline  (packages/dieline — framework-free, browser + Node, published for packio-api)
  recipes/*       30 StyleRecipe JSON files (ADR-0011) + params.json / sets.json; parseRecipe,
                  buildFromRecipe, styleFromRecipe → the BoxStyleDef registry (styles/index.ts)
  modules/*       body · closure · feature · pieceSet modules: params, constraints, processes,
                  hinges, geometry (16 more declared `planned` for U3.4)
  expr            the recipes' expression language (sizes, rules, closed sizes; no eval)
  solver          explain (every rule broken, codes + numbers), validRanges, sizeRanges
  rules/*         material classes and their manufacturing rules; machine envelope check
  model/*         thickness model (foldModel), collision check, inflated pouch surface
  render/*        software rasteriser: 2D and 3D thumbnails (ADR-0012)
  construct/*     tube, closures, tray: the builders modules draw with
  faces, lines    Face / Piece / Dieline; shared edges; dielineLines (each line once, with role)
  offset          Clipper2: safe zone, bleed outline, piece outline, triangulation (isolated)
  fold            foldDieline → 4×4 matrix per face at a fold progress; foldedBounds
  checks          checkDieline: closed loops, overlaps, dangling cuts
  export/*        SVG (true arcs), DXF R12, PDF 1.6 with spot layers
  migrate, compat BoxStudio (v1) specs → v2, artwork remapped face by face
        │
        ▼
src/features/designer  (shared by the customer and admin zones)
  document.ts     DesignSpec + DesignContent, schema v2; dielineOf, hingesOf, readDesign
  store/editor.ts zustand: content, history (100), selection, groups, locks, clipboard, focus, view
  store/status.ts fast canvas facts (face under pointer, rulers) kept out of the editor store
  lib/*           pure: geometry, snapping, align, codes (QR/EAN-13), shapes, colour, checks, upright
  components/
    Editor.tsx       the shell: top bar, left rail, canvas, right panel, status bar, dialogs
    DesignCanvas.tsx Konva: world group (rotated upright when a face is focused), per-face clips,
                     transformer, marquee, snapping guides, rulers, grid, print mode
    panels/*         box, templates, elements, text, uploads, brand, background, layers,
                     properties, arrange, checks
    Preview3D.tsx    WebGL (three / @react-three/fiber), loaded on demand; slabs of the caliper
                     from the engine's foldModel (printed surface + board edges)
    DesignViewer.tsx read-only SVG of a design (prepress, shared links)
  data/*          persistence (local / store / admin), IndexedDB drafts, API calls
  print.ts        the print PDF (ADR-0009)
        │
        ▼
Zones: src/features/customer/designer (price widget, order action, shared page)
       src/features/customer/studio (U4: /studio/[designId] — step bar, price dock, studio spec)
       src/features/admin/prepress/AdminDesigner.tsx (read-only or a staff copy)
```

## Units and frames

Everything is **millimetres** in a **y-down** sheet frame with the origin at the dieline's top-left,
the printed side facing the viewer. The canvas scales mm to CSS pixels (`PX_PER_MM` × zoom); the
3D frame is x = sheet x, y = −sheet y, z towards the viewer, and folds turn faces away from the
printed side. Artwork elements are stored in sheet mm and never in pixels, so a design survives
any zoom, device or export resolution.

## The document

`{ schemaVersion: 2, spec, content }` — the spec is the engine's (`styleId`, `values`, `material`)
plus the catalogue ids and names it was chosen with; the content is `elements` (text, image,
rect, circle, shape, code; each with position, rotation, scale, opacity, optional lock, group,
name and face clip) and the background pattern. Older documents are migrated on read
(`readDesign`), and a viewer shows "cannot display" rather than throwing on a document from a
newer build.

## Persistence

| Mode | Where | Saving |
|---|---|---|
| `local` | a guest's browser (localStorage) | on demand; imported to the account after sign-in |
| `store` | `store.designs` | autosave 2.5 s after the last change (0.4 s for a box change) under `If-Match`; in the studio a content-only change is a JSON Patch; 412 → conflict choice; IndexedDB draft meanwhile (also the offline queue, flushed on `online`); version history and restore |
| `admin` | `admin.design-documents` | a customer's document is read-only; staff edit their own copy |

## The studio (U4)

`/[locale]/studio/[designId]` is the same `Editor` with a frame (`EditorProps.chrome`): a step bar
under the header, a panel in place of the tool rail for the steps other than ③, and the price dock
(a right rail on wide screens, a bar on phones). The editor never unmounts between steps; the step
lives in `?step=`. For a signed-in design each version is saved with its **box** and the calculator
**spec** (D-275, `studio/spec.ts` → `BoxFields`), built from the product's configurator exactly as
the configurator would — so `store.studio.quote` prices the box on screen and refuses nothing as a
mismatch. A save that changes neither the box nor the title is a JSON Patch (`patchDocument`,
D-276); anything else is a PUT. The dock keys its query by the saved box + quantity (packio-api
caches by the same spec's `specHash`) and sends the shown `specHash` back as `previousSpecHash`, so
the API says why the price moved. A guest's dock prices the same configuration with
`store.quotes.calculate`.

## Checks, live

`lib/checks.ts` takes the elements' corners (text measured with Konva), the engine's safe zones,
fold segments, glue flaps and piece outlines (`lib/useIssues.ts`, computed once per box) and the
catalogue's artwork rules. It runs on every change and is pure, so it is unit-tested without a
browser.

## Face focus

Double-click a face (or pick it in the Box panel): the canvas zooms to it and turns it so it reads
as it will on the box. `uprightAngles` folds the dieline and compares each face's flat "up" with
world up (walls) or with "away from the viewer" (lids and bases), snapped to 90°. Only the world
group rotates; every capture (`withFlatWorld`) lays it flat again first.

## Exports

| Export | Made by | Contents |
|---|---|---|
| Print PDF | `print.ts` → `dielineToPdf` | 300 dpi artwork tiles + vector die on spot layers ([print-pdf-spec.md](print-pdf-spec.md)) |
| Dieline SVG / DXF / PDF | the engine | die lines only, layered by role |
| PNG | the canvas | the sheet with or without guides |
| 3D PNG | the WebGL renderer | the folded box as shown |

## Performance

Konva and the editor are one lazy chunk on `/design/*`; three.js loads only when the 3D tab opens
(ADR-0010); Clipper2 stays out of the storefront (the configurator uses the pure
`polygonInsideWithMargin`). The designer route has its own Lighthouse budget
(`lighthouse/designer.json`).
