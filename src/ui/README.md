# `src/ui` — the Packio design system

Everything visual that more than one screen uses: tokens, the Tailwind v4 theme, fonts, icons,
components and the theme switch. Zones compose `src/ui`; they never restyle a primitive locally
(`docs/prompts/design-system.md` §1.8). Extending the system means editing a file in here.

```
tokens/      OKLCH primitives → semantic tiers → generated/tokens.css   (ADR-0003)
fonts/       Noto Sans Thai, Anuphan, JetBrains Mono, self-hosted       (ADR-0001)
theme/       pk_theme cookie, server stamp, provider, toggle
icons/       curated Lucide registry reached by name
components/  Radix + CVA primitives                                     (ADR-0002)
lib/         cn(), useReturnFocus()
styles/      element defaults, focus ring, skip link, reduced motion
docs/        Storybook pages: principles, tokens, voice & tone
test/        expectNoA11yViolations()
```

Entry points: `@/ui` for components and icons; `@/ui/tokens`, `@/ui/fonts` and `@/ui/theme`
separately, because build scripts and root layouts import those rather than screens.

## Rules that hold here

- **No component may import from `src/features/**` or `src/app/**`.** `StatusBadge` takes a
  `StatusMeta`, so even status presentation flows in, not out.
- **No hard-coded copy.** Anything a user reads is a prop; strings come from `src/i18n`. That is
  why `Spinner`'s label is required rather than defaulted, and why `Dialog` takes `closeLabel`.
- **No palette step in a component.** Name a semantic token (`bg-primary`, `text-muted`,
  `border-border`) so every variant follows the theme and is covered by the contrast gate.
  Tailwind's own palette does not resolve — the generated `@theme` clears it.
- **No `opacity-*` on text.** Opacity compounds onto the subtree and cannot be undone by a
  child, so it defeats the contrast gate silently. Use size, weight, or `muted` / `subtle`.
- **Status colour, label and icon come from `src/domain/status`**, never a local map.

## Adding a component

1. Build it in `components/`, behaviour from `radix-ui`, variants through CVA, colour from
   semantic tokens. Required props for anything a11y needs (an accessible name, an `alt`).
2. Colocate `Name.test.tsx`: the keyboard map, the ARIA wiring, and `expectNoA11yViolations`.
3. Colocate `Name.stories.tsx` showing the situations it exists for, not a prop matrix.
4. Export it from `components/index.ts`.

`design-system.md` §3 lists the full intended set. F0.2 built the foundation plus what the
designer and customer shell use today; the rest — DataTable, Combobox, DatePicker, PhoneInput,
AddressForm, FileDropzone, Timeline, PriceSummary, ProofViewer, charts, the partner shop-floor
components — is built when F1–F5 first needs it, so nothing is designed against a guess.

## Commands

`pnpm tokens` regenerate the CSS · `pnpm tokens:check` fail if it is stale · `pnpm contrast`
print the contrast table · `pnpm storybook` · `pnpm test`
