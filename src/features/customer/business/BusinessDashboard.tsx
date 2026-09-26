import { getTranslations } from "next-intl/server";

import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { DescriptionList } from "@/ui/components/DescriptionList";

import type { Company } from "./api.server";
import type { getSpend } from "./api.server";

type Spend = NonNullable<Awaited<ReturnType<typeof getSpend>>>;

const STATUS_TONE = {
  applied: "warning",
  kyc_review: "warning",
  active: "success",
  suspended: "danger",
  closed: "neutral",
} as const;

/**
 * The company's overview (F3 3.7): who it is and its status, the notices that need acting on
 * (D-122), credit at a glance, what waits for approval, and where the money went.
 */
export async function BusinessDashboard({
  company,
  spend,
  pending,
  applied,
}: {
  company: Company;
  spend: Spend | null;
  pending: number;
  applied: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations("business.dashboard"), getFormat()]);
  const roles = await getTranslations("business.members.roles");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{company.legalName}</h1>
          <Badge tone={STATUS_TONE[company.status]}>{t(`status.${company.status}`)}</Badge>
        </div>
        <p className="text-muted text-sm">
          {t("meta", { code: company.companyCode, roles: company.myRoles.map((role) => roles(role)).join(", ") })}
        </p>
      </header>

      {applied ? (
        <Callout tone="success" title={t("appliedTitle")} role="status">
          {t("applied")}
        </Callout>
      ) : null}
      {company.statusNote ? <Callout tone="info">{company.statusNote}</Callout> : null}
      {company.notices.map((notice) => (
        <Callout
          key={`${notice.kind}-${notice.statementId ?? "all"}`}
          tone={notice.kind === "due_soon" ? "info" : notice.kind === "due_today" ? "warning" : "danger"}
          title={t(`notices.${notice.kind}.title`)}
        >
          {t(`notices.${notice.kind}.body`, {
            amount: format.thb(notice.amount),
            date: format.date(notice.dueAt),
            days: notice.daysOverdue,
            period: notice.period ?? "",
          })}
          {company.can.viewFinance ? (
            <Link href="/business/credit" className="ms-2 underline underline-offset-4">
              {t("seeStatements")}
            </Link>
          ) : null}
        </Callout>
      ))}

      <div className="grid gap-4 md:grid-cols-3">
        <section aria-labelledby="dash-credit" className="border-border rounded-xl border p-5">
          <h2 id="dash-credit" className="text-muted text-sm font-medium">
            {t("credit")}
          </h2>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {company.credit.status === "credit" || company.credit.status === "blocked_overdue"
              ? format.thb(company.credit.availableAmount)
              : t(`creditStatus.${company.credit.status}`)}
          </p>
          <p className="text-muted text-sm">
            {company.credit.termDays
              ? t("creditMeta", { limit: format.thb(company.credit.limitAmount), days: company.credit.termDays })
              : t("prepaid")}
          </p>
        </section>
        <section aria-labelledby="dash-owed" className="border-border rounded-xl border p-5">
          <h2 id="dash-owed" className="text-muted text-sm font-medium">
            {t("owed")}
          </h2>
          <p className="mt-1 text-2xl font-bold tabular-nums">{format.thb(company.receivables.openAmount)}</p>
          <p className="text-muted text-sm">
            {company.receivables.overdueAmount !== "0.00"
              ? t("overdue", {
                  amount: format.thb(company.receivables.overdueAmount),
                  days: company.receivables.oldestOverdueDays,
                })
              : company.receivables.nextDueAt
                ? t("nextDue", { date: format.date(company.receivables.nextDueAt) })
                : t("nothingDue")}
          </p>
        </section>
        <section aria-labelledby="dash-approvals" className="border-border rounded-xl border p-5">
          <h2 id="dash-approvals" className="text-muted text-sm font-medium">
            {t("approvals")}
          </h2>
          <p className="mt-1 text-2xl font-bold tabular-nums">{format.number(pending)}</p>
          <p className="text-muted text-sm">
            {company.orderApprovalThreshold
              ? t("threshold", { amount: format.thb(company.orderApprovalThreshold) })
              : t("noThreshold")}
          </p>
          <Link
            href="/business/approvals"
            className="text-primary mt-2 inline-block text-sm underline underline-offset-4"
          >
            {t("seeApprovals")}
          </Link>
        </section>
      </div>

      {spend ? (
        <section aria-labelledby="dash-spend" className="flex flex-col gap-4">
          <h2 id="dash-spend" className="text-lg font-semibold">
            {t("spendTitle", { months: spend.months })}
          </h2>
          <DescriptionList
            items={[
              { term: t("spendTotal"), description: format.thb(spend.total) },
              { term: t("spendOrders"), description: format.number(spend.ordersCount) },
            ]}
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {(
              [
                ["byMonth", spend.byMonth.map((row) => ({ label: row.month, amount: row.amount }))],
                ["byMember", spend.byMember.map((row) => ({ label: row.name, amount: row.amount }))],
                ["byProductType", spend.byProductType.map((row) => ({ label: row.name, amount: row.amount }))],
              ] as const
            ).map(([key, rows]) => (
              <table key={key} className="w-full text-sm">
                <caption className="mb-2 text-start font-medium">{t(`spend.${key}`)}</caption>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="text-muted py-1">{t("spendNone")}</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.label} className="border-border border-t">
                        <th scope="row" className="py-1.5 text-start font-normal">
                          {row.label}
                        </th>
                        <td className="py-1.5 text-end tabular-nums">{format.thb(row.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
