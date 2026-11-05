/**
 * Loyalty P1: the earn checklist (`store.loyalty.tasks`) and the packaging profile
 * (`store.loyalty.getPackagingProfile` / `updatePackagingProfile`), kept in memory.
 *
 * The fixture is the review case the owner asked for: one task held (DEC-5), three done, the rest todo. The
 * list is derived the way the API derives it (`./loyalty-fixtures.ts`) — sorted for display, one `recommended`
 * todo, the remaining points capped by what is left of the 12-month activity cap — so the screen never re-sorts.
 */

import { http, HttpResponse } from "msw";

import type {
  LoyaltyTaskCode,
  PackagingProfile,
  PackagingProfileInput,
} from "@/features/customer/account/loyalty-types";

import { problem } from "../support";
import { customerOf } from "./customers";
import { buildLoyaltyTasks, REVIEW_TASK_STATES, type TaskState } from "./loyalty-fixtures";
import { withCompanyClaims } from "./loyalty-p4";

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

const unauthenticated = () => problem(401, "auth.unauthenticated", "ไม่พบเซสชัน กรุณาเข้าสู่ระบบ");

/** `PutPackagingProfileDto`'s rules (the API's pipe): one volume, ≥ 1 category and region, months 1–12, purpose. */
function invalidProfile(body: Partial<PackagingProfileInput> | null) {
  const errors: { path: string; code: string; message: string }[] = [];
  if (!body?.monthlyBoxVolume) errors.push({ path: "monthlyBoxVolume", code: "isEnum", message: "required" });
  if (!body?.productCategories?.length)
    errors.push({ path: "productCategories", code: "arrayMinSize", message: "≥ 1" });
  if (!body?.shipToRegions?.length) errors.push({ path: "shipToRegions", code: "arrayMinSize", message: "≥ 1" });
  if ((body?.peakMonths ?? []).some((month) => month < 1 || month > 12))
    errors.push({ path: "peakMonths", code: "max", message: "1–12" });
  if (body?.purposeAccepted !== true) errors.push({ path: "purposeAccepted", code: "equals", message: "must be true" });
  return errors.length ? problem(422, "validation.failed", "ข้อมูลไม่ถูกต้อง", errors) : null;
}

export const loyaltyHandlers = [
  // store.loyalty.tasks
  http.get("*/v1/store/loyalty/tasks", ({ request }) =>
    customerOf(request)
      ? // Loyalty P4 (D-508): a second member of a verified company sees the company's one-offs as claimed.
        HttpResponse.json(withCompanyClaims(buildLoyaltyTasks(states), customerOf(request)))
      : unauthenticated(),
  ),
  // store.loyalty.getPackagingProfile: null fields until first saved, never 404
  http.get("*/v1/store/loyalty/packaging-profile", ({ request }) =>
    customerOf(request) ? HttpResponse.json(profile) : unauthenticated(),
  ),
  // store.loyalty.updatePackagingProfile: the first complete save earns `earn_packaging_profile` once
  http.put("*/v1/store/loyalty/packaging-profile", async ({ request }) => {
    if (!customerOf(request)) return unauthenticated();
    const body = (await request.json().catch(() => null)) as PackagingProfileInput | null;
    const refused = invalidProfile(body);
    if (refused || !body) return refused ?? unauthenticated();
    const now = new Date().toISOString();
    profile = { ...body, completedAt: profile.completedAt ?? now, updatedAt: now };
    if (states.packaging_profile?.status !== "done") states.packaging_profile = { status: "done", doneAt: now };
    return HttpResponse.json(profile);
  }),
];
