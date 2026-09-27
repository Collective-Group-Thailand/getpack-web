import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { accountRequests } from "@/features/customer/account/api.server";
import { requireCustomer } from "@/features/customer/auth/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { POINTS_STATUS } from "@/domain/status";
import { Callout } from "@/ui/components/Callout";
import { Meter } from "@/ui/components/Meter";
import { Stat } from "@/ui/components/Stat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.points");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Points: balance, pending, expiring soon, tier progress and history (F3 3.4, D-130–D-134). */
export default async function Page() {
  await requireCustomer();
  const requests = await accountRequests();
  const [t, tHome, format, points, entries] = await Promise.all([
    getTranslations("account.points"),
    getTranslations("account.home"),
    getFormat(),
    requests.call("GET /v1/store/me/points"),
    requests.call("GET /v1/store/me/points/entries", { query: { perPage: 50 } }),
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
          value={format.number(points.balance.available)}
          hint={format.thb(points.balance.availableBahtValue)}
        />
        <Stat label={t("pending")} value={format.number(points.balance.pending)} hint={t("pendingHint")} />
        <Stat
          label={t("tier")}
          value={tHome(`tiers.${points.tier.current}`)}
          hint={t("multiplier", { multiplier: points.tier.multiplier })}
        />
      </div>
      {points.balance.expiringSoon > 0 ? (
        <Callout tone="warning">
          {t("expiring", {
            points: format.number(points.balance.expiringSoon),
            date: format.date(points.balance.expiringSoonAt),
          })}
        </Callout>
      ) : null}
      {points.tier.next ? (
        <section aria-labelledby="points-tier" className="border-border rounded-xl border p-4">
          <h2 id="points-tier" className="font-semibold">
            {t("nextTier", { tier: tHome(`tiers.${points.tier.next}`) })}
          </h2>
          <Meter
            className="mt-3"
            value={points.tier.progressPct}
            label={t("nextTier", { tier: tHome(`tiers.${points.tier.next}`) })}
            valueText={tHome("tierProgressValue", {
              spend: format.thb(points.tier.spend12m),
              threshold: format.thb(points.tier.nextThreshold),
            })}
          />
          <p className="text-muted mt-2 text-sm">
            {tHome("tierProgressValue", {
              spend: format.thb(points.tier.spend12m),
              threshold: format.thb(points.tier.nextThreshold),
            })}
          </p>
        </section>
      ) : null}
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
              {entries.data.map((entry) => (
                <tr key={entry.id} className="border-border border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{format.date(entry.createdAt)}</td>
                  <td className="px-4 py-2">
                    {t(`types.${entry.entryType}`)}
                    {entry.order ? (
                      <span className="text-muted block font-mono text-xs">{entry.order.orderCode}</span>
                    ) : null}
                    {entry.note ? <span className="text-muted block text-xs">{entry.note}</span> : null}
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
