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
`pnpm e2e:journeys` and summarised in `../step-baseline-*.md`.
