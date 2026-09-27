# Authoring a box style

A style is a `BoxStyleDef` in `packages/dieline/src/styles/`: its parameters, presets and
materials, a `build` that returns the flat `Dieline`, and a hinge map that folds it. The
registry (`styles/index.ts`) is the only list — the designer's setup dialog, the configurator,
the drawing service in packio-api and the tests all read it. The model is ADR-0008; this is the
how-to.

## Rules that are not optional

- **Millimetres, y down, origin top-left, printed side facing you.** `assemble` anchors the sheet
  at the origin for you.
- **Every edge has a role**: `cut`, `crease`, `perforation`, `half_cut`, `glue_area`, `bleed`. A
  fold between two faces is **one edge listed by both faces with the same end points** (direction
  does not matter); `dielineLines` then draws it once, and the fold finds it as a hinge.
- **Faces and pieces are named by label keys** from `labels.ts` (`FACE_LABELS`, `PIECE_LABELS`),
  never by words in the style. Add a key there, in Thai and English, if none fits.
- **Caliper is the style's job.** Inside sizes come in; add the make-up allowances from
  `allowancesOf(material)` (catalogue flute allowances win over caliper-derived ones) so the folded
  box is the size the customer typed. Never hard-code a board.
- **Validation speaks both languages** and names the parameter: `defineStyle` already checks the
  schema (min/max per parameter, `size.out_of_range`) and the material kind; `check` adds the
  style's own rules (a window must fit its panel, a tuck must fit its lid).
- **Legacy mapping**: `legacy.patternKeys` lists the Locopack patterns the style draws
  (`pid:<n>`, `mapping:<n>` or a drawing-service name); add catalogue aliases in `STYLE_ALIASES`.
  Update [style-mapping.md](style-mapping.md) in the same change.

## Worked example — a table tent

Two panels on one crease, standing as an inverted V. It shows a shared crease, a parameter that is
not a size, a hinge map that depends on a parameter, a placement that turns the model upright, and
a `closedSize` for a shape that is not a box.

```ts
// packages/dieline/src/styles/table-tent.ts
import { assemble, face, piece } from "../faces";
import { num } from "../params";
import { rectangle } from "../path";
import type { ParamValues } from "../types";
import { defineStyle, t } from "./_shared";

/** A table tent: two panels on one crease, standing as an inverted V. */
function make(v: ParamValues) {
  const L = num(v, "length", 150);
  const H = num(v, "height", 100);
  const back = face("back", "back", "panel", rectangle(0, 0, L, H, { bottom: "crease" }));
  const front = face("front", "front", "panel", rectangle(0, H, L, H, { top: "crease" }));
  return assemble("table-tent", [piece("blank", "blank", [back, front])]);
}

/** The apex's half-angle, radians. */
const half = (v: ParamValues) => ((num(v, "apex", 50) / 2) * Math.PI) / 180;

export const tableTent = defineStyle({
  id: "table-tent",
  category: "flat",
  materials: ["paperboard"],
  name: t("ป้ายตั้งโต๊ะ", "Table tent"),
  description: t("แผ่นพับครึ่งตั้งเป็นรูปตัว V คว่ำ", "A card folded in two, standing as an inverted V"),
  params: [
    { key: "length", kind: "length", group: "size", label: t("ความยาว", "Length"), min: 50, max: 400, step: 0.5, legacyKey: "l" },
    { key: "height", kind: "length", group: "size", label: t("ความสูงแต่ละด้าน", "Panel height"), min: 40, max: 300, step: 0.5, legacyKey: "h" },
    { key: "apex", kind: "angle", group: "construction", label: t("มุมยอด", "Apex angle"), min: 20, max: 90, step: 1 },
  ],
  defaults: { length: 150, height: 100, apex: 50 },
  presets: [
    { id: "menu", label: t("เมนู 150 × 100", "Menu 150 × 100"), values: { length: 150, height: 100 } },
    { id: "sign", label: t("ป้าย 210 × 150", "Sign 210 × 150"), values: { length: 210, height: 150 } },
  ],
  // Front stays put, the back folds away from the print; the pair is then turned by half the apex
  // so the tent stands symmetric on its two bottom edges.
  faces3d: (v) => ({
    roots: { blank: "front" },
    angles: { back: 180 - num(v, "apex", 50) },
    placement: { blank: { rotate: [-num(v, "apex", 50) / 2, 0, 0] } },
  }),
  closedSize: (v) => ({
    length: num(v, "length", 150),
    width: 2 * num(v, "height", 100) * Math.sin(half(v)),
    height: num(v, "height", 100) * Math.cos(half(v)),
  }),
  make,
});
```

What each part does:

1. **`make`** draws two faces with `rectangle(x, y, w, h, roles)`. The back's bottom edge and the
   front's top edge are the same segment with role `crease`: that is the hinge. `piece` groups
   faces that are cut from one blank; `assemble` lays pieces out left to right (a sleeve and its
   drawer are two pieces).
2. **Parameters** carry their unit by kind (`length` in mm, `angle` in degrees), the group the
   setup dialog shows them in, bilingual labels and limits. `legacyKey` maps a size to Locopack's
   `l`, `w`, `h`… field.
3. **Presets** are complete, valid starting sizes — the tests build every one with every material.
4. **`faces3d`** names each piece's root face (it stays put) and each face's closed fold angle
   (default 90°; here `180 − apex`). Folds always turn away from the printed side. `placement`
   turns, flips, stacks (`over`) or nests (`inside`) whole pieces after folding; a tray-like style
   whose root is its base sets `upright: "base"`.
5. **`closedSize`** tells the tests (and the designer's outside size) what the folded shape
   measures when it is not the inside L × W × H.

Then:

- **Register it**: import it in `styles/index.ts` and add it to `STYLES` (the order is the pickers'
  order within a category).
- **Run the matrix**: `pnpm --filter @packio/dieline test`. `styles.test.ts` builds every style ×
  preset × allowed reference material and asserts: closed cut loops (≤ 0.01 mm), free edges cut,
  no overlapping faces, no dangling cuts (`checkDieline`); the sheet anchored at the origin; every
  face and piece labelled in both languages; `validate()` accepting the presets and rejecting sizes
  outside the range; the folded bounding box equal to the nominal size within the caliper
  allowance ± 1 mm.
- **Accept the fixtures**: `pnpm --filter @packio/dieline fixtures` writes
  `fixtures/svg/<style>--<preset>--<material>.svg` and `fixtures/dxf/…` for the new style; review
  them like code — they are what packio-api's golden comparison against the legacy drawings reads.
- **Thumbnails**: `pnpm style:thumbnails` redraws `docs/design-tool/styles/*.png` and the contact
  sheet for the mapping table.
- **Changeset**: a new style is a `minor` change of `@packio/dieline` (`pnpm changeset`).

A quick check while drafting, before the matrix (this is how the example above was verified):

```ts
import { expect, it } from "vitest";
import { checkDieline, foldedBounds, hingeMapOf, REFERENCE_MATERIALS, resolveValues } from "./index";
import { tableTent } from "./styles/table-tent";

it("the guide's table tent is a valid, foldable style", () => {
  const m = REFERENCE_MATERIALS["board-350"];
  for (const p of [...tableTent.presets, { id: "steep", values: { length: 150, height: 100, apex: 30 } }]) {
    const v = resolveValues(tableTent, p.values);
    const d = tableTent.build(v, m);
    expect(checkDieline(d)).toEqual([]);
    expect(tableTent.validate(p.values, m).filter((i) => i.severity === "error")).toEqual([]);
    const b = foldedBounds(d, hingeMapOf(tableTent, v, m)!);
    const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]].sort((a, c) => a - c);
    const c = tableTent.closedSize!(v, m);
    const want = [c.length, c.width, c.height].sort((a, q) => a - q);
    size.forEach((s, i) => expect(Math.abs(s - want[i]!)).toBeLessThan(1));
  }
  expect(tableTent.validate({ length: 600, height: 100 }, m).some((i) => i.code === "size.out_of_range")).toBe(true);
});
```

## Common mistakes

- **Two edges where there should be one** — a crease drawn twice with slightly different ends is
  two cuts to `checkDieline` and no hinge to the fold. Build shared edges from the same numbers.
- **Folding the wrong way** — the fold always goes away from the print; if a flap ends up inside
  out, the face order or the root is wrong, not the angle's sign.
- **Words in the geometry** — a face named "ฝาบน" in code. Use a label key.
- **A preset that is only nearly valid** — presets are test inputs; `validate` must return no
  errors for every material the style allows.
