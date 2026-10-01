import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getIssuedStatements } from "@/features/customer/business/api.server";
import { CreditApplication, StatementLink } from "@/features/customer/business/CreditPanel";
import { requireMember } from "@/features/customer/business/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";

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
  const status = credit?.creditStatus ?? company.creditStatus;
  const hasCredit = status === "credit" || status === "blocked_overdue";
  const issued = statements ?? [];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted mt-2">{t("intro")}</p>
      </header>

      {!company.can.viewFinance ? <Callout tone="info">{t("noAccess")}</Callout> : null}

      <section aria-labelledby="credit-summary">
        <h2 id="credit-summary" className="text-lg font-semibold">
          {t("summary")}
        </h2>
        <DescriptionList
          className="mt-3"
          items={[
            { term: t("statusLabel"), description: t(`statuses.${status}`) },
            ...(hasCredit && credit
              ? [
                  ...(credit.limitAmount
                    ? [{ term: t("limitLabel"), description: format.thb(credit.limitAmount) }]
                    : []),
                  { term: t("available"), description: format.thb(credit.availableAmount) },
                  { term: t("termLabel"), description: t("days", { days: credit.termDays ?? 0 }) },
                ]
              : []),
          ]}
        />
        {status === "blocked_overdue" || receivables?.creditOrdersBlocked ? (
          <Callout tone="danger" className="mt-4" title={t("blockedTitle")}>
            {receivables?.oldestOverdueDays
              ? t("blocked", {
                  amount: format.thb(receivables.overdueAmount),
                  days: receivables.oldestOverdueDays,
                })
              : t("blockedShort")}
          </Callout>
        ) : null}
      </section>

      {receivables ? (
        <section aria-labelledby="credit-aging">
          <h2 id="credit-aging" className="text-lg font-semibold">
            {t("owedTitle", { date: format.date(receivables.asOf) })}
          </h2>
          <DescriptionList
            className="mt-3"
            items={[
              { term: t("open"), description: format.thb(receivables.openAmount) },
              { term: t("aging.current"), description: format.thb(receivables.aging.current) },
              { term: t("aging.days1to30"), description: format.thb(receivables.aging.d1_30) },
              { term: t("aging.days31to60"), description: format.thb(receivables.aging.d31_60) },
              { term: t("aging.days61to90"), description: format.thb(receivables.aging.d61_90) },
              { term: t("aging.over90"), description: format.thb(receivables.aging.over_90) },
              ...(receivables.nextDueAt
                ? [{ term: t("nextDueTerm"), description: format.dateTime(receivables.nextDueAt) }]
                : []),
            ]}
          />
        </section>
      ) : null}

      {!hasCredit && company.can.viewFinance && company.status === "active" ? (
        <section aria-labelledby="credit-apply">
          <h2 id="credit-apply" className="mb-3 text-lg font-semibold">
            {t("applyTitle")}
          </h2>
          <CreditApplication companyId={company.id} credit={credit} />
        </section>
      ) : null}

      {company.can.viewFinance ? (
        <section aria-labelledby="credit-statements" className="flex flex-col gap-4">
          <h2 id="credit-statements" className="text-lg font-semibold">
            {t("statements")}
          </h2>
          {issued.length === 0 ? (
            <p className="text-muted">{t("noStatements")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {issued.map((statement) => (
                <li
                  key={statement.id}
                  className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{t("period", { period: statement.month })}</p>
                    <p className="text-muted text-xs">
                      {t("statementMetaShort", {
                        invoiced: format.thb(statement.invoicedAmount),
                        paid: format.thb(statement.paidAmount),
                        balance: format.thb(statement.closingAmount),
                      })}
                    </p>
                  </div>
                  {statement.pdfReady ? <StatementLink companyId={company.id} month={statement.month} /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
