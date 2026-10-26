import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PAYABLE_STATUS, PAYOUT_RUN_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
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

  return (
    <PartnerPage title={t("title")} description={t("body")}>
      <ViewTabs
        label={t("viewsLabel")}
        current={view}
        items={(["orders", "runs"] as const).map((value) => ({
          key: value,
          href: `/payouts/calendar${value === "runs" ? "?view=runs" : ""}`,
          label: t(`views.${value}`),
        }))}
      />
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
                <PartnerTable
                  caption={t("payablesTitle")}
                  rows={calendar.data.payables}
                  rowKey={(p) => p.id}
                  columns={[
                    {
                      key: "po",
                      header: t("table.po"),
                      primary: true,
                      cell: (p) => (
                        <span className="text-sm tabular-nums">{p.poNumber ?? t(`sources.${p.source}`)}</span>
                      ),
                    },
                    {
                      key: "net",
                      header: t("table.net"),
                      align: "end",
                      cell: (p) => <span className="font-semibold">{format.thb(p.openNetAmount)}</span>,
                    },
                    { key: "vat", header: t("table.vat"), align: "end", cell: (p) => format.thb(p.openVatAmount) },
                    {
                      key: "expected",
                      header: t("table.expected"),
                      cell: (p) => (
                        <span className="flex flex-col">
                          <span className="whitespace-nowrap">
                            {p.expectedPayOn ? format.date(p.expectedPayOn) : t("notYet")}
                          </span>
                          <span className="text-muted text-sm">{t(`bases.${p.expectedBasis}`)}</span>
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: t("table.status"),
                      className: "whitespace-nowrap",
                      cell: (p) => <StatusChip map={PAYABLE_STATUS} value={p.status} />,
                    },
                  ]}
                />
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
          <Link
            href="/payouts/statement"
            className="text-primary inline-flex min-h-11 items-center underline md:min-h-10"
          >
            {t("statement")}
          </Link>
        </>
      )}
    </PartnerPage>
  );
}
