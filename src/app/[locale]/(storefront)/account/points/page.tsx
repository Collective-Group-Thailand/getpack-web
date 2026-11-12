import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { getLoyaltyTasks, getPoints, getPointsEntries } from "@/features/customer/account/api.server";
import { EarnChecklist } from "@/features/customer/account/EarnChecklist";
import { PortalTable } from "@/features/customer/account/PortalTable";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getSupportChannels } from "@/features/customer/catalog/api.server";
import { clientEnv } from "@/lib/env";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { POINTS_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";
import { Button } from "@/ui/components/Button";
import { Icon } from "@/ui/icons";
import { multiplierParts } from "@/features/shared/loyalty-p2/multipliers";
import { EmptyState } from "@/ui/components/EmptyState";
import { TierPerks } from "@/features/customer/rewards/TierPerks";
import { getLoyaltySurfaces } from "@/features/customer/loyalty/surfaces.server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.points");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Points: balance, pending, what expires soon, the tier and how far the next one is, and history
 * (F3 3.4, D-130–D-134). Thresholds are D-134 settings the API sends, never hard-coded here.
 */
export default async function Page() {
  await requireCustomer();
  const [t, tHome, tReferral, tLifecycle, tRewards, format, points, entries, tasks, support] = await Promise.all([
    getTranslations("account.points"),
    getTranslations("account.home"),
    getTranslations("account.referral"),
    getTranslations("account.lifecycle"),
    getTranslations("account.rewards"),
    getFormat(),
    getPoints(),
    getPointsEntries(50),
    getLoyaltyTasks(),
    getSupportChannels().catch(() => null),
  ]);
  // Loyalty P4 (D-509, D-510): the balance and the history always stay; the gated parts follow the surfaces.
  const surfaces = await getLoyaltySurfaces();
  // The same order as the floating LINE button: the build's id, else staff's (GLOBAL-RULES §5).
  // Loyalty P2: bonus lots (win-back) and, per entry, the bonus reason and the order's multipliers.
  const { bonusLots } = points;
  const bonusLot = [...bonusLots].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0] ?? null;
  const typeLabel = (entry: (typeof entries)[number]) => {
    const { bonusReason } = entry;
    if (entry.entryType === "earn_bonus" && bonusReason) return t(`bonusReasons.${bonusReason}`);
    return t.has(`types.${entry.entryType}`) ? t(`types.${entry.entryType}`) : t("types.other");
  };
  const multiplierLine = (entry: (typeof entries)[number]) =>
    multiplierParts(entry.multipliers)
      .map(({ part, value }) => tLifecycle(`multipliers.${part}`, { value }))
      .join(" · ");
  const lineOaId = clientEnv.NEXT_PUBLIC_LINE_OA_ID?.trim() || support?.lineOaId?.trim() || null;

  return (
    <div>
      <AccountHeader
        title={t("title")}
        lede={t("intro", { value: format.thb(points.pointValue) })}
        actions={
          <>
            <Button asChild variant="secondary" iconStart="users">
              <Link href="/account/referral">{tReferral("title")}</Link>
            </Button>
            {/* Loyalty P3: the page's one primary — the reward catalogue (P4: only while redeeming is open). */}
            {surfaces.redeem ? (
              <Button asChild iconStart="gift">
                <Link href="/account/points/redeem">{tRewards("cta")}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <SummaryCards
        className="mt-6"
        columns={3}
        items={[
          {
            key: "available",
            label: t("available"),
            value: format.number(points.availablePoints),
            hint: bonusLot ? (
              <>
                {tHome("pointsValue", { amount: format.thb(points.availableValue) })}
                <span className="border-primary-subtle-fg/15 mt-2.5 flex items-center gap-1.5 border-t pt-2.5">
                  <Icon name="gift" size={14} aria-hidden="true" />
                  {tLifecycle("lotHint", {
                    points: format.number(bonusLot.points),
                    date: format.date(bonusLot.expiresAt),
                  })}
                </span>
              </>
            ) : (
              tHome("pointsValue", { amount: format.thb(points.availableValue) })
            ),
            icon: "star",
            highlight: true,
          },
          {
            key: "pending",
            label: t("pending"),
            value: format.number(points.pendingPoints),
            hint: t("pendingHint"),
            icon: "clock",
          },
          {
            key: "tier",
            label: t("tier"),
            value: tHome(`tiers.${points.tier}`),
            hint: t("tierHint", { multiplier: points.multiplier, spend: format.thb(points.spend12m) }),
            icon: "gift",
          },
        ]}
      />
      {/* Loyalty P1: the earn checklist between the figures and the tier (PLAN §3); hidden when the read fails. */}
      {tasks && surfaces.checklist ? <EarnChecklist className="mt-4" initial={tasks} lineOaId={lineOaId} /> : null}
      {surfaces.tierPerks ? <TierPerks className="mt-4" points={points} loyalty={points} /> : null}
      {points.expiringSoon.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {points.expiringSoon.map((lot) => (
            <Callout key={lot.expiresAt} tone="warning">
              {t("expiring", { points: format.number(lot.points), date: format.date(lot.expiresAt) })}
            </Callout>
          ))}
        </div>
      ) : null}
      <section aria-labelledby="points-history" className="mt-10">
        <h2 id="points-history" className="text-lg font-semibold">
          {t("history")}
        </h2>
        {entries.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon="star"
            title={t("emptyHistory")}
            description={t("pendingHint")}
            action={
              <Button asChild variant="secondary">
                <Link href="/products">{tHome("browse")}</Link>
              </Button>
            }
          />
        ) : (
          <PortalTable
            className="mt-4"
            caption={t("history")}
            columns={[
              { key: "what", label: t("what"), className: "md:w-[44%]" },
              { key: "when", label: t("when"), className: "md:whitespace-nowrap" },
              { key: "status", label: t("status") },
              { key: "points", label: t("points"), numeric: true, className: "md:whitespace-nowrap" },
            ]}
            rows={entries.map((entry) => ({
              id: entry.id,
              phoneSubtitle: entry.orderCode ? <span className="tabular-nums">{entry.orderCode}</span> : null,
              cells: {
                what: (
                  <span className="block min-w-0">
                    <span className="block font-semibold">{typeLabel(entry)}</span>
                    {multiplierLine(entry) ? (
                      <span className="text-muted block text-xs font-normal">{multiplierLine(entry)}</span>
                    ) : null}
                    {entry.orderCode && entry.orderId ? (
                      <Link
                        href={`/account/orders/${entry.orderId}`}
                        className="text-primary block text-xs font-normal tabular-nums underline-offset-4 hover:underline"
                      >
                        {entry.orderCode}
                      </Link>
                    ) : entry.orderCode ? (
                      <span className="text-muted hidden text-xs font-normal tabular-nums md:block">
                        {entry.orderCode}
                      </span>
                    ) : null}
                    {entry.reason ? <span className="text-muted block text-xs font-normal">{entry.reason}</span> : null}
                  </span>
                ),
                when: format.date(entry.createdAt),
                status: (
                  <span className="block">
                    <StatusChip map={POINTS_STATUS} value={entry.status} />
                    {entry.expiresAt && entry.status === "available" ? (
                      <span className="text-muted block text-xs">
                        {t("expiresAt", { date: format.date(entry.expiresAt) })}
                      </span>
                    ) : null}
                  </span>
                ),
                points: (
                  <span className="font-semibold">
                    {t(entry.points > 0 ? "gain" : "loss", { points: format.number(entry.points) })}
                  </span>
                ),
              },
            }))}
          />
        )}
      </section>
    </div>
  );
}
