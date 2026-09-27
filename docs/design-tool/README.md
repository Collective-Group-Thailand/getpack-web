# Design tool

Packio's online box designer and the geometry engine under it (`@packio/dieline`).

| Document | For | What it covers |
|---|---|---|
| [architecture.md](architecture.md) | engineers | Engine → designer → zones; units and frames; the document; persistence; live checks; face focus; exports; performance |
| [style-authoring.md](style-authoring.md) | engineers adding a style | The rules, a worked example (a table tent, verified against the engine's tests), the test matrix, fixtures, thumbnails, changesets |
| [style-mapping.md](style-mapping.md) | prepress, product, engineers | Every legacy Locopack pattern → Packio style, the legacy size variables, constraints, what is not drawn and why, assumptions awaiting prepress |
| [print-pdf-spec.md](print-pdf-spec.md) | factories | The print file a factory receives: page boxes, die layers and spot colours, artwork, text, codes |
| [styles/](styles/) | everyone | A thumbnail per style (`pnpm style:thumbnails`) and the contact sheet |

Decisions: [ADR-0007](../adr/0007-dieline-package.md) engine ownership and publishing ·
[ADR-0008](../adr/0008-dieline-geometry-model.md) geometry model ·
[ADR-0009](../adr/0009-print-pdf-in-the-browser.md) print file ·
[ADR-0010](../adr/0010-designer-3d-preview.md) 3D preview.

Quality gates: the engine's style × preset × material matrix and SVG/DXF/pattern fixtures
(`pnpm --filter @packio/dieline test`), the designer's unit and component tests (`pnpm test`),
e2e flows including axe over every designer panel (`pnpm e2e`), the editor's visual baselines
(`pnpm build-storybook && pnpm e2e:visual`), and the designer route's Lighthouse budget
(`pnpm lhci designer`).
