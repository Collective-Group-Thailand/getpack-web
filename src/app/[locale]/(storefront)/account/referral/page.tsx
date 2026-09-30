import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getReferral, type Referral } from "@/features/customer/account/api.server";
import { CopyButton } from "@/features/customer/account/CopyButton";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { REFERRAL_STATUS, type ReferralStatus } from "@/domain/status";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.referral");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** How the published counts name each status (`ReferralCountsDto` → `ReferralStatus`). */
const COUNTED: readonly [keyof Referral["referrals"], ReferralStatus][] = [
  ["pending", "pending"],
  ["underReview", "under_review"],
  ["qualified", "qualified"],
  ["rewarded", "rewarded"],
  ["rejected", "rejected_fraud"],
];

/**
 * The customer's referral code, its share link, and how many friends used it (F3 3.4, D-136).
 *
 * CONTRACT-GAP store.loyalty — `store.referral.get` gives counts by status only: not the rules in
 * words, the monthly cap and how much of it is used, or the (masked) friends themselves.
 */
export default async function Page() {
  await requireCustomer();
  const [t, referral] = await Promise.all([getTranslations("account.referral"), getReferral()]);
  const counted = COUNTED.filter(([key]) => referral.referrals[key] > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-1">{t("intro")}</p>
      </div>
      <section aria-labelledby="referral-code" className="border-border flex flex-col gap-3 rounded-2xl border p-5">
        <h2 id="referral-code" className="text-muted text-sm font-medium">
          {t("yourCode")}
        </h2>
        <p className="font-mono text-3xl font-bold tracking-wider">{referral.code}</p>
        <p className="text-muted text-sm break-all">{referral.link}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={referral.code} label={t("copyCode")} />
          <CopyButton value={referral.link} label={t("shareLink")} share={{ title: t("shareTitle") }} />
        </div>
      </section>
      <section aria-labelledby="referral-friends">
        <h2 id="referral-friends" className="text-lg font-semibold">
          {t("friends")}
        </h2>
        {counted.length === 0 ? (
          <EmptyState className="mt-4" icon="users" title={t("noFriends")} description={t("noFriendsBody")} />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {counted.map(([key, status]) => (
              <li
                key={key}
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <StatusChip map={REFERRAL_STATUS} value={status} />
                <span className="tabular-nums">{t("count", { count: referral.referrals[key] })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
