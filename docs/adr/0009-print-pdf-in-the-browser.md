# ADR-0009 — The designer's print file is made in the browser, on the engine's PDF writer

**Status:** Accepted (2026-09-27) · F4 Part C.6 · superseded for orders by [ADR-0013](0013-server-print-pdf-for-orders.md) (the browser file stays for the customer's own download)

## Context

"Submit for print" must hand the factory a file prepress can check (D-070): the die as vector
lines on their own spot-colour layers (`CutContour`, `Crease`), the artwork with 3 mm bleed,
fonts embedded or outlined, images at 300 dpi effective. It can be made in the browser or by the
API from the stored design document.

- **API rendering** needs a server-side renderer for the designer's scene (Konva shapes, text in
  Thai with shaping, patterns, images) — a second implementation of the canvas that would have to
  match the editor pixel for pixel, and a service packio-api does not have (B4.1 draws dielines,
  not artwork).
- **jsPDF in the browser** (what BoxStudio used) has no Separation colour spaces and no optional
  content groups, so the die cannot be a spot layer; its text support does not shape Thai.

## Decision

- The print file is made **client-side** from the canvas the customer sees: the stage switches to
  print mode (artwork clipped to the bleed outline from `bleedOutline`, white substrate, no guides),
  is captured at **300 dpi** in JPEG tiles of at most 4096 px a side (inside every supported
  browser's canvas limit, iOS Safari's ~16.7 MP included), and switches back.
- The tiles go under the engine's own vector die in **`dielineToPdf`**: a hand-written PDF 1.6
  writer in `@packio/dieline` with each die layer a Separation spot colour (`CutContour`, `Crease`,
  `Perforation`, `HalfCut`, `Glue`) with overprint, inside an optional-content layer of the same
  name, TrimBox = the dieline, BleedBox = + bleed. The bleed is the settings' value from the
  designer catalogue (`rules.bleedMm`), 3 mm by default.
- **Text is rasterised with the artwork** at the same resolution, so the file carries no font
  dependency ("outlined" in effect). The file is uploaded through `files/presign` and submitted as
  the order's artwork with the design's id (`store.artwork`, `designDocumentId`); preflight runs on
  it like on any upload.
- jsPDF is removed from the app.

## Consequences

- One rendering path: what the customer designed is what is printed; nothing to keep in sync.
- The die is exact vector geometry from the same engine packio-api's drawing service uses.
- Text below ~6 pt is only as crisp as 300 dpi allows. ⚠ Prepress to confirm 300 dpi is enough for
  small text, or ask for a higher `rules.minDpi` — the renderer takes the dpi as a parameter.
- Colour is RGB JPEG; the D-070 preflight warns on RGB rather than blocking, and the proof shows the
  result. A CMYK conversion would need an ICC-aware step server-side — recorded as a follow-up.
- Very large blanks produce many tiles and a large file; acceptable at packaging sizes
  (a 1 m × 0.6 m blank at 300 dpi is ~12 tiles).
