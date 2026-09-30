import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getStatement } from "@/features/customer/business/api.server";
import { CreditApplication, StatementLink } from "@/features/customer/business/CreditPanel";
import { requireMember } from "@/features/customer/business/guard.server";
import { getFormat } from "@/features/shared/format/server";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("business.credit");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The last `count` calendar months in Bangkok, newest first, as `YYYY-MM`. */
function recentMonths(count: number): string[] {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number) as [number, number];
  return Array.from({ length: count }, (_, back) => {
    const index = year * 12 + (month - 1) - back;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  });
}

/**
 * Credit and monthly statements (F3 3.7; D-121, D-125).
 *
 * CONTRACT-GAP store.company-credit — there is no list of issued statements, their due dates or
 * status, and no aging or receivables summary: the page reads the last three months one by one.
 */
export default async function Page() {
  const company = await requireMember();
  const months = recentMonths(3);
  const [t, format, statements] = await Promise.all([
    getTranslations("business.credit"),
    getFormat(),
    company.can.viewFinance ? Promise.all(months.map((month) => getStatement(company.id, month))) : Promise.resolve([]),
  ]);
  const credit = company.credit;
  const status = credit?.creditStatus ?? company.creditStatus;
  const hasCredit = status === "credit" || status === "blocked_overdue";
  const issued = statements.filter((statement): statement is NonNullable<typeof statement> => statement !== null);

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
        {status === "blocked_overdue" ? (
          <Callout tone="danger" className="mt-4" title={t("blockedTitle")}>
            {t("blockedShort")}
          </Callout>
        ) : null}
      </section>

      {!hasCredit && company.can.viewFinance && company.status === "active" ? (
        <section aria-labelledby="credit-apply">
          <h2 id="credit-apply" className="mb-3 text-lg font-semibold">
            {t("applyTitle")}
          </h2>
          <CreditApplication credit={credit} />
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
                        invoiced: format.thb(statement.invoiced),
                        paid: format.thb(statement.paid),
                        balance: format.thb(statement.closing),
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
