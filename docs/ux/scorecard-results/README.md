# Scorecard results

One file per round of [`../competitive-scorecard.md`](../competitive-scorecard.md), named
`<YYYY-MM-DD>-<competitor|packio>.md` after the first session's date. Start from
[`_template.md`](_template.md) and follow [`../moderator-guide.md`](../moderator-guide.md).

- **Baseline** — the competitor round (U5.0). Recorded once, then compared against every Packio round.
- **Release gate** — the Packio round before launch (U5.8). Only journeys that pass launch.
- **Quarterly** — a Packio round every quarter after launch, against the same baseline.

What goes here: numbers, verbatim quotes, participant **codes**, links to recordings by id.
What never goes here: names, phone numbers, faces, recordings, screenshots of the competitor's
site. Those stay in the study's restricted storage (`../consent-pdpa.md` §5–6).

The automated step counts between rounds are not results of a round — they are produced by
`pnpm e2e:journeys` and summarised in `../step-baseline-*.md` and `../step-gate-*.md`.

## Before the release-gate round (U5.8)

| Needed | Where it stands (2026-10-06) |
|---|---|
| 8–10 participants from the §1 segments | Marketing recruits (D-217) — open |
| Moderator and note-taker | D-217 — moderator open |
| Competitor baseline round | not run yet; the release gate compares with it |
| Participant accounts and seeded orders | mock UAT dataset P01–P10 (`../uat-round-data.md`, `pnpm dev:uat`); on the UAT backend `api.uat-scorecard-seed` — open |
| T11 account role | task card says "floor operator"; only owner / planner may accept a job — Partner Manager to decide |
| Automated gate | blocking in CI; 12 / 12 walked, 4 under recorded exceptions (`../step-gate-2026-10-06.md`) |

The round's own file (`<date>-packio.md`) is written from `_template.md` only once it has run.
