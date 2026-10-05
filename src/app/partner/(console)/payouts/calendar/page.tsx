import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PAYABLE_STATUS, PAYOUT_RUN_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.calendar"))("title") };
}

type View = "orders" | "runs";

/**
 * The payout calendar (U2.F7, D-293): money owed to the factory, "by purchase order" — each unpaid
 * payable with when it is expected and why (a scheduled run, the run days, still waiting for
 * eligibility, or run days not set) — or "by payout run" — the runs of the last 90 days and upcoming,
 * with this factory's lines. Every amount is the API's; nothing is added up here, the statement
 * of account holds the totals.
 */
export default async function PayoutCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view: View = (await searchParams).view === "runs" ? "runs" : "orders";
  const [t, format, context] = await Promise.all([
    getTranslations("partnerBilling.calendar"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const calendar = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/payout-calendar", {
          params: { path: { factoryId: context.factoryId } },
        })
      ).data!,
  );
  const tab = (value: View) => (
    <Link
      href={`/payouts/calendar${value === "runs" ? "?view=runs" : ""}`}
      aria-current={view === value ? "page" : undefined}
      className={
        view === value
          ? "bg-primary-subtle text-primary-subtle-fg inline-flex min-h-12 items-center rounded-lg px-4 font-medium"
          : "text-muted hover:bg-bg-subtle inline-flex min-h-12 items-center rounded-lg px-4"
      }
    >
      {t(`views.${value}`)}
    </Link>
  );

  return (
    <PartnerPage title={t("title")} description={t("body")}>
      <nav aria-label={t("viewsLabel")} className="flex gap-2">
        {tab("orders")}
        {tab("runs")}
      </nav>
      {!calendar.data ? (
        <PageError error={calendar.error} />
      ) : (
        <>
          <p className="text-muted text-sm">
            {calendar.data.runCalendar
              ? t("runDays", { days: calendar.data.runCalendar.weekdays.map((d) => t(`weekdays.${d}`)).join(", ") })
              : t("runDaysUnset")}
          </p>
          {view === "orders" ? (
            calendar.data.payables.length === 0 ? (
              <EmptyState icon="wallet" title={t("noPayables")} />
            ) : (
              <PartnerSection title={t("payablesTitle")}>
                <ul className="flex flex-col gap-2">
                  {calendar.data.payables.map((p) => (
                    <li key={p.id} className="border-border flex flex-col gap-1 rounded-lg border p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{p.poNumber ?? t(`sources.${p.source}`)}</span>
                        <StatusChip map={PAYABLE_STATUS} value={p.status} />
                      </div>
                      <span className="tabular-nums">
                        {t("open", { amount: format.thb(p.openNetAmount), vat: format.thb(p.openVatAmount) })}
                      </span>
                      <span className="text-muted">
                        {p.expectedPayOn ? t("expected", { date: format.date(p.expectedPayOn) }) : t("notYet")}
                        {" · "}
                        {t(`bases.${p.expectedBasis}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </PartnerSection>
            )
          ) : calendar.data.runs.length === 0 ? (
            <EmptyState icon="calendar" title={t("noRuns")} />
          ) : (
            <PartnerSection title={t("runsTitle")}>
              <ul className="flex flex-col gap-3">
                {calendar.data.runs.map((run) => (
                  <li key={run.id} className="border-border flex flex-col gap-2 rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{t("run", { no: run.runNo, date: format.date(run.payOn) })}</span>
                      <StatusChip map={PAYOUT_RUN_STATUS} value={run.status} />
                    </div>
                    <ul className="flex flex-col gap-1">
                      {run.lines.map((line) => (
                        <li key={line.payoutId} className="flex flex-wrap justify-between gap-2">
                          <span>{line.pvNumber ?? t("line")}</span>
                          <span className="tabular-nums">{t("cash", { amount: format.thb(line.cashAmount) })}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </PartnerSection>
          )}
          <Link href="/payouts/statement" className="text-primary inline-flex min-h-12 items-center underline">
            {t("statement")}
          </Link>
        </>
      )}
    </PartnerPage>
  );
}
