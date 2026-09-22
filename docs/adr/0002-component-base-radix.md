# ADR-0002 — Component base: Radix primitives (unified `radix-ui`) + Tailwind v4 + CVA, no shadcn CLI copies

**Status:** Accepted (2026-09-21)

## Context
design-system.md §3 asks for a fully typed, themable library "built on Radix primitives / shadcn patterns" with a11y tests, used by all three zones of one app.

## Decision
- Behaviour comes from the unified **`radix-ui`** package (Dialog, Select, Popover, Tabs, Checkbox, RadioGroup, Switch, Slider, Tooltip, DropdownMenu, ContextMenu, HoverCard, Avatar, Separator, VisuallyHidden, Slot). Styling is written once in `src/ui` with Tailwind v4 utilities bound to semantic tokens; `class-variance-authority` handles variants and `tailwind-merge` handles overrides.
- We **do not** vendor shadcn component files into each app (the CLI copy model). Zones import `src/ui`; extending means editing `src/ui`, which keeps the visual language single-sourced (design-system.md §1.8).
- Tables: TanStack Table (headless) + TanStack Virtual. Command palette: `cmdk`. Toasts: `sonner`. Dates: `react-day-picker` with Buddhist-era formatters. Uploads: `react-dropzone`. Charts: Recharts wrapped with tokenised colours and a screen-reader data table fallback.
- Icons: Lucide, exposed through a **curated registry** (`ICONS`) so `src/domain` status metadata can reference icons by name while bundlers still tree-shake.

## Consequences
- Every component carries `aria-*` wiring via `<Field>` context (`useFieldProps`) so labels/hints/errors are announced without app code.
- A Radix major upgrade is a single package bump.
- Storybook (react-vite + addon-a11y) runs axe on each story in CI; visual regression is added per zone with Playwright.
