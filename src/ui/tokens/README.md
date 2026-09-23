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
