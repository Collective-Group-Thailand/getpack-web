import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PAYABLE_STATUS, PAYOUT_ITEM_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.payouts"))("title") };
}

/**
 * When Packio pays the factory (D-022, D-164, `partner.payables.payoutSchedule`): per purchase order,
 * the terms the job snapshot — the advance on acceptance, the balance once the goods are received
 * after POD and the claim window, and the retention with its release — then the payouts made
 * (`partner.payables.payoutStatement`, a plain list), each with its remittance advice and 50 ทวิ, and
 * the statement of account.
 */
export default async function PayoutsPage() {
  const t = await getTranslations("partnerBilling.payouts");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [schedule, history] = await Promise.all([
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/payout-schedule", {
            params: { path, query: { perPage: 50 } },
          })
        ).data!,
    ),
    // The list is a date range, not pages (U-B0.3); the API's own default range applies.
    attempt(
      async () => (await contract.GET("/v1/partner/factories/{factoryId}/payouts", { params: { path } })).data ?? [],
    ),
  ]);

  return (
    <PartnerPage
      title={t("title")}
      description={t("body")}
      back={{ href: "/billing", label: t("back") }}
      actions={
        <span className="flex flex-wrap gap-4">
          <Link href="/payouts/calendar" className="text-primary inline-flex min-h-12 items-center gap-1 underline">
            <Icon name="calendar" size={20} />
            {t("calendarLink")}
          </Link>
          <Link href="/payouts/statement" className="text-primary inline-flex min-h-12 items-center gap-1 underline">
            <Icon name="spreadsheet" size={20} />
            {t("statementLink")}
          </Link>
        </span>
      }
      wide
    >
      <PartnerSection title={t("scheduleTitle")} description={t("scheduleBody")}>
        {schedule.data ? (
          schedule.data.data.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {schedule.data.data.map((row) => (
                <li key={row.purchaseOrderId}>
                  <Card padding="md" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      {/* CONTRACT-GAP partner.payouts — the schedule names the job by number only, so it does not link to it. */}
                      <span className="font-mono font-semibold">{row.jobNo}</span>
                      <span className="text-muted flex-1 text-sm">{row.orderCode}</span>
                      <span className="text-sm">{t("po", { no: row.poNumber })}</span>
                    </div>
                    <p className="text-muted text-sm">
                      {[
                        t("terms.advance", { pct: format.percent(row.terms.advancePct) }),
                        Number(row.terms.retentionPct) > 0
                          ? t("terms.retention", {
                              pct: format.percent(row.terms.retentionPct),
                              days: row.terms.retentionReleaseDays,
                            })
                          : null,
                        t("terms.claimWindow", { days: row.terms.claimWindowDays }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {row.items.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="w-36 font-medium">{t(`sources.${item.source}`)}</span>
                          <span className="font-medium tabular-nums">{format.thb(item.netAmount)}</span>
                          <StatusChip map={PAYABLE_STATUS} value={item.status} />
                          <span className="text-muted">
                            {item.paidOn
                              ? t("paidOn", { date: format.date(item.paidOn) })
                              : item.eligibleAt
                                ? t("eligibleOn", { date: format.date(item.eligibleAt) })
                                : item.waitingFor
                                  ? t(`waiting.${item.waitingFor}`)
                                  : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {row.balancePending ? <p className="text-muted text-sm">{t("balancePending")}</p> : null}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="wallet" title={t("scheduleEmpty")} />
          )
        ) : (
          <PageError error={schedule.error} />
        )}
      </PartnerSection>

      <PartnerSection title={t("historyTitle")}>
        {history.data ? (
          history.data.length ? (
            <ul className="flex flex-col gap-2">
              {history.data.map((payout) => (
                <li key={payout.id}>
                  <Link
                    href={`/payouts/${payout.id}`}
                    className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 flex-wrap items-center gap-2 rounded-xl border p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono font-semibold">{payout.pvNumber ?? t("noPv")}</span>
                      <span className="text-muted text-sm">
                        {t(`kinds.${payout.kind}`)} ·{" "}
                        {payout.paidOn
                          ? t("paidTo", {
                              date: format.date(payout.paidOn),
                              last4: payout.bankAccountLast4 ?? "—",
                            })
                          : t("payOn", { date: format.date(payout.payOn) })}
                      </span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums">{format.thb(payout.cashAmount)}</span>
                    <StatusChip map={PAYOUT_ITEM_STATUS} value={payout.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="coins" title={t("historyEmpty")} />
          )
        ) : (
          <PageError error={history.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
