import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getIssuedStatements } from "@/features/customer/business/api.server";
import { CreditApplication, StatementLink } from "@/features/customer/business/CreditPanel";
import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { Panel } from "@/features/customer/account/Panel";
import { SummaryCards, type SummaryItem } from "@/features/customer/account/SummaryCards";
import { requireMember } from "@/features/customer/business/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.credit");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Credit and monthly statements (F3 3.7; D-121, D-122, D-125): the limit, what is open and overdue
 * by age (`store.companyCredit.receivables`), applying for credit, and the statements issued so far
 * (`store.companyCredit.listStatements`) with their PDFs.
 */
export default async function Page() {
  const company = await requireMember();
  const [t, format, statements] = await Promise.all([
    getTranslations("business.credit"),
    getFormat(),
    company.can.viewFinance ? getIssuedStatements(company.id) : Promise.resolve(null),
  ]);
  const { receivables } = company;
  const credit = company.credit;
  const summary = company.creditSummary;
  const status = credit?.creditStatus ?? summary?.creditStatus ?? company.creditStatus;
  const hasCredit = status === "credit" || status === "blocked_overdue";
  const issued = statements ?? [];

  const blocked = status === "blocked_overdue" || Boolean(receivables?.creditOrdersBlocked);
  const aging = receivables
    ? ([
        ["current", receivables.aging.current],
        ["days1to30", receivables.aging.d1_30],
        ["days31to60", receivables.aging.d31_60],
        ["days61to90", receivables.aging.d61_90],
        ["over90", receivables.aging.over_90],
      ] as const)
    : [];
  const validUntil = credit?.validUntil ?? summary?.validUntil ?? null;
  // D-462: a buyer (no `credit`, only the summary) sees the available credit and the term, not the limit.
  const buyerCredit = hasCredit && !credit && summary?.availableAmount ? summary : null;
  const facts: SummaryItem[] = [
    {
      key: "status",
      label: t("statusLabel"),
      value: t(`statuses.${status}`),
      icon: "wallet",
      highlight: !hasCredit,
      tone: blocked ? "danger" : "neutral",
    },
    ...(hasCredit && credit
      ? [
          {
            key: "available",
            label: t("available"),
            value: format.thb(credit.availableAmount),
            icon: "coins" as const,
            highlight: true,
          },
          ...(credit.limitAmount
            ? [{ key: "limit", label: t("limitLabel"), value: format.thb(credit.limitAmount) }]
            : []),
          { key: "term", label: t("termLabel"), value: t("days", { days: credit.termDays ?? 0 }) },
        ]
      : []),
    ...(buyerCredit?.availableAmount
      ? [
          {
            key: "available",
            label: t("available"),
            value: format.thb(buyerCredit.availableAmount),
            icon: "coins" as const,
            highlight: true,
          },
          { key: "term", label: t("termLabel"), value: t("days", { days: buyerCredit.termDays ?? 0 }) },
        ]
      : []),
    ...(receivables && !(hasCredit && credit)
      ? [{ key: "open", label: t("open"), value: format.thb(receivables.openAmount), icon: "receipt" as const }]
      : []),
  ];

  // Project C: the credit as summary cards (what is left on the tint), what is owed by age as one row of
  // buckets, applying for credit and the statements as panels.
  return (
    <div className="flex flex-col gap-6">
      <AccountHeader title={t("title")} lede={t("intro")} />

      {!company.can.viewFinance ? <Callout tone="info">{t("noAccess")}</Callout> : null}

      <h2 className="sr-only">{t("summary")}</h2>
      <SummaryCards columns={facts.length >= 4 ? 4 : facts.length === 3 ? 3 : 2} items={facts} />
      {validUntil ? (
        <Callout tone="info" title={t("temporaryTitle", { date: format.date(validUntil) })}>
          {credit?.fallbackLimitAmount && credit.fallbackTermDays !== null
            ? t("temporaryFallback", {
                limit: format.thb(credit.fallbackLimitAmount),
                days: credit.fallbackTermDays,
              })
            : credit
              ? t("temporaryNoFallback")
              : t("temporaryBuyer")}
        </Callout>
      ) : null}
      {blocked ? (
        <Callout tone="danger" title={t("blockedTitle")}>
          {receivables?.oldestOverdueDays
            ? t("blocked", {
                amount: format.thb(receivables.overdueAmount),
                days: receivables.oldestOverdueDays,
              })
            : t("blockedShort")}
        </Callout>
      ) : null}

      {receivables ? (
        <Panel
          id="credit-aging"
          title={t("owedTitle", { date: format.date(receivables.asOf) })}
          actions={
            receivables.nextDueAt ? (
              <span className="text-muted text-sm">
                {t("nextDueTerm")} {format.dateTime(receivables.nextDueAt)}
              </span>
            ) : null
          }
        >
          {receivables.openAmount === "0.00" ? (
            // Nothing open: one sentence, not six ages of ฿0.00.
            <p className="text-muted">{t("nothingOwed")}</p>
          ) : (
            <>
              <p className="text-sm">
                {t("open")}{" "}
                <span className="text-primary text-lg font-semibold tabular-nums">
                  {format.thb(receivables.openAmount)}
                </span>
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {aging.map(([key, amount]) => (
                  <div
                    key={key}
                    className={cn(
                      "rounded-control border p-3",
                      key !== "current" && amount !== "0.00"
                        ? "border-warning bg-warning-subtle text-warning-subtle-fg"
                        : "border-border bg-surface-subtle",
                    )}
                  >
                    <dt className="text-xs">{t(`aging.${key}`)}</dt>
                    <dd className="font-semibold tabular-nums">{format.thb(amount)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Panel>
      ) : null}

      {!hasCredit && company.can.viewFinance && company.status === "active" ? (
        <Panel id="credit-apply" title={t("applyTitle")}>
          <CreditApplication companyId={company.id} credit={credit} />
        </Panel>
      ) : null}

      {company.can.viewFinance ? (
        <Panel id="credit-statements" title={t("statements")}>
          {issued.length === 0 ? (
            <p className="text-muted">{t("noStatements")}</p>
          ) : (
            <ul className="border-border divide-border divide-y rounded-lg border">
              {issued.map((statement) => (
                <li key={statement.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="bg-surface-subtle text-muted grid size-9 shrink-0 place-items-center rounded-lg"
                    >
                      <Icon name="document" size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{t("period", { period: statement.month })}</p>
                      <p className="text-muted text-xs tabular-nums">
                        {t("statementMetaShort", {
                          invoiced: format.thb(statement.invoicedAmount),
                          paid: format.thb(statement.paidAmount),
                          balance: format.thb(statement.closingAmount),
                        })}
                      </p>
                    </div>
                  </div>
                  {statement.pdfReady ? <StatementLink companyId={company.id} month={statement.month} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
