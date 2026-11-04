/**
 * Loyalty P1 (API-CHANGES-P1): the earn checklist and the packaging profile, kept in memory.
 *
 * The fixture is the review case the owner asked for: one task held (DEC-5), three done, the rest todo. The
 * list is derived the way the API derives it (`./loyalty-fixtures.ts`) — sorted for display, one `recommended`
 * todo, the remaining points capped by what is left of the 12-month activity cap — so the screen never re-sorts.
 */

import type { LoyaltyTaskCode, PackagingProfile } from "@/lib/api/requests/store-loyalty";

import { mockRequest } from "../route";
import { buildLoyaltyTasks, REVIEW_TASK_STATES, type TaskState } from "./loyalty-fixtures";

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
