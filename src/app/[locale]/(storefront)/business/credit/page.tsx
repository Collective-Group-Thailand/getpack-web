import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getStatements } from "@/features/customer/business/api.server";
import { CreditApplication, StatementLink } from "@/features/customer/business/CreditPanel";
import { requireMember } from "@/features/customer/business/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.credit");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const TONE = { open: "info", paid: "success", overdue: "danger" } as const;

/** Credit, statements and aging (F3 3.7; D-121, D-122, D-125). */
export default async function Page() {
  const company = await requireMember();
  const [t, format, statements] = await Promise.all([
    getTranslations("business.credit"),
    getFormat(),
    company.can.viewFinance ? getStatements() : Promise.resolve(null),
  ]);
  const credit = company.credit;
  const hasCredit = credit.status === "credit" || credit.status === "blocked_overdue";

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
            { term: t("statusLabel"), description: t(`statuses.${credit.status}`) },
            ...(hasCredit
              ? [
                  { term: t("limitLabel"), description: format.thb(credit.limitAmount) },
                  { term: t("available"), description: format.thb(credit.availableAmount) },
                  { term: t("termLabel"), description: t("days", { days: credit.termDays ?? 0 }) },
                ]
              : []),
          ]}
        />
        {company.receivables.creditOrdersBlocked ? (
          <Callout tone="danger" className="mt-4" title={t("blockedTitle")}>
            {t("blocked", {
              amount: format.thb(company.receivables.overdueAmount),
              days: company.receivables.oldestOverdueDays,
            })}
          </Callout>
        ) : null}
      </section>

      {!hasCredit && company.can.viewFinance && company.status === "active" ? (
        <section aria-labelledby="credit-apply">
          <h2 id="credit-apply" className="mb-3 text-lg font-semibold">
            {t("applyTitle")}
          </h2>
          <CreditApplication company={company} />
        </section>
      ) : null}

      {statements ? (
        <section aria-labelledby="credit-statements" className="flex flex-col gap-4">
          <h2 id="credit-statements" className="text-lg font-semibold">
            {t("statements")}
          </h2>
          <DescriptionList
            items={[
              { term: t("aging.current"), description: format.thb(statements.aging.current) },
              { term: t("aging.days1to30"), description: format.thb(statements.aging.days1to30) },
              { term: t("aging.days31to60"), description: format.thb(statements.aging.days31to60) },
              { term: t("aging.days61to90"), description: format.thb(statements.aging.days61to90) },
              { term: t("aging.over90"), description: format.thb(statements.aging.over90) },
            ]}
          />
          {statements.data.length === 0 ? (
            <p className="text-muted">{t("noStatements")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {statements.data.map((statement) => (
                <li
                  key={statement.id}
                  className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{t("period", { period: statement.period })}</p>
                    <p className="text-muted text-xs">
                      {t("statementMeta", {
                        invoiced: format.thb(statement.invoicedAmount),
                        paid: format.thb(statement.paidAmount),
                        balance: format.thb(statement.closingBalance),
                        due: format.date(statement.dueAt),
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE[statement.status]}>{t(`statementStatus.${statement.status}`)}</Badge>
                    <StatementLink statementId={statement.id} period={statement.period} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
