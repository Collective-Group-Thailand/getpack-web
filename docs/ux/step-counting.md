# Step counting — one rule for moderators and for the step counters

> Used by the moderated scorecard rounds (`competitive-scorecard.md` §1, "number of steps
> (screens + decisions)") **and** by the Playwright step counters in `e2e/journeys/`. If the two
> ever count the same walk differently, this file is wrong and gets fixed — not one of them.

## What is a step

A step is something the person has to **see or decide** to move the task forward. There are two
kinds, and every step is exactly one of them.

| Kind | Counts when | Examples |
|---|---|---|
| **Screen** | The task view is replaced: a new route, or a dialog, sheet, drawer or wizard step that takes over the task. | product page → configurator; "เพิ่มลงตะกร้า" opens the cart; the confirm dialog before paying |
| **Decision** | The person answers one question the task needs. | the size (L × W × H is **one** question), the quantity, the delivery address, "which problem is it?" |

Rules that settle the usual arguments:

1. **The start screen is free.** Counting begins at the place the task card says the person starts (the home page, a LINE notification, the order list). Reaching the start is not part of the task.
2. **A click that only opens the next screen is that screen**, not a screen plus a decision. Clicking "สั่งซ้ำ" and landing on the reorder page is 1.
3. **One question, one decision**, however many inputs it takes. Length, width and height are one decision; so is a date picker; so is choosing a unit *if the task makes the person choose it*. A field the person must fill that is not the answer to the task's question is its own decision — that is exactly the friction we want to see.
4. **Defaults the person accepts cost nothing.** If the right answer is pre-filled and they leave it, it is not a decision. If they have to check it to be sure, the moderator notes it as hesitation, not a step.
5. **Reading is not a step.** Scrolling, opening a tooltip or expanding a section to read it is not counted — unless the task cannot be finished without it, in which case the expand is a decision.
6. **Going back and trying again counts.** Steps are what the person actually did, not the shortest path. The automated counters walk the shortest path; the difference between the two is the finding.
7. **Errors are counted separately** (scorecard §1). A validation message that sends the person back is an error *and* the extra steps it causes.
8. **Signing in is a step only when the task triggers it.** A seeded task (T7–T10) starts signed in; a task that asks for sign-in half-way counts the sign-in sheet as one screen and the OTP as one decision.

## Task-specific units

| Task | Unit | Why |
|---|---|---|
| T3 | **unexplained warnings** (0 is the budget), plus steps for information | the task is "fix everything the system flags"; a flag with no explanation or no way to fix it is the failure, however many clicks it takes |
| T6 | **lever found unaided** (yes / no) plus steps | the question is whether a person finds a way to move the price, not how fast |
| T11 | **taps**, one hand, on a phone | a factory floor is a tap-by-tap place; every tap counts, navigation included |

## How the automated counters apply it

`e2e/journeys/fixture.ts` exposes one method per kind, so a walk reads like this file:

| Call | Counts | Meaning |
|---|---|---|
| `j.start(url)` | 0 | rule 1 |
| `j.screen(name, action, arrived)` | 1 | the action replaces the view; `arrived` is the assertion that it did |
| `j.decide(name, action)` | 1 | one question answered (rule 3) |
| `j.tap(name, action)` | 1 | T11 only |
| `j.pending(reason, deliverable)` | — | the journey cannot be walked yet; the deliverable that builds it is named |

Guards keep a walk honest:
- **Undeclared navigation fails the walk.** Between two calls the path may not change; a redirect or a second screen that nobody declared is exactly the step someone forgot to count.
- **New required fields are flagged.** Every visible required field on every screen is compared with the journey's allow-list in `e2e/journeys/budgets.ts`. A new one means the scorecard (and the budget) must be updated in the same change — scorecard §4.
- **Budgets come from the scorecard.** `budgets.ts` is checked against `competitive-scorecard.md` §2 by a unit test, so the two cannot drift.

Until U5.8 an over-budget journey or a new required field is **reported, not failed**
(`STEP_BUDGETS=enforce` turns both into failures; U5.8 sets it and makes the CI job blocking).
