# `src/ui/tokens` — design tokens (ADR-0003)

Three tiers, in dependency order. A component may only ever name the **semantic** tier.

| Tier      | File                             | Example                             | Who may use it                          |
| --------- | -------------------------------- | ----------------------------------- | --------------------------------------- |
| primitive | `primitives.ts`, `scale.ts`      | `brand-700`, `radius-lg`            | the semantic tier, and the generator    |
| semantic  | `semantic.ts`                    | `primary`, `muted`, `danger-subtle` | every component, via Tailwind utilities |
| component | the component's own CVA variants | `Button`'s `primary` variant        | that component only                     |

## How a colour reaches the screen

```
semantic.ts (OKLCH, per theme)
  → pnpm tokens → src/ui/generated/tokens.css
      @theme                       --color-primary: var(--sem-primary)   (Tailwind v4 utilities)
      :root                        --sem-primary: oklch(…)               light
      @media (prefers-color-scheme: dark) :root:not([data-theme])        the OS decides
      [data-theme="dark"|"hc"]                                           the user decided
  → <html data-theme> stamped server-side from the pk_theme cookie (src/ui/theme/server.ts)
```

Because `@theme` only maps `--color-<name>` to `var(--sem-<name>)`, `bg-primary` and
`text-muted` follow the theme at runtime: one stylesheet, three themes, no flash.

## Adding a semantic colour

1. Add the key to `BaseSlots` (or a tone) in `semantic.ts`. TypeScript then refuses to
   compile until **all three** themes define it.
2. Declare the pairs it may be used with in `scripts/check-contrast.ts` — text pairs at
   4.5:1, icons/borders/focus rings at 3:1. A key no pair mentions fails the gate, so a
   colour cannot slip in unmeasured.
3. `pnpm tokens && pnpm test`. The gate reports the exact ratio and the theme that failed.

## Naming

Keys read as the utility, the way `design-system.md` §2 writes them: `bg-primary`,
`text-muted`, `border-border`, `ring-focus-ring`. ADR-0003 called this tier `text` /
`text-muted`; here it is `fg` / `muted`, because `--color-text-muted` would generate
`text-text-muted`.

`subtle` is gated at 3:1, not 4.5:1: it is only for placeholders, disabled labels and
decorative meta text, which WCAG 1.4.3 exempts. Body and secondary text use `fg` and
`muted`.

## What is _not_ themed

`PRINT` (cut / fold / safe zone / bleed) and the `brand` palette's role as a print colour.
A cut line means the same thing in dark mode, and the same values go to Konva, the SVG
export and the print PDF, where CSS variables cannot reach.

## Brand

`brand` is a **placeholder** hue — the teal BoxStudio shipped — until the brand kit arrives.
See `docs/ui/brand.md`. Changing it is a change to `primitives.ts` plus `pnpm tokens`; the
gate then decides whether the new hue is legible at the steps the semantic tier uses.

## Prototype → repo mapping (styles redesign, `docs/design/styles-redesign/design-tokens.css`)

One token source: the prototype file is **not** imported and its `:root` variables are not emitted. Its values were
moved into `ART` in `primitives.ts` (light and dark) and flow through `semantic.ts` → `pnpm tokens`.

| Prototype                     | Repo semantic key                                                               | Light                               | Dark                                             |
| ----------------------------- | ------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| `--bg`                        | `bg` (`paper-50`)                                                               | #F6F5F1                             | #0F1412                                          |
| `--surface`                   | `surface`                                                                       | #FFFFFF                             | #161C19                                          |
| `--surface-2`                 | `bg-subtle` (`paper-100`)                                                       | #EFEEE9                             | #1D2521                                          |
| `--stage`                     | not adopted (see below)                                                         | –                                   | –                                                |
| `--fg`                        | `fg` (`ink-900`)                                                                | #16201B                             | #ECEFEC                                          |
| `--fg-2`                      | `muted` (`ink-600`)                                                             | #4A554F                             | #B5BEB8                                          |
| `--fg-3`                      | `subtle` (`ink-300`, light nudged 0.008 L for the 3:1 gate)                     | #7B847F (nudged)                    | #89938D is the prototype; repo keeps neutral-400 |
| `--line`                      | `border`                                                                        | #E3E1DA                             | #29322D                                          |
| `--line-2`                    | `border-strong` (repo neutral ramp, unchanged)                                  | –                                   | –                                                |
| `--brand`                     | `primary` (`primary-600`), `focus-ring`                                         | #17573F                             | #56BC91                                          |
| `--brand-hover`               | `primary-hover` (`primary-700`)                                                 | #0E4430                             | repo `brand-400` (see below)                     |
| `--brand-tint`                | `primary-subtle` (`primary-50`)                                                 | #E2EDE7                             | #17322A                                          |
| `--on-brand`                  | `primary-fg`                                                                    | white                               | repo `paper-50` (#0F1412, not #06120C)           |
| `--instant`, `--instant-tint` | `instant`, `instant-subtle`                                                     | already adopted (#8F530E / #F6EAD9) | #E7AA60 / #33271A                                |
| `--shadow`                    | not adopted: elevation is `scale.ts` (no button shadows)                        | –                                   | –                                                |
| `--r-sm/md/lg` 8/12/16        | not adopted: repo radius 10 control / 14 card / 16 panel (design-language test) | –                                   | –                                                |
| `--gutter`                    | not adopted: layout uses the repo container padding                             | –                                   | –                                                |
| `--f-display/body/mono`       | not adopted: Anuphan is the only UI face (ADR-0001, 180 KB budget); no IBM Plex | –                                   | –                                                |

Not adopted, and why: `--stage` (no equivalent role; `canvas` is the designer work area), `--line-2` / dark
`primary-hover` / dark `on-brand` / dark `subtle` (repo values already pass the gate and the prototype's would
need re-measuring on every pair), shadows, radii, gutter and fonts (rulings C4/C5). Hard-coded print/OG/SVG hexes
(`og-image.tsx`, `iso-box.ts`, home SVG) keep the old brand hex: they cannot read CSS variables.
