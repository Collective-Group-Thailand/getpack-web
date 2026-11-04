/**
 * Loyalty P1 (API-CHANGES-P1): the earn checklist and the packaging profile, kept in memory.
 *
 * The fixture is the review case the owner asked for: one task held (DEC-5), three done, the rest todo. The
 * list is derived the way the API derives it — sorted for display, one `recommended` todo, the remaining
 * points capped by what is left of the 12-month activity cap — so the screen never re-sorts.
 */

import type { LoyaltyTask, LoyaltyTaskCode, LoyaltyTasks, PackagingProfile } from "@/lib/api/requests/store-loyalty";

import { mockRequest } from "../route";

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

const states: Partial<Record<LoyaltyTaskCode, TaskState>> = { ...REVIEW_TASK_STATES };

const EMPTY_PROFILE: PackagingProfile = {
  monthlyBoxVolume: null,
  productCategories: null,
  shipToRegions: null,
  peakMonths: null,
  purposeAccepted: null,
  completedAt: null,
  updatedAt: null,
};

let profile: PackagingProfile = { ...EMPTY_PROFILE };

/** Back to the review case — for tests that save the form. */
export function resetLoyaltyMock() {
  for (const key of Object.keys(states) as LoyaltyTaskCode[]) delete states[key];
  Object.assign(states, REVIEW_TASK_STATES);
  profile = { ...EMPTY_PROFILE };
}

export const loyaltyHandlers = [
  // CONTRACT-REQUEST store.loyalty.tasks
  mockRequest("GET /v1/store/loyalty/tasks", () => buildLoyaltyTasks(states)),
  // CONTRACT-REQUEST store.loyalty.packaging-profile
  mockRequest("GET /v1/store/loyalty/packaging-profile", () => profile),
  // CONTRACT-REQUEST store.loyalty.packaging-profile
  mockRequest("PUT /v1/store/loyalty/packaging-profile", ({ body }) => {
    const now = new Date().toISOString();
    profile = { ...body, completedAt: profile.completedAt ?? now, updatedAt: now };
    if (states.packaging_profile?.status !== "done") states.packaging_profile = { status: "done", doneAt: now };
    return profile;
  }),
];
