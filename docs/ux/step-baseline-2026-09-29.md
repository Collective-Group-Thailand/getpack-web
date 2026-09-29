# Step baseline — Packio, 2026-09-29 (U5.0 output, U5.1 input)

> What the step counters (`pnpm e2e:journeys`, `e2e/journeys/`) measured on `main` after U-F2, against
> the MSW mocks, counted by `step-counting.md`. These are the **shortest paths that exist today**;
> a moderated round measures what people actually do, which is usually more. Regenerate with
> `pnpm e2e:journeys` — the reporter writes `test-results/journeys/step-counts.md`.

## Result

**8 of 12 journeys are over budget, 3 are within it, and 1 cannot be walked yet.** Two of the
three "within budget" results are within it only because of how today's product falls short
(see the notes), so U5.1 should treat them as open too.

| Task | Journey | Walked | Count | Budget | Δ | Verdict |
|---|---|---|---|---|---|---|
| T1 | discovery → price | partial | 7 | ≤ 4 steps | +3 | **over budget** |
| T2 | studio | partial | 8 | ≤ 6 steps | +2 | **over budget** |
| T3 | checks | partial | 2 unexplained | 0 unexplained warnings | +2 | **over budget** |
| T4 | order from the studio | partial | 6 | ≤ 5 steps | +1 | **over budget** |
| T5 | sample | partial | 3 | ≤ 4 steps | −1 | within budget — *not the task (note 1)* |
| T6 | target price | pending | — | lever found unaided | — | **pending** (U2.3 / U2.F1) |
| T7 | tracking | partial | 2 | ≤ 2 steps | 0 | within budget — *from the LIFF home, not the notification (note 2)* |
| T8 | reorder | measured | 3 | ≤ 3 steps | 0 | within budget |
| T9 | claim | partial | 7 | ≤ 5 steps | +2 | **over budget** |
| T10 | documents | partial | 4 | ≤ 2 steps | +2 | **over budget** |
| T11 | partner job | partial | 7 taps | ≤ 4 taps | +3 | **over budget** |
| T12 | dieline | partial | 5 | ≤ 3 steps | +2 | **over budget** |

## Journeys over budget → U5.1

Each line is the walk, `s:` a screen and `d:` a decision (`t:` a tap), then what would bring it
inside the budget and which deliverable owns it.

| Task | Walk today | Where the extra steps come from | Owner |
|---|---|---|---|
| **T1** 7 / 4 | s:products menu → s:category → s:mailer box → s:configurator → d:unit → d:size → d:quantity | four screens to reach the configurator; the unit starts in mm for a task given in cm; no weight input at all | U-F3 quick-start strip (home → configurator pre-filled), U5.1 default unit from locale/last choice, U2.F1 weight |
| **T2** 8 / 6 | d:focus top → d:open uploads → d:upload → d:open box → d:focus front → d:open uploads → d:place again → s:3D | placing one logo on two faces means leaving and re-entering two tools | U4.4 (place on several faces) |
| **T3** 2 / 0 | s:checks → d:select → d:fix | neither check (small text, low resolution) offers a fix or a help link | U4.5 one-click fixes, U5.2 help deep links |
| **T4** 6 / 5 | s:configurator (from the design) → d:add to cart → s:cart → s:checkout → s:confirm → s:payment | the cart is a stop of its own between the studio and checkout | U4.6 order from the studio, U5.1 "buy now" straight to checkout |
| **T9** 7 / 5 | s:claim form → d:type → d:description → d:resolution → d:product photo → d:carton photo → s:submitted | a carton photo is required even for a print defect; resolution has no default | U5.1 with the API's claim-form rules (carton photo only where transit is plausible, default resolution) |
| **T10** 4 / 2 | s:completed orders → s:order → d:ask for the link → s:tax invoice | no documents list; the order has to be found first; the signed link is a second click | U5.1 documents in the account and in the order row; one-click download |
| **T11** 7 / 4 taps | t:jobs waiting → t:job → t:accept → t:confirm → t:start prep → t:finish prep → t:start printing | accept needs a confirm; steps run strictly in order, so prep is two taps before printing; the photo can only be taken on finishing | U2.F7 / U5.1 partner floor (accept-and-start, photo on start) |
| **T12** 5 / 3 | s:designer setup → d:size → s:designer → s:export menu → d:dieline PDF | a dieline is only reachable through the designer; the PDF has no Safe layer | U3.B5 / U5.4 free dieline download with named layers |

## Notes

1. **T5** walks the D-072 physical mockup add-on inside the configurator, because a sample of the
   customer's own design before a run does not exist yet (U2.4 / U2.F3). It is within budget
   because it is a checkbox on a full order — not because the sample journey is good.
2. **T7** counts from Packio's LINE (LIFF) home, the closest LINE can land today: in-app and LINE
   notifications carry no link to the order (contract `notifications.unread-and-link`). From the
   notification itself the task is not possible yet; with the deep link it would be 1 step.
3. **T8** is the only journey measured with no gap.
4. **Required fields.** Each journey's required fields today are its allow-list in
   `e2e/journeys/budgets.ts`; a new one is reported from now on and fails at U5.8.
5. **Funnel events.** Every walk asserts the events its funnel expects (`docs/ux/funnels.md`); all
   were seen.
