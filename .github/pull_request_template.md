## What and why

<!-- The deliverable (e.g. U5.3), the decisions it implements (D-###), and what changed for whom. -->

## Design QA (U5.7 §4)

- [ ] One primary action per view; secondary actions look secondary.
- [ ] Every state is designed: loading (a skeleton shaped like the content), empty (with its next action), error (with a way on), offline, permission-denied.
- [ ] Tokens only — no hard-coded colours, spacing or durations; motion respects `prefers-reduced-motion`.
- [ ] Thai copy reviewed against `docs/ui/voice-and-tone.md`; every string in `th` and `en`; jargon matches `docs/ui/glossary.md`.
- [ ] Accessibility: keyboard path works, focus visible, axe clean in the e2e run, names on icon-only controls.
- [ ] Step budget unchanged, or `docs/ux/competitive-scorecard.md` and `e2e/journeys/budgets.ts` updated together (`pnpm e2e:journeys`).
- [ ] Storybook story for every new `src/ui` component state; visual review done.
- [ ] Money and dates come from the API (`formatTHB`, Bangkok time); no arithmetic on money.

## Checks

- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`
- [ ] `pnpm e2e` (and `pnpm e2e:journeys` when a journey is touched)
- [ ] `docs/PROGRESS.md` updated; any missing endpoint in `docs/contract-requests.md` with a `// CONTRACT-REQUEST` mock
