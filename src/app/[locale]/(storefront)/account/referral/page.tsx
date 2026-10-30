import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { getReferral, type Referral } from "@/features/customer/account/api.server";
import { CopyButton } from "@/features/customer/account/CopyButton";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { customerStatusLabel } from "@/features/customer/account/status-label";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { REFERRAL_STATUS, type ReferralStatus } from "@/domain/status";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

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
  const [t, tStatus, format, referral] = await Promise.all([
    getTranslations("account.referral"),
    getTranslations("status"),
    getFormat(),
    getReferral(),
  ]);
  const { rules } = referral;
  const counted = COUNTED.filter(([key]) => referral.referrals[key] > 0);

  return (
    <div>
      <AccountHeader title={t("title")} lede={t("intro")} />

      {/* Project B2: the code and how to share it beside the rules — the two halves of one offer. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="referral-code"
          className="bg-primary-subtle text-primary-subtle-fg rounded-card flex flex-col gap-4 p-5 sm:p-6"
        >
          <h2 id="referral-code" className="text-sm font-medium">
            {t("yourCode")}
          </h2>
          <p className="border-primary bg-surface text-fg rounded-control self-start border border-dashed px-4 py-2 text-3xl font-bold tracking-wider tabular-nums">
            {referral.code}
          </p>
          <p className="text-sm break-all">{referral.link}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={referral.code} label={t("copyCode")} />
            <CopyButton value={referral.link} label={t("shareLink")} share={{ title: t("shareTitle") }} />
          </div>
        </section>
        <section
          aria-labelledby="referral-rules"
          className="border-border bg-surface rounded-card flex flex-col gap-3 border p-5 sm:p-6"
        >
          <h2 id="referral-rules" className="text-lg font-semibold">
            {t("rules")}
          </h2>
          <ul className="flex flex-col gap-3 text-sm">
            {[
              {
                icon: "ticket" as const,
                text: t("ruleFriend", {
                  pct: format.percent(rules.refereeDiscountPct),
                  max: format.thb(rules.refereeDiscountMaxAmount),
                }),
              },
              {
                icon: "gift" as const,
                text: t("ruleReward", {
                  amount: format.thb(rules.referrerRewardAmount),
                  points: format.number(rules.referrerRewardPoints),
                }),
              },
              {
                icon: "calendar" as const,
                text: t("ruleCap", {
                  max: format.number(rules.maxRewardedPerMonth),
                  used: format.number(referral.rewardedThisMonth),
                }),
              },
            ].map((rule) => (
              <li key={rule.icon} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="border-border bg-surface-subtle text-muted grid size-8 shrink-0 place-items-center rounded-lg border"
                >
                  <Icon name={rule.icon} size={16} />
                </span>
                <span className="pt-1 text-pretty">{rule.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="referral-friends" className="mt-10">
        <h2 id="referral-friends" className="text-lg font-semibold">
          {t("friends")}
        </h2>
        {counted.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="users"
            title={t("noFriends")}
            description={t("noFriendsBody")}
            action={<CopyButton value={referral.link} label={t("shareLink")} share={{ title: t("shareTitle") }} />}
          />
        ) : (
          <SummaryCards
            className="mt-4"
            items={counted.map(([key, status]) => ({
              key,
              label: customerStatusLabel(tStatus, REFERRAL_STATUS, status),
              value: t("count", { count: referral.referrals[key] }),
              tone: status === "rejected_fraud" ? ("danger" as const) : ("neutral" as const),
              highlight: status === "rewarded",
            }))}
          />
        )}
        {referral.recent.length > 0 ? (
          <>
            <h3 className="text-muted mt-6 text-sm font-medium">{t("recent")}</h3>
            <PortalTable
              className="mt-3"
              caption={t("recent")}
              columns={[
                { key: "friend", label: t("friend"), className: "md:w-[40%]" },
                { key: "joined", label: t("joined"), className: "md:whitespace-nowrap" },
                { key: "status", label: t("status") },
                { key: "reward", label: t("reward"), numeric: true, className: "md:whitespace-nowrap" },
              ]}
              rows={referral.recent.map((friend) => ({
                id: friend.id,
                cells: {
                  friend: <span className="font-semibold">{friend.refereeName}</span>,
                  joined: format.date(friend.joinedAt),
                  status: <StatusChip map={REFERRAL_STATUS} value={friend.status} />,
                  reward:
                    friend.rewardPoints > 0 ? (
                      t("rewardPoints", { points: format.number(friend.rewardPoints) })
                    ) : (
                      <span className="text-muted">—</span>
                    ),
                },
              }))}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
