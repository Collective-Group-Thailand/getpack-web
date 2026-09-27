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
 * When Packio pays the factory (D-022, D-164): per job, the advance on acceptance, the balance
 * after POD and the claim window, and the retention with its release date — then the payouts made,
 * each with its remittance advice and WHT certificate, and the statement of account.
 */
export default async function PayoutsPage() {
  const t = await getTranslations("partnerBilling.payouts");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [schedule, history] = await Promise.all([
    attempt(() => requests.call("GET /v1/partner/factories/{factoryId}/payout-schedule", { path })),
    attempt(() => requests.call("GET /v1/partner/factories/{factoryId}/payouts", { path, query: { perPage: 50 } })),
  ]);

  return (
    <PartnerPage
      title={t("title")}
      description={t("body")}
      back={{ href: "/billing", label: t("back") }}
      actions={
        <Link href="/payouts/statement" className="text-primary inline-flex min-h-12 items-center gap-1 underline">
          <Icon name="spreadsheet" size={20} />
          {t("statementLink")}
        </Link>
      }
      wide
    >
      <PartnerSection title={t("scheduleTitle")} description={t("scheduleBody")}>
        {schedule.data ? (
          schedule.data.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {schedule.data.map((row) => (
                <li key={row.job.id}>
                  <Card padding="md" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link href={`/jobs/${row.job.id}`} className="font-mono font-semibold underline">
                        {row.job.jobNo}
                      </Link>
                      <span className="text-muted flex-1 text-sm">{row.job.title}</span>
                      <span className="tabular-nums">{t("po", { amount: format.thb(row.poAmount) })}</span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {row.items.map((item) => (
                        <li key={item.kind} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="w-32 font-medium">
                            {t(`kinds.${item.kind}`, { pct: format.percent(item.pct) })}
                          </span>
                          <span className="font-medium tabular-nums">{format.thb(item.amount)}</span>
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
          history.data.data.length ? (
            <ul className="flex flex-col gap-2">
              {history.data.data.map((payout) => (
                <li key={payout.id}>
                  <Link
                    href={`/payouts/${payout.id}`}
                    className="border-border bg-surface hover:bg-surface-subtle flex min-h-16 flex-wrap items-center gap-2 rounded-xl border p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono font-semibold">{payout.pvNumber}</span>
                      <span className="text-muted text-sm">
                        {t("paidTo", { date: format.date(payout.paidOn), last4: payout.bankLast4 })}
                      </span>
                    </span>
                    <span className="text-lg font-semibold tabular-nums">{format.thb(payout.net)}</span>
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
