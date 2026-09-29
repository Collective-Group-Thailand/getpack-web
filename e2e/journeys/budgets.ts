/**
 * The step budgets of `docs/ux/competitive-scorecard.md` §2, as data the step counters read.
 *
 * The scorecard is the source; this file is its machine-readable copy, and
 * `budgets.test.ts` fails when the two disagree — so a budget changes in the scorecard first,
 * where the people who own it can see it, and here in the same change.
 *
 * `requiredFields` is the other half of scorecard §4 ("fail CI when … a required field is added
 * without a scorecard update"): every visible required field a walk meets, by its accessible
 * name. A field that is not listed is reported as new, and becomes a failure with the budgets
 * at U5.8 (`STEP_BUDGETS=enforce`).
 */

export type JourneyId = "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "T9" | "T10" | "T11" | "T12";

/** How a task is judged (`docs/ux/step-counting.md` "Task-specific units"). */
export type Budget =
  | { unit: "steps"; max: number }
  | { unit: "taps"; max: number }
  | { unit: "unexplained-warnings"; max: 0 }
  | { unit: "lever-found" };

export interface JourneyBudget {
  id: JourneyId;
  journey: string;
  budget: Budget;
  /** Where counting starts — the task card's start state (`docs/ux/task-cards.md` Part B). */
  start: string;
  requiredFields: readonly string[];
}

export const JOURNEYS: Record<JourneyId, JourneyBudget> = {
  T1: {
    id: "T1",
    journey: "discovery → price",
    budget: { unit: "steps", max: 4 },
    start: "home page, signed out",
    requiredFields: [],
  },
  T2: {
    id: "T2",
    journey: "studio",
    budget: { unit: "steps", max: 6 },
    start: "a new design of the T1 box open in the studio",
    requiredFields: [],
  },
  T3: {
    id: "T3",
    journey: "checks",
    budget: { unit: "unexplained-warnings", max: 0 },
    start: "a design with seeded issues open in the studio",
    requiredFields: [],
  },
  T4: {
    id: "T4",
    journey: "order",
    budget: { unit: "steps", max: 5 },
    start: "the design open in the studio, signed in",
    requiredFields: [],
  },
  T5: {
    id: "T5",
    journey: "sample",
    budget: { unit: "steps", max: 4 },
    start: "product page of the T1 box",
    requiredFields: [],
  },
  T6: {
    id: "T6",
    journey: "target price",
    budget: { unit: "lever-found" },
    start: "configurator for the T1 box at 500 pcs",
    requiredFields: [],
  },
  T7: {
    id: "T7",
    journey: "tracking",
    budget: { unit: "steps", max: 2 },
    start: "the LINE notification for an order in production",
    requiredFields: [],
  },
  T8: {
    id: "T8",
    journey: "reorder",
    budget: { unit: "steps", max: 3 },
    start: "the order list, signed in, with a delivered order",
    requiredFields: [],
  },
  T9: {
    id: "T9",
    journey: "claim",
    budget: { unit: "steps", max: 5 },
    start: "the order list, signed in, with a delivered order",
    requiredFields: [],
  },
  T10: {
    id: "T10",
    journey: "documents",
    budget: { unit: "steps", max: 2 },
    start: "the order list, signed in, with an invoiced order",
    requiredFields: [],
  },
  T11: {
    id: "T11",
    journey: "partner job",
    budget: { unit: "taps", max: 4 },
    start: "partner zone on a phone, signed in, one job waiting",
    requiredFields: [],
  },
  T12: {
    id: "T12",
    journey: "dieline",
    budget: { unit: "steps", max: 3 },
    start: "home page, signed out",
    requiredFields: [],
  },
};

/** The number a walk is compared with, or `null` when the task is not judged by a count. */
export function budgetMax(budget: Budget): number | null {
  return budget.unit === "lever-found" ? null : budget.max;
}
