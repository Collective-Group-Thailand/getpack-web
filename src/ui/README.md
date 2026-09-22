# `src/ui` — the Packio design system

Everything visual that more than one screen uses lives here: tokens, the Tailwind v4
theme, fonts, icons, charts, primitives and patterns. Zones compose `src/ui`; they never
restyle a primitive locally (`docs/prompts/design-system.md` §1.8).

Right now it holds only `brand/`, moved here in F0 Session 0.1. **F0 Session 0.2** fills
it in: tokens in TypeScript generating `src/ui/generated/tokens.css` with a contrast gate
(ADR-0003), self-hosted Thai-first fonts (ADR-0001), and the Radix + CVA component set
(ADR-0002), with Storybook. The rest of the component list in `design-system.md` §3 is
built when F1–F5 first need it — not up front.

Rules that already apply:

- No component here may import from `src/features/**` or `src/app/**`.
- No hard-coded copy: strings come from `src/i18n`.
- Status colour, label and icon come from `src/domain/status`, never from a local map.
