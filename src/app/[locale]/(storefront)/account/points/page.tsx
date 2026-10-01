import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getPoints, getPointsEntries } from "@/features/customer/account/api.server";
import { TierProgress } from "@/features/customer/account/TierProgress";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { POINTS_STATUS } from "@/domain/status";
import { Link } from "@/i18n/navigation";
import { Callout } from "@/ui/components/Callout";
import { Stat } from "@/ui/components/Stat";

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
  const [t, tHome, format, points, entries] = await Promise.all([
    getTranslations("account.points"),
    getTranslations("account.home"),
    getFormat(),
    getPoints(),
    getPointsEntries(50),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-1">{t("intro", { value: format.thb(points.pointValue) })}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={t("available")}
          value={format.number(points.availablePoints)}
          hint={format.thb(points.availableValue)}
        />
        <Stat label={t("pending")} value={format.number(points.pendingPoints)} hint={t("pendingHint")} />
        <Stat
          label={t("tier")}
          value={tHome(`tiers.${points.tier}`)}
          hint={t("tierHint", { multiplier: points.multiplier, spend: format.thb(points.spend12m) })}
        />
      </div>
      <TierProgress points={points} className="text-sm" />
      {points.expiringSoon.map((lot) => (
        <Callout key={lot.expiresAt} tone="warning">
          {t("expiring", { points: format.number(lot.points), date: format.date(lot.expiresAt) })}
        </Callout>
      ))}
      <section aria-labelledby="points-history">
        <h2 id="points-history" className="text-lg font-semibold">
          {t("history")}
        </h2>
        <div className="border-border mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">{t("history")}</caption>
            <thead className="bg-bg-subtle text-muted text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 text-start font-medium">
                  {t("when")}
                </th>
                <th scope="col" className="px-4 py-2 text-start font-medium">
                  {t("what")}
                </th>
                <th scope="col" className="px-4 py-2 text-end font-medium">
                  {t("points")}
                </th>
                <th scope="col" className="px-4 py-2 text-start font-medium">
                  {t("status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-border border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{format.date(entry.createdAt)}</td>
                  <td className="px-4 py-2">
                    {t(`types.${entry.entryType}`)}
                    {entry.orderCode && entry.orderId ? (
                      <Link
                        href={`/account/orders/${entry.orderId}`}
                        className="text-primary block font-mono text-xs underline-offset-4 hover:underline"
                      >
                        {entry.orderCode}
                      </Link>
                    ) : entry.orderCode ? (
                      <span className="text-muted block font-mono text-xs">{entry.orderCode}</span>
                    ) : null}
                    {entry.reason ? <span className="text-muted block text-xs">{entry.reason}</span> : null}
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {t(entry.points > 0 ? "gain" : "loss", { points: format.number(entry.points) })}
                  </td>
                  <td className="px-4 py-2">
                    <StatusChip map={POINTS_STATUS} value={entry.status} />
                    {entry.expiresAt && entry.status === "available" ? (
                      <span className="text-muted block text-xs">
                        {t("expiresAt", { date: format.date(entry.expiresAt) })}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
