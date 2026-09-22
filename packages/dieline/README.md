# `@packio/dieline`

The box geometry engine behind Packio's configurator, online designer and the print-ready
files the factories receive. It is deliberately **framework-free**: no React, no DOM, no
Next.js — so the same code runs in the browser, in a Node service and in tests.

```ts
import { buildDieline, dielineSegments, dielineToSvg } from "@packio/dieline";

const dieline = buildDieline("rsc", { length: 250, width: 180, height: 120 });
dieline.width; // 890 mm flat sheet
dielineToSvg(dieline, 3); // true-size SVG with separate CUT and CREASE layers
```

All lengths are millimetres and every dieline is anchored at the origin, so `width` and
`height` are the flat sheet size.

| Export                          | What it does                                                    |
| ------------------------------- | --------------------------------------------------------------- |
| `buildDieline(style, dims)`     | Flat layout for `rsc`, `tuck-end` or `tray` from internal L/W/H |
| `dielineSegments(dieline)`      | Edge list with shared fold edges de-duplicated                  |
| `dielineToSvg(dieline, margin)` | True-size SVG, `CUT` and `CREASE` in separate groups            |
| `faceCentroid(face)`            | Bounding-box centre, for placing panel labels                   |
| `insetConvex(points, mm)`       | Convex polygon inset, used for safe zones                       |
| `flat(points)`                  | `[[x, y], ...]` to the flat array Konva wants                   |
| `PX_PER_MM`                     | 96 dpi expressed per millimetre                                 |

Face `name` values are Thai today, inherited from the app this engine was extracted from.
They become i18n keys in F4 Part A; do not render them as final copy in new code.

See `docs/adr/0007-dieline-package.md` for ownership, versioning and publishing.
