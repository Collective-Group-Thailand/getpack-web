import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getReferral, type Referral } from "@/features/customer/account/api.server";
import { CopyButton } from "@/features/customer/account/CopyButton";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
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
 * The customer's referral code, its share link, the rules (D-136 settings, as the API sends them),
 * the monthly cap and how much of it is used, and the friends who used the code — by the masked
 * name the API gives — with how many used it by status (F3 3.4).
 */
export default async function Page() {
  await requireCustomer();
  const [t, format, referral] = await Promise.all([getTranslations("account.referral"), getFormat(), getReferral()]);
  const { rules } = referral;
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
      <section aria-labelledby="referral-rules" className="flex flex-col gap-2">
        <h2 id="referral-rules" className="text-lg font-semibold">
          {t("rules")}
        </h2>
        <ul className="text-muted flex list-disc flex-col gap-1 ps-5 text-sm">
          <li>
            {t("ruleFriend", {
              pct: format.percent(rules.refereeDiscountPct),
              max: format.thb(rules.refereeDiscountMaxAmount),
            })}
          </li>
          <li>
            {t("ruleReward", {
              amount: format.thb(rules.referrerRewardAmount),
              points: format.number(rules.referrerRewardPoints),
            })}
          </li>
          <li>
            {t("ruleCap", {
              max: format.number(rules.maxRewardedPerMonth),
              used: format.number(referral.rewardedThisMonth),
            })}
          </li>
        </ul>
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
        {referral.recent.length > 0 ? (
          <div className="border-border mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("recent")}</caption>
              <thead className="bg-bg-subtle text-muted text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("friend")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("joined")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("status")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end font-medium">
                    {t("reward")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {referral.recent.map((friend) => (
                  <tr key={friend.id} className="border-border border-t">
                    <td className="px-4 py-2">{friend.refereeName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{format.date(friend.joinedAt)}</td>
                    <td className="px-4 py-2">
                      <StatusChip map={REFERRAL_STATUS} value={friend.status} />
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums">
                      {friend.rewardPoints > 0
                        ? t("rewardPoints", { points: format.number(friend.rewardPoints) })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
