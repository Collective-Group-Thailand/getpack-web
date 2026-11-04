/**
 * Fixtures for the loyalty P1 checklist (API-CHANGES-P1), shared by the MSW handlers, Storybook and the tests.
 * No MSW import here, so a story can load it in the browser bundle.
 */

import type { LoyaltyTask, LoyaltyTaskCode, LoyaltyTasks } from "@/features/customer/account/loyalty-types";

/** `loyalty.activity_rewards` at ฿2.50 a point (PLAN §2.1). */
export const TASK_POINTS: Record<LoyaltyTaskCode, number> = {
  signup: 20,
  line_link: 8,
  google_link: 8,
  apple_link: 8,
  phone_verified: 8,
  profile_completed: 20,
  tax_profile: 40,
  address: 8,
  brand_kit: 20,
  first_design: 8,
  team_invite: 20,
  packaging_profile: 40,
  line_oa_friend: 8,
  // Loyalty P2 (D-490): ฿30, ฿100 and ฿50 at ฿2.50 a point.
  data_refresh: 12,
  showcase_consent: 40,
  first_sample: 20,
};

const ORDER = Object.keys(TASK_POINTS) as LoyaltyTaskCode[];

export interface TaskState {
  status: "todo" | "held" | "done";
  doneAt?: string;
}

/** The API's display rules: todo and held by points desc (ties in code order), done by `doneAt` desc. */
export function buildLoyaltyTasks(
  states: Partial<Record<LoyaltyTaskCode, TaskState>>,
  { capPoints = 600, activityEarned12m }: { capPoints?: number; activityEarned12m?: number } = {},
): LoyaltyTasks {
  const tasks: LoyaltyTask[] = ORDER.map((code) => {
    const state = states[code] ?? { status: "todo" as const };
    return {
      code,
      points: TASK_POINTS[code],
      status: state.status,
      doneAt: state.status === "done" ? (state.doneAt ?? null) : null,
      heldReason: state.status === "held" ? "duplicate_identity" : null,
      recommended: false,
      nextDueAt: null,
    };
  });
  const open = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => b.points - a.points || ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
  const done = tasks
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const earnedPoints = done.reduce((sum, task) => sum + task.points, 0);
  const capRemainingPoints = Math.max(0, capPoints - (activityEarned12m ?? earnedPoints));
  const todoPoints = open.filter((task) => task.status === "todo").reduce((sum, task) => sum + task.points, 0);
  const first = capRemainingPoints > 0 ? open.find((task) => task.status === "todo") : undefined;
  if (first) first.recommended = true;
  return {
    tasks: [...open, ...done],
    earnedPoints,
    remainingPoints: Math.min(todoPoints, capRemainingPoints),
    capPoints,
    capRemainingPoints,
    pointValue: "2.50",
  };
}

/** One held, three done (the owner's review case). */
export const REVIEW_TASK_STATES: Partial<Record<LoyaltyTaskCode, TaskState>> = {
  signup: { status: "done", doneAt: "2026-10-28T02:15:00.000Z" },
  line_link: { status: "done", doneAt: "2026-10-28T02:20:00.000Z" },
  phone_verified: { status: "done", doneAt: "2026-11-02T03:10:00.000Z" },
  address: { status: "held" },
};
