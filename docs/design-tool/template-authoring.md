# Studio templates — authoring guide

getpack 3D Studio templates (U4.4, D-216, D-282) are **constraint layouts**: they say *where on
which face* each piece goes, never in millimetres, so one template re-flows onto any size of any
box style. The format is the web's (`layoutSchemaVersion` 1, `src/features/designer/templates/layout.ts`);
getpack-api stores it as given (`studio_templates.layout`) and serves it with
`store.studio.listTemplates`. The first set (21 templates: 7 use cases × 3 layouts) is in
`src/features/designer/templates/library.ts`.

Templates are **getpack's own** — never copied from another product, template site or brand. A
template is published only after **Marketing approves it** (maker-checker, D-282) in the back
office's studio templates (`admin.studioTemplates.*`).

## The layout

```jsonc
{
  "palette": { "primary": "#5b3a29", "accent": "#c8a165", "ink": "#2b1d14", "paper": "#f6efe6" },
  "fonts": { "heading": "Prompt", "body": "Sarabun" },          // studio fonts only (OFL, D-213)
  "background": { "colour": "paper" },                            // or { "pattern": { "kind": "dots", "size": 10, "colour": "accent", "on": "paper" } }
  "slots": [
    {
      "id": "headline", "role": "headline", "kind": "text",
      "face": "front",                                            // front | back | left | right | top | bottom | main
      "box": { "x": 0.06, "y": 0.34, "w": 0.88, "h": 0.16 },      // fractions of the face's safe area
      "text": { "th": "คั่วสดทุกสัปดาห์", "en": "Roasted fresh every week" },
      "colour": "primary", "font": "heading",
      "size": 0.7, "minPt": 10, "maxPt": 60                       // text: share of the box height, clamped
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `face` | The face's **role**, found on whatever dieline the customer has: `front` (the front panel, else the largest panel), `back`, `left`, `right`, `top` (the topmost lid), `bottom` (the base), `main` (the largest face — for labels, tags, cards). A slot whose face does not exist is left out. |
| `box` | Where in the face's **safe area** (inside the safe margin of the artwork rules), as fractions, in the face as it reads **upright** once folded — a slot on the top lid is turned with the lid. |
| `kind` | `text`, `rect` or `circle` (a logo slot is usually a `circle` or `rect` placeholder). |
| `role` | `logo` slots take the brand kit's logo; `headline`, `subhead`, `body`, `info`, `band`, `badge` take its colours and fonts by `colour` and `font`. |
| `colour` / `font` | **Roles**, not values: `primary`, `accent`, `ink`, `paper`; `heading`, `body`. "ใช้แบรนด์ของฉัน" swaps them for the company's kit. |
| `size`, `minPt`, `maxPt` | Text is as large as `size` × the box height allows, shrunk to fit the box's width, and kept between `minPt` and `maxPt` (6 pt is the floor; mind the `min_text_size` print rule). |
| `round` | Corner rounding of a shape, as a share of its shorter side. |
| `minFaceMm` | Leave the slot out on faces smaller than this (mm on the shorter side) — e.g. a logo on a narrow side. |

## Rules for a good template

1. **Design for the smallest box first.** Re-flow keeps proportions, so a headline that fits a
   70 × 40 mm front fits a 300 × 200 mm one; the reverse is not true. Check the template on the
   smallest preset of each style it names (`styleFamilies`).
2. **Keep text inside the safe area** — the layout already insets each face by the safe margin;
   do not use `box` values that reach 0 or 1 for text.
3. **Nothing important across a fold.** A slot belongs to one face; wrapping across a fold is the
   customer's explicit choice.
4. **Contrast.** Text colour on its background must read (WCAG-like 4.5:1 for small text is a good
   floor); the four palette roles are designed as pairs: `ink` on `paper`, `paper` on `primary`.
5. **Copy is a placeholder the customer edits** — short, true, no claims (no "best", "premium",
   "eco", "ดีที่สุด" …; the same rule as the style names).
6. **Thai first.** Every `text` has `th` and `en`; Thai lines are measured as Thai.

## Checking a template

`src/features/designer/templates/layout.test.ts` re-flows every template onto every core box style
at its first preset and fails when a piece lands off its face or text leaves its point range. Add a
template to `library.ts` and run `pnpm vitest run src/features/designer/templates`.
