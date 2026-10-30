import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PAYABLE_STATUS, PAYOUT_RUN_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.calendar"))("title") };
}

type View = "orders" | "runs";

/** The weekday of a `YYYY-MM-DD` date, 0 = Sunday (the calendar's weekday keys). */
const weekday = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00Z`).getUTCDay();

/**
 * One day of the calendar: the date on the left (above on a phone), what falls on it in one ruled panel on the
 * right. The same agenda on a desk and a phone — a list by date reads on a 6" screen where a month grid does not.
 */
function Day({ date, sub, children }: { date: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
      <div className="flex items-baseline gap-2 md:flex-col md:gap-0.5 md:pt-3">
        <p className="font-semibold tabular-nums">{date}</p>
        {sub ? <p className="text-muted text-sm">{sub}</p> : null}
      </div>
      <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">{children}</ul>
    </li>
  );
}

/**
 * The payout calendar (U2.F7, D-293): money owed to the factory, "by purchase order" — each unpaid
 * payable under the day it is expected and why (a scheduled run, the run days, still waiting for
 * eligibility, or run days not set) — or "by payout run" — the runs of the last 90 days and upcoming,
 * with this factory's lines. Every amount is the API's; nothing is added up here, the statement
 * of account holds the totals.
 */
export default async function PayoutCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view: View = (await searchParams).view === "runs" ? "runs" : "orders";
  const [t, tPayouts, format, context] = await Promise.all([
    getTranslations("partnerBilling.calendar"),
    getTranslations("partnerBilling.payouts"),
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
  const day = (date: string) => format.date(date, { style: "long" });
  const dayName = (date: string) => t(`weekdays.${weekday(date)}` as never);
  const statementLink = (
    <Button asChild variant="secondary" iconStart="spreadsheet">
      <Link href="/payouts/statement">{t("statement")}</Link>
    </Button>
  );

  let body: React.ReactNode;
  if (!calendar.data) body = <PageError error={calendar.error} />;
  else if (view === "orders") {
    type Payable = (typeof calendar.data.payables)[number];
    // By the day it is expected, earliest first; what cannot be dated yet comes last, under its own heading.
    const days = new Map<string, Payable[]>();
    for (const p of [...calendar.data.payables].sort((a, b) =>
      (a.expectedPayOn ?? "9999").localeCompare(b.expectedPayOn ?? "9999"),
    )) {
      const key = p.expectedPayOn?.slice(0, 10) ?? "";
      days.set(key, [...(days.get(key) ?? []), p]);
    }
    body = days.size ? (
      <ol aria-label={t("payablesTitle")} className="flex flex-col gap-5">
        {[...days].map(([date, items]) => (
          <Day key={date || "none"} date={date ? day(date) : t("notYet")} sub={date ? dayName(date) : undefined}>
            {items.map((p) => (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">{p.poNumber ?? t(`sources.${p.source}`)}</span>
                    <StatusChip map={PAYABLE_STATUS} value={p.status} />
                  </span>
                  <span className="text-muted text-sm">{t(`bases.${p.expectedBasis}`)}</span>
                </div>
                <div className="flex flex-col items-end text-end tabular-nums">
                  <span className="font-semibold">{format.thb(p.openNetAmount)}</span>
                  <span className="text-muted text-sm whitespace-nowrap">
                    {t("table.vat")} {format.thb(p.openVatAmount)}
                  </span>
                </div>
              </li>
            ))}
          </Day>
        ))}
      </ol>
    ) : (
      <EmptyState icon="wallet" title={t("noPayables")} action={statementLink} />
    );
  } else {
    const runs = [...calendar.data.runs].sort((a, b) => a.payOn.localeCompare(b.payOn));
    body = runs.length ? (
      <ol aria-label={t("runsTitle")} className="flex flex-col gap-5">
        {runs.map((run) => (
          <Day key={run.id} date={day(run.payOn)} sub={dayName(run.payOn)}>
            <li className="bg-surface-subtle flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="font-medium tabular-nums">
                {t("run", { no: run.runNo, date: format.date(run.payOn) })}
              </span>
              <StatusChip map={PAYOUT_RUN_STATUS} value={run.status} />
            </li>
            {run.lines.map((line) => (
              <li
                key={line.payoutId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <span className="tabular-nums">{line.pvNumber ?? t("line")}</span>
                <span className="font-semibold tabular-nums">{t("cash", { amount: format.thb(line.cashAmount) })}</span>
              </li>
            ))}
          </Day>
        ))}
      </ol>
    ) : (
      <EmptyState icon="calendar" title={t("noRuns")} action={statementLink} />
    );
  }

  return (
    <PartnerPage
      wide
      title={t("title")}
      description={t("body")}
      back={{ href: "/payouts", label: tPayouts("title") }}
      actions={
        <Button asChild variant="secondary" size="lg" iconStart="spreadsheet">
          <Link href="/payouts/statement">{t("statement")}</Link>
        </Button>
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("viewsLabel")}
          current={view}
          items={(["orders", "runs"] as const).map((value) => ({
            key: value,
            href: `/payouts/calendar${value === "runs" ? "?view=runs" : ""}`,
            label: t(`views.${value}`),
            ...(calendar.data
              ? { count: value === "orders" ? calendar.data.payables.length : calendar.data.runs.length }
              : {}),
          }))}
        />
        {calendar.data ? (
          <p className="text-muted flex items-center gap-2 text-sm">
            <Icon name="calendar" size={16} aria-hidden />
            {calendar.data.runCalendar
              ? t("runDays", { days: calendar.data.runCalendar.weekdays.map((d) => t(`weekdays.${d}`)).join(", ") })
              : t("runDaysUnset")}
          </p>
        ) : null}
      </ListToolbar>
      {body}
    </PartnerPage>
  );
}
