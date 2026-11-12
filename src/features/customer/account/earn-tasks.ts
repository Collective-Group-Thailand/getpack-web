import { isClaimedByCompany } from "@/features/shared/loyalty-p4/types";

import type { LoyaltyTask, LoyaltyTaskCode, LoyaltyTasks } from "./loyalty-types";

import { studioHref } from "../studio/paths";

/**
 * Where each earn task is done (loyalty P1). The API sends codes only (API-CHANGES-P1); the routes are the web's.
 * Where no dedicated page exists yet, the task goes to the closest one (listed in WEB-P1-NOTES.md):
 * - `profile_completed` → `/account/addresses` (ข้อมูลบัญชี; there is no profile-edit page yet);
 * - `phone_verified` and the identity links → the linked sign-in methods on `/account/notifications`;
 * - `brand_kit` → `/business/assets` (the company's brand assets; a customer without a company is sent on to `/business`).
 */
export const TASK_ROUTES: Record<Exclude<LoyaltyTaskCode, "line_oa_friend">, string> = {
  signup: "/account",
  line_link: "/account/notifications#linked-accounts",
  google_link: "/account/notifications#linked-accounts",
  apple_link: "/account/notifications#linked-accounts",
  phone_verified: "/account/notifications#linked-accounts",
  profile_completed: "/account/addresses",
  tax_profile: "/account/addresses#book-tax",
  address: "/account/addresses#book-addresses",
  brand_kit: "/business/assets",
  first_design: studioHref(),
  team_invite: "/business/members",
  packaging_profile: "/account/packaging-profile",
  // Loyalty P2: the yearly data confirmation, the showcase consent, and the sample page for a first paid sample.
  data_refresh: "/account/confirm-data",
  showcase_consent: "/account/showcase",
  first_sample: "/samples",
};

export interface TaskLink {
  href: string;
  /** Leaves the site (LINE's add-friend page): a plain anchor in a new tab. */
  external: boolean;
}

/** The link for one task. `line_oa_friend` adds the OA as a friend when its id is known, else opens the chat help page. */
export function taskLink(code: LoyaltyTaskCode, lineOaId: string | null | undefined): TaskLink {
  if (code === "line_oa_friend") {
    return lineOaId
      ? { href: `https://line.me/R/ti/p/${encodeURIComponent(lineOaId)}`, external: true }
      : { href: "/help/chat", external: false };
  }
  return { href: TASK_ROUTES[code], external: false };
}

export interface ChecklistView {
  /** The one task for the "แนะนำถัดไป" block, or null. */
  recommended: LoyaltyTask | null;
  /** Every other task, in the API's order (todo and held first, done last) — never re-sorted here. */
  rows: LoyaltyTask[];
  done: number;
  total: number;
  /** The 12-month activity cap is used up (DEC-4): todo tasks still work but earn nothing. */
  capReached: boolean;
  allDone: boolean;
}

/** Splits the API's list for display. The order is the API's; the recommended task moves to the block above the list. */
export function checklistView(data: LoyaltyTasks): ChecklistView {
  const capReached = data.capRemainingPoints <= 0;
  const recommended = capReached
    ? null
    : (data.tasks.find((task) => task.recommended && task.status === "todo") ?? null);
  const done = data.tasks.filter((task) => task.status === "done").length;
  // Loyalty P4 (D-508): a task the customer's company already earned is shown, but it is not theirs to do — it is
  // not counted in "ทำแล้ว n จาก m".
  const total = data.tasks.filter((task) => !isClaimedByCompany(task)).length;
  return {
    recommended,
    rows: data.tasks.filter((task) => task !== recommended),
    done,
    total,
    capReached,
    allDone: total > 0 && done === total,
  };
}

/** The tasks that became done between two reads — what the "+40 แต้ม" toast announces. Held ones are not announced. */
export function newlyDone(before: LoyaltyTasks | undefined, after: LoyaltyTasks): LoyaltyTask[] {
  if (!before) return [];
  const was = new Map(before.tasks.map((task) => [task.code, task.status]));
  return after.tasks.filter((task) => task.status === "done" && was.has(task.code) && was.get(task.code) !== "done");
}
