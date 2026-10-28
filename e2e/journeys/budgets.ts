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
 * at U5.8 (`STEP_BUDGETS=enforce`). The lists are the fields the walks met on 2026-09-29 (the U5.0
 * baseline); the checkout's contact fields arrive pre-filled from the account.
 *
 * `EXCEPTIONS` is scorecard §5: a journey a business decision or an API rule keeps over its budget,
 * capped at the count it has today. Enforced, a walk fails when it is over budget without one, above
 * its ceiling, or back within budget while its exception is still listed (so it gets removed).
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
    // The configurator marks its material "จำเป็น" since C4 (2026-10-28); it arrives chosen, so it adds no step.
    requiredFields: ["วัสดุ"],
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
    requiredFields: ["ชื่อผู้ติดต่อ", "อีเมล", "เบอร์มือถือ"],
  },
  T5: {
    id: "T5",
    journey: "sample",
    budget: { unit: "steps", max: 4 },
    start: "product page of the T1 box",
    // The configurator marks its material "จำเป็น" since C4 (2026-10-28); it arrives chosen, so it adds no step.
    requiredFields: ["วัสดุ"],
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
    requiredFields: ["ชื่อผู้ติดต่อ", "อีเมล", "เบอร์มือถือ"],
  },
  T9: {
    id: "T9",
    journey: "claim",
    budget: { unit: "steps", max: 5 },
    start: "the order list, signed in, with a delivered order",
    requiredFields: ["ปัญหาที่พบ", "รายละเอียด", "สิ่งที่ต้องการ"],
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
    requiredFields: ["รับเข้า", "รายละเอียด"],
  },
  T12: {
    id: "T12",
    journey: "dieline",
    budget: { unit: "steps", max: 3 },
    start: "home page, signed out",
    // The sign-in D-271 asks for on the way (step-counting rule 8).
    requiredFields: ["เบอร์มือถือ"],
  },
};

/** The number a walk is compared with, or `null` when the task is not judged by a count. */
export function budgetMax(budget: Budget): number | null {
  return budget.unit === "lever-found" ? null : budget.max;
}

/** A journey kept over its budget by a decision or an API rule, until it is reviewed (scorecard §5). */
export interface BudgetException {
  /** The count it may not go above: the count it had when the exception was recorded. */
  ceiling: number;
  /** Why the frontend cannot bring it within budget, by decision id or API rule. */
  cause: string;
  /** Who can change the cause. */
  owner: string;
}

export const EXCEPTIONS: Partial<Record<JourneyId, BudgetException>> = {
  T1: {
    ceiling: 5,
    cause:
      "Homepage v10 (Studio-first): the hero prices its three standard sizes, so a size of the customer's own is typed in the configurator — one more choice, then D-182's measurement basis",
    owner: "Product owner (homepage v10) · Pricing owner (D-182)",
  },
  T5: {
    ceiling: 6,
    cause:
      "D-182: the customer must choose the measurement basis before a price (no silent default); the product opens on its standard sizes, so a size of the customer's own is one more choice",
    owner: "Pricing owner (D-182)",
  },
  T9: {
    ceiling: 7,
    cause:
      "D-082: a carton photo is required with every claim (store.claims.getForm cartonPhotosMin); D-198: the customer chooses the remedy",
    owner: "CS Lead (D-082 per claim type) · getpack-api",
  },
  T11: {
    ceiling: 6,
    cause: "getpack-api: factory steps run strictly in order and a photo is taken only when a step finishes",
    owner: "Partner Manager · getpack-api",
  },
  T12: {
    ceiling: 7,
    cause:
      "D-203 / D-271: the free dieline needs a signed-in customer (2 steps); reaching a style from the home page takes 2 screens — a dieline entry without the library is open",
    owner: "Marketing (D-203) · getpack-web (dieline entry)",
  },
};

/** How a counted walk stands against its budget and its exception, if any. */
export type Judgement = "within" | "excepted" | "over" | "above-ceiling" | "stale-exception";

export function judge(id: JourneyId, counted: number | null): Judgement {
  const max = budgetMax(JOURNEYS[id].budget);
  const exception = EXCEPTIONS[id];
  if (max === null || counted === null) return "within";
  if (counted <= max) return exception ? "stale-exception" : "within";
  if (!exception) return "over";
  return counted <= exception.ceiling ? "excepted" : "above-ceiling";
}
