import { getTranslations } from "next-intl/server";

import { AccountHeader } from "@/features/customer/account/AccountHeader";
import { SummaryCards } from "@/features/customer/account/SummaryCards";
import { NextStep } from "@/features/customer/shell/NextStep";
import { getFormat } from "@/features/shared/format/server";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

import type { Schemas } from "@/lib/api/types";

import type { Company } from "./api.server";

type Spend = Schemas["CompanySpendDto"];

const STATUS_TONE = {
  applied: "warning",
  kyc_review: "warning",
  active: "success",
  suspended: "danger",
  closed: "neutral",
} as const;

/**
 * The company's overview (F3 3.7): who it is and its status, the D-122 notices (due soon, due today,
 * overdue, credit orders blocked), credit and what it owes at a glance, what waits for approval,
 * and where the money went (`store.companies.spend`, D-125). Every figure is the API's.
 */
export async function BusinessDashboard({
  company,
  spend,
  pending,
  applied,
  typeNames,
}: {
  company: Company;
  spend: Spend | null;
  pending: number;
  applied: boolean;
  /** Product type code → name, for the spend by type. */
  typeNames: Record<string, string>;
}) {
  const [t, format] = await Promise.all([getTranslations("business.dashboard"), getFormat()]);
  const [roles, nav] = await Promise.all([getTranslations("business.members.roles"), getTranslations("business.nav")]);
  const creditStatus = company.credit?.creditStatus ?? company.creditSummary?.creditStatus ?? company.creditStatus;
  const summary = company.creditSummary;
  const validUntil = company.credit?.validUntil ?? summary?.validUntil ?? null;
  const hasCredit = creditStatus === "credit" || creditStatus === "blocked_overdue";

  const owedOverdue = company.receivables ? company.receivables.overdueAmount !== "0.00" : false;
  const shortcuts = (
    [
      { key: "reorder", href: "/business/reorder", icon: "refresh", when: company.can.order },
      { key: "members", href: "/business/members", icon: "users", when: true },
      { key: "branches", href: "/business/branches", icon: "building", when: true },
      { key: "assets", href: "/business/assets", icon: "image", when: true },
    ] as const
  ).filter((item) => item.when);

  return (
    <div className="flex flex-col gap-6">
      <AccountHeader
        title={company.legalName}
        status={<Badge tone={STATUS_TONE[company.status]}>{t(`status.${company.status}`)}</Badge>}
        lede={t("meta", {
          code: company.companyCode ?? "",
          roles: company.myRoles.map((role) => roles(role)).join(", "),
        })}
        actions={
          company.can.order ? (
            <Button asChild iconStart="refresh">
              <Link href="/business/reorder">{nav("reorder")}</Link>
            </Button>
          ) : null
        }
      />

      {applied ? (
        <Callout tone="success" title={t("appliedTitle")} role="status">
          {t("applied")}
        </Callout>
      ) : null}
      {company.statusReason ? <Callout tone="info">{company.statusReason}</Callout> : null}
      {company.status === "kyc_review" || company.status === "applied" ? (
        <Callout tone="info">{t("inReview")}</Callout>
      ) : null}
      {(company.receivables?.notices ?? []).map((notice, index) => (
        <Callout
          key={`${notice.code}-${notice.groupCode ?? index}`}
          tone={notice.code === "due_soon" ? "info" : "warning"}
          title={t(`notices.${notice.code}.title`)}
        >
          {t(`notices.${notice.code}.body`, {
            group: notice.groupCode ?? "",
            amount: format.thb(notice.amount),
            date: format.date(notice.dueAt),
            days: company.receivables?.oldestOverdueDays ?? 0,
          })}
          {company.can.viewFinance ? (
            <Link href="/business/credit" className="ms-2 underline underline-offset-4">
              {t("seeStatements")}
            </Link>
          ) : null}
        </Callout>
      ))}

      {/* Project C: credit, what is owed and what waits for approval as the summary cards every money page
          opens with; then the sections as shortcuts; then where the money went. */}
      <SummaryCards
        columns={company.receivables ? 3 : 2}
        items={[
          {
            key: "credit",
            label: hasCredit ? t("credit") : t("creditNone"),
            value: company.credit
              ? hasCredit
                ? format.thb(company.credit.availableAmount)
                : t(`creditStatus.${company.credit.creditStatus}`)
              : summary
                ? // D-462: a buyer sees what is available and the term, not the limit.
                  summary.availableAmount !== null
                  ? format.thb(summary.availableAmount)
                  : t(`creditStatus.${summary.creditStatus}`)
                : t(`creditStatus.${company.creditStatus}`),
            hint:
              company.credit || summary || validUntil ? (
                <>
                  {company.credit
                    ? company.credit.termDays && company.credit.limitAmount
                      ? t("creditMeta", {
                          limit: format.thb(company.credit.limitAmount),
                          days: company.credit.termDays,
                        })
                      : t("prepaid")
                    : summary
                      ? summary.termDays !== null
                        ? t("creditTerm", { days: summary.termDays })
                        : t("prepaid")
                      : null}
                  {validUntil ? (
                    <span className="mt-1 flex items-center gap-1.5">
                      <Icon name="calendar" size={14} aria-hidden="true" />
                      {t("creditUntil", { date: format.date(validUntil) })}
                    </span>
                  ) : null}
                </>
              ) : undefined,
            icon: "wallet",
            highlight: hasCredit,
            action:
              !hasCredit && company.can.viewFinance ? (
                <Link href="/business/credit" className="text-primary text-sm font-medium underline underline-offset-4">
                  {t("requestCredit")}
                </Link>
              ) : undefined,
          },
          ...(company.receivables
            ? [
                {
                  key: "owed",
                  label: t("owed"),
                  value: format.thb(company.receivables.openAmount),
                  hint: owedOverdue
                    ? t("overdue", {
                        amount: format.thb(company.receivables.overdueAmount),
                        days: company.receivables.oldestOverdueDays ?? 0,
                      })
                    : company.receivables.nextDueAt
                      ? t("nextDue", { date: format.date(company.receivables.nextDueAt) })
                      : t("nothingDue"),
                  icon: "receipt" as const,
                  tone: owedOverdue ? ("danger" as const) : ("neutral" as const),
                },
              ]
            : []),
          {
            key: "approvals",
            label: t("approvals"),
            value: format.number(pending),
            hint: company.orderApprovalThreshold
              ? t("threshold", { amount: format.thb(company.orderApprovalThreshold) })
              : t("noThreshold"),
            icon: "check",
            tone: pending > 0 ? "warning" : "neutral",
            action: (
              <Link
                href="/business/approvals"
                className="text-primary text-sm font-medium underline underline-offset-4"
              >
                {t("seeApprovals")}
              </Link>
            ),
          },
        ]}
      />

      <nav aria-label={nav("label")} className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {shortcuts.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="border-border bg-surface rounded-card hover:border-border-strong focus-visible:ring-focus-ring flex items-center gap-3 border p-3.5 text-sm font-medium outline-none focus-visible:ring-2"
          >
            <span
              aria-hidden="true"
              className="bg-surface-subtle text-muted grid size-9 shrink-0 place-items-center rounded-lg"
            >
              <Icon name={item.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate">{nav(item.key)}</span>
            <Icon name="chevron-right" size={16} aria-hidden="true" className="text-muted" />
          </Link>
        ))}
      </nav>

      {spend && spend.total.orders === 0 ? (
        // No company order yet: one sentence and the next step, not twelve rows of ฿0.00.
        <EmptyState
          icon="box"
          title={t("spendEmpty")}
          description={t("spendEmptyBody")}
          action={<NextStep to="products" />}
        />
      ) : spend ? (
        <section
          aria-labelledby="dash-spend"
          className="border-border bg-surface rounded-card flex flex-col gap-5 border p-4 sm:p-5"
        >
          <h2 id="dash-spend" className="text-lg font-semibold">
            {t("spendRange", { from: format.date(spend.from), to: format.date(spend.to) })}
          </h2>
          <dl className="bg-surface-subtle rounded-control grid grid-cols-3 gap-3 p-3 sm:p-4">
            {[
              [t("spendTotal"), format.thb(spend.total.grossAmount)],
              [t("spendNet"), format.thb(spend.total.netAmount)],
              [t("spendOrders"), format.number(spend.total.orders)],
            ].map(([term, value]) => (
              <div key={term} className="min-w-0">
                <dt className="text-muted text-xs">{term}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                [
                  "byMonth",
                  spend.byMonth.map((row) => ({
                    // `2026-10` as the reader's month: ต.ค. 2569.
                    label: format.date(`${row.month}-01`, { style: "month" }),
                    amount: row.grossAmount,
                  })),
                ],
                ["byMember", spend.byMember.map((row) => ({ label: row.user.displayName, amount: row.grossAmount }))],
                [
                  "byBranch",
                  spend.byBranch.map((row) => ({ label: row.name ?? row.branchCode ?? "—", amount: row.grossAmount })),
                ],
                [
                  "byProductType",
                  spend.byProductType.map((row) => ({
                    label: typeNames[row.productTypeCode] ?? row.productTypeCode,
                    amount: row.grossAmount,
                  })),
                ],
              ] as const
            ).map(([key, rows]) => (
              <table key={key} className="border-border w-full rounded-lg border text-sm">
                <caption className="mb-2 text-start font-medium">{t(`spend.${key}`)}</caption>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="text-muted px-3 py-2">{t("spendNone")}</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.label} className="border-border border-t first:border-t-0">
                        <th scope="row" className="px-3 py-2 text-start font-normal">
                          {row.label}
                        </th>
                        <td className="px-3 py-2 text-end font-medium tabular-nums">{format.thb(row.amount)}</td>
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
