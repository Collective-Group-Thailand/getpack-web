import type { BonusLot, DataRefresh, SurveyInstance } from "@/features/shared/loyalty-p2/types";

import type { LoyaltyTasks } from "./loyalty-types";

/** The nudges `/account` can show above the orders, one at a time. */
export type AccountBanner = "data_confirmation" | "survey" | "earn" | "winback";

/**
 * The order they win in (design decision, P2 integration): the yearly data confirmation, a survey that is due, the
 * earn checklist ("รับแต้มเพิ่ม"), then win-back. The reorder bonus is not an `/account` banner: it is shown where the
 * reorder happens (replenishment, the cart line, the order page).
 */
export const ACCOUNT_BANNER_PRIORITY: readonly AccountBanner[] = ["data_confirmation", "survey", "earn", "winback"];

export interface AccountBannerInput {
  refresh: Pick<DataRefresh, "due" | "lastConfirmedAt"> | null;
  survey: Pick<SurveyInstance, "status"> | null;
  tasks: Pick<LoyaltyTasks, "remainingPoints"> | null;
  bonusLots: readonly Pick<BonusLot, "reason">[];
}

/** Each banner's own rule for showing at all — the same as its component's. */
const SHOWS: Record<AccountBanner, (input: AccountBannerInput) => boolean> = {
  // Only when due again after an earlier confirmation: the first one is a checklist task (D-490).
  data_confirmation: ({ refresh }) => Boolean(refresh?.due && refresh.lastConfirmedAt),
  // `store.surveys.next` offers an open instance only; showing it marks it seen, so a waiting one is not rendered.
  survey: ({ survey }) => survey !== null && survey.status === "open",
  // Hidden when nothing is left to earn (all done, or the 12-month activity cap used up).
  earn: ({ tasks }) => (tasks?.remainingPoints ?? 0) > 0,
  winback: ({ bonusLots }) => bonusLots.some((lot) => lot.reason === "winback"),
};

/**
 * At most one banner on `/account`: the first, in priority order, that has something to say. The others wait for a
 * later visit — none of them is lost by waiting (a survey stays open until it expires, the checklist and a win-back
 * lot until used or expired, the data confirmation until done).
 */
export function accountBannerOf(input: AccountBannerInput): AccountBanner | null {
  return ACCOUNT_BANNER_PRIORITY.find((banner) => SHOWS[banner](input)) ?? null;
}
