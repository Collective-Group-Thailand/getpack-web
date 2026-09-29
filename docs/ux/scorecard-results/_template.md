# Scorecard round — <competitor | Packio> — <YYYY-MM-DD>

> Copy of `_template.md`. Rules: `../moderator-guide.md`. Counting: `../step-counting.md`.
> Tasks and budgets: `../competitive-scorecard.md` §2. Delete this quote block when filled in.

## Round

| Field | Value |
|---|---|
| Product | <competitor name + URLs used / Packio UAT environment> |
| Build | <Packio commit or release tag · "n/a" for the competitor> |
| Dates | <first session> – <last session> |
| Moderator / note-taker | <names> |
| Method | moderated remote, think-aloud, Thai (scorecard §1) |
| Baseline compared with | <file of the competitor round · "this is the baseline"> |

### Seed data (Packio rounds)

| Used for | Id / value |
|---|---|
| Buyer personas (per participant) | |
| In-production order (T7) and its LINE notification | |
| Delivered order (T8–T10) and its tax invoice | |
| T3 design with seeded issues | |
| Partner job waiting (T11) | |

## Participants

| Code | Segment | Device (model, browser) | Assistive tech | Block order | Tasks run |
|---|---|---|---|---|---|
| P01 | | | | | |

## Per task, per participant

Completion **Y** / **P** / **N** / **NP** (not possible) · time in seconds · steps per
`step-counting.md` (T3: unexplained warnings; T6: lever found Y/N; T11: taps) · errors · SEQ 1–7.

| Task | Code | Completion | Time (s) | Steps | Errors | SEQ | Notes (verbatim, with timestamp) |
|---|---|---|---|---|---|---|---|
| T1 | P01 | | | | | | |

## Per task, aggregated

| Task | Budget | Completion % (Y) | Median time (s) | Median steps | Within budget? | Median SEQ | Baseline median time | Δ time vs baseline |
|---|---|---|---|---|---|---|---|---|
| T1 | ≤ 4 steps | | | | | | | |
| T2 | ≤ 6 steps | | | | | | | |
| T3 | 0 unexplained warnings | | | | | | | |
| T4 | ≤ 5 steps from studio | | | | | | | |
| T5 | ≤ 4 steps | | | | | | | |
| T6 | lever found unaided | | | | | | | |
| T7 | ≤ 2 steps from LINE notification | | | | | | | |
| T8 | ≤ 3 steps | | | | | | | |
| T9 | ≤ 5 steps | | | | | | | |
| T10 | ≤ 2 steps | | | | | | | |
| T11 | ≤ 4 taps, one hand | | | | | | | |
| T12 | ≤ 3 steps, named layers | | | | | | | |

## SUS

| Code | SUS | | Mean | Median |
|---|---|---|---|---|
| P01 | | | | |

## Gates (scorecard §3) — Packio rounds

| Measure | Gate | Result | Pass? |
|---|---|---|---|
| Completion rate, all tasks | ≥ 90 % | | |
| Median time T2, T5, T7, T9 vs baseline | ≥ 30 % faster | | |
| Steps | within budget for every task | | |
| SEQ | ≥ 6.0 median on every task | | |
| SUS | ≥ 80 | | |
| Mobile | no task > 20 % slower on Android than desktop | | |
| Accessibility | a screen-reader participant completes T1, T4, T7 | | |

## Top frustrations

| # | Task | Quote (verbatim) | Participants | Severity (blocker / major / minor) |
|---|---|---|---|---|
| 1 | | | | |

## Evidence and follow-up

| Finding | Recording id + timestamp | Fix ticket | Re-test result |
|---|---|---|---|
| | | | |

Journeys launched after this round: <list · Packio release-gate round only>
