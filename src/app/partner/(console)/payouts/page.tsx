import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PAYABLE_STATUS, PAYOUT_ITEM_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { termsFrom, TermsHelp } from "@/features/partner/terms";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { cn } from "@/ui/lib/cn";

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
type Props = { searchParams: Promise<{ view?: string }> };

const VIEWS = ["due", "paid", "all"] as const;
type View = (typeof VIEWS)[number];
type ScheduleRow = { items: { status: string }[] };
/** A PO still owes the factory something while any of its items is neither paid nor cancelled. */
const owing = (row: ScheduleRow) => row.items.some((item) => item.status !== "paid" && item.status !== "cancelled");
const inView = (view: View, row: ScheduleRow) => (view === "all" ? true : view === "due" ? owing(row) : !owing(row));

export default async function PayoutsPage({ searchParams }: Props) {
  const query = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(query.view ?? "") ? (query.view as View) : "due";
  const t = await getTranslations("partnerBilling.payouts");
  const format = await getFormat();
  const tTerms = await getTranslations("partner.terms");
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const [schedule, history, summary] = await Promise.all([
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
    // This month to today, from the vendor sub-ledger: the figures are the API's, the page adds nothing.
    attempt(
      async () => (await contract.GET("/v1/partner/factories/{factoryId}/finance-summary", { params: { path } })).data!,
    ),
  ]);

  type ScheduleData = NonNullable<typeof schedule.data>["data"];
  // The terms are snapshotted per order; when every order carries the same ones (the usual case) they
  // are said once above the table instead of repeated on every row.
  const termLines = (row: ScheduleData[number]) =>
    [
      t("terms.advance", { pct: format.percent(row.terms.advancePct) }),
      Number(row.terms.retentionPct) > 0
        ? t("terms.retention", { pct: format.percent(row.terms.retentionPct), days: row.terms.retentionReleaseDays })
        : null,
      t("terms.claimWindow", { days: row.terms.claimWindowDays }),
    ].filter((line): line is string => Boolean(line));
  const sameTerms =
    !!schedule.data?.data.length && new Set(schedule.data.data.map((row) => termLines(row).join("|"))).size === 1;

  return (
    <PartnerPage
      title={t("title")}
      description={t("body")}
      actions={
        <>
          <Button asChild variant="secondary" size="md" iconStart="calendar">
            <Link href="/payouts/calendar">{t("calendarLink")}</Link>
          </Button>
          <Button asChild variant="secondary" size="md" iconStart="spreadsheet">
            <Link href="/payouts/statement">{t("statementLink")}</Link>
          </Button>
        </>
      }
      wide
    >
      {summary.data ? (
        <section aria-label={t("summary.label")} className="flex flex-col gap-2">
          <StatStrip
            label={t("summary.label")}
            items={[
              {
                key: "owed",
                label: t("summary.owed"),
                value: format.thb(summary.data.period.closing),
                hint: t("summary.asOf", { date: format.date(summary.data.period.to) }),
              },
              { key: "earned", label: t("summary.earned"), value: format.thb(summary.data.period.earned) },
              { key: "paid", label: t("summary.paid"), value: format.thb(summary.data.period.paid) },
              {
                key: "retained",
                label: t("summary.retained"),
                value: format.thb(summary.data.period.retainedHeld),
                hint: t("summary.retainedHint"),
              },
            ]}
          />
          <p className="text-muted text-sm">
            {t("summary.period", {
              from: format.date(summary.data.period.from),
              to: format.date(summary.data.period.to),
            })}
          </p>
        </section>
      ) : null}

      <TermsHelp
        title={tTerms("title")}
        terms={termsFrom(tTerms.raw, ["advance", "balance", "retention", "claimWindow", "payoutRun"])}
      />
      <PartnerSection title={t("scheduleTitle")} description={t("scheduleBody")}>
        {schedule.data ? (
          <ViewTabs
            label={t("views.label")}
            current={view}
            items={VIEWS.map((item) => ({
              key: item,
              href: item === "due" ? "/payouts" : `/payouts?view=${item}`,
              label: t(`views.${item}`),
              count: schedule.data!.data.filter((row) => inView(item, row)).length,
            }))}
          />
        ) : null}
        {schedule.data && sameTerms ? (
          <p className="text-muted text-sm">
            {t("termsAll", { terms: termLines(schedule.data.data[0]!).join(" · ") })}
          </p>
        ) : null}
        {schedule.data ? (
          schedule.data.data.filter((row) => inView(view, row)).length ? (
            <PartnerTable
              caption={t("scheduleTitle")}
              rows={schedule.data.data.filter((row) => inView(view, row))}
              rowKey={(row) => row.purchaseOrderId}
              columns={[
                {
                  key: "job",
                  header: t("table.job"),
                  primary: true,
                  // CONTRACT-GAP partner.payouts — the schedule names the job by number only, so it does not link to it.
                  cell: (row) => (
                    <span className="flex flex-col">
                      <span className="font-mono text-sm whitespace-nowrap">{row.jobNo}</span>
                      <span className="text-muted text-sm whitespace-nowrap">{t("po", { no: row.poNumber })}</span>
                    </span>
                  ),
                },
                ...(["advance", "goods_receipt", "retention"] as const).map((source) => ({
                  key: source,
                  header: t(`sources.${source}`),
                  cell: (row: ScheduleData[number]) => {
                    const item = row.items.find((candidate) => candidate.source === source);
                    if (!item)
                      return (
                        <span className="text-muted text-sm">
                          {source === "goods_receipt" && row.balancePending ? t("table.afterPod") : "—"}
                        </span>
                      );
                    return (
                      <span
                        className={cn(
                          "flex flex-col items-start gap-0.5",
                          // A cancelled advance (paid with the balance instead) is history, not money due.
                          item.status === "cancelled" && "text-muted",
                        )}
                      >
                        <span
                          className={cn("font-semibold tabular-nums", item.status === "cancelled" && "line-through")}
                        >
                          {format.thb(item.netAmount)}
                        </span>
                        <StatusChip map={PAYABLE_STATUS} value={item.status} />
                        <span className="text-muted text-sm whitespace-nowrap">
                          {item.status === "cancelled" && source === "advance"
                            ? t("table.advanceMerged")
                            : item.paidOn
                              ? t("paidOn", { date: format.date(item.paidOn, { style: "dayMonth" }) })
                              : item.eligibleAt
                                ? t("eligibleOn", { date: format.date(item.eligibleAt, { style: "dayMonth" }) })
                                : item.waitingFor
                                  ? t(`waiting.${item.waitingFor}`)
                                  : null}
                        </span>
                      </span>
                    );
                  },
                })),
                ...(sameTerms
                  ? []
                  : [
                      {
                        key: "terms",
                        header: t("table.terms"),
                        hideOnPhone: true,
                        cell: (row: ScheduleData[number]) => (
                          <ul className="text-muted text-sm whitespace-nowrap">
                            {termLines(row).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ),
                      },
                    ]),
              ]}
            />
          ) : (
            <EmptyState icon="wallet" title={view === "due" ? t("views.dueEmpty") : t("scheduleEmpty")} />
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
