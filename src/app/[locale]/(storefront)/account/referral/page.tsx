import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { accountRequests } from "@/features/customer/account/api.server";
import { CopyButton } from "@/features/customer/account/CopyButton";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { REFERRAL_STATUS } from "@/domain/status";
import { publicOrigin } from "@/lib/seo";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.referral");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The customer's referral code and the friends it brought (F3 3.4, D-136). */
export default async function Page() {
  await requireCustomer();
  const [t, format, origin, referral] = await Promise.all([
    getTranslations("account.referral"),
    getFormat(),
    publicOrigin(),
    (await accountRequests()).call("GET /v1/store/me/referral"),
  ]);
  const link = `${origin}/referral/${encodeURIComponent(referral.code)}`;

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
        <p className="text-muted text-sm break-all">{link}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={referral.code} label={t("copyCode")} />
          <CopyButton value={link} label={t("shareLink")} share={{ title: t("shareTitle") }} />
        </div>
        <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-sm">
          <li>{referral.refereeReward}</li>
          <li>{referral.referrerReward}</li>
          <li>{t("limit", { limit: referral.monthlyLimit, used: referral.rewardedThisMonth })}</li>
        </ul>
      </section>
      <section aria-labelledby="referral-friends">
        <h2 id="referral-friends" className="text-lg font-semibold">
          {t("friends")}
        </h2>
        {referral.referrals.length === 0 ? (
          <EmptyState className="mt-4" icon="users" title={t("noFriends")} description={t("noFriendsBody")} />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {referral.referrals.map((friend) => (
              <li
                key={friend.id}
                className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{friend.refereeName}</p>
                  <p className="text-muted text-xs">{t("joined", { date: format.date(friend.joinedAt) })}</p>
                </div>
                <div className="flex items-center gap-2">
                  {friend.rewardPoints ? (
                    <span className="text-sm tabular-nums">{t("reward", { points: friend.rewardPoints })}</span>
                  ) : null}
                  <StatusChip map={REFERRAL_STATUS} value={friend.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
