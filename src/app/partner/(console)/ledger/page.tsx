import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PERIOD_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { MarkFiled } from "@/features/partner/ledger/LedgerForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.overview"))("title") };
}

const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);

/** The factory's books at a glance (D-385 – D-392): cash, what waits, the periods and their close, the month's returns. */
export default async function LedgerPage() {
  const [t, tc, tAccounts, tTax, format, context] = await Promise.all([
    getTranslations("partnerLedger.overview"),
    getTranslations("partnerLedger.common"),
    getTranslations("partnerLedger.accounts"),
    getTranslations("partnerSales.tax"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const month = thisMonth();
  const [periods, cash, pl, pending, filings, openLines] = await Promise.all([
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/periods", { params: { path } })).data!,
    ),
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/cash-position", { params: { path } })).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/reports/profit-and-loss", {
            params: { path, query: { month } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/journals", {
            params: { path, query: { status: "pending_approval", perPage: 1 } },
          })
        ).data!,
    ),
    attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/tax-filings", { params: { path } })).data!,
    ),
    // The bank lines still to match, as the bank page's own tab counts them.
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/bank-lines", {
            params: { path, query: { status: "open", perPage: 1 } },
          })
        ).data!,
    ),
  ]);
  // Months to come are opened ahead but have nothing to do yet: the list stops at this month.
  const shown = (periods.data ?? []).filter((p) => p.month <= month).reverse();
  // The month to close next: the oldest open month before this one.
  const toClose = [...shown].reverse().find((p) => p.month < month && p.status !== "closed");
  const monthLabel = (m: string) => format.date(`${m}-01`, { style: "month" });
  const taxHref = (form: string, m: string) =>
    form === "pp30" ? `/tax?view=vat30&month=${m}` : `/tax?view=wht&month=${m}&form=${form}`;
  const unreconciled = openLines.data?.meta.total ?? null;
  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canAt(context, "factory_ledger.post") ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/ledger/journals/new">{t("newJournal")}</Link>
          </Button>
        ) : null
      }
    >
      <PartnerStats
        label={t("totals")}
        columns={4}
        items={[
          {
            key: "cash",
            label: t("cash"),
            value: cash.data ? format.thb(cash.data.total) : "—",
            href: "/ledger/bank",
            highlight: true,
          },
          {
            key: "bank",
            label: t("unreconciled"),
            value: unreconciled === null ? "—" : format.number(unreconciled),
            href: "/ledger/bank",
            ...(unreconciled ? { tone: "warning" as const, icon: "warning" as const } : {}),
          },
          {
            key: "np",
            label: t("netProfit"),
            value: pl.data ? format.thb(pl.data.netProfit) : "—",
            href: `/ledger/reports?tab=pl&month=${month}`,
          },
          {
            key: "pend",
            label: t("pending"),
            value: format.number(pending.data?.meta.total ?? 0),
            href: "/ledger/journals?view=pending",
            ...(pending.data?.meta.total ? { tone: "warning" as const, icon: "hourglass" as const } : {}),
          },
        ]}
      />
      <PartnerSection title={t("periods")} description={t("periodsBody")}>
        {periods.data ? (
          <PartnerTable
            caption={t("periods")}
            rows={shown}
            rowKey={(row) => row.id}
            rowHref={(row) => `/ledger/periods/${row.id}`}
            rowTone={(row) => (row.id === toClose?.id ? "warning" : undefined)}
            empty={
              <EmptyState
                icon="calendar"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  <Button asChild variant="secondary" iconStart="settings">
                    <Link href="/ledger/accounts?view=settings">{tAccounts("title")}</Link>
                  </Button>
                }
              />
            }
            columns={[
              {
                key: "m",
                header: tc("month"),
                primary: true,
                cell: (row) => (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="whitespace-nowrap">{monthLabel(row.month)}</span>
                    {row.month === month ? <Badge tone="neutral">{t("thisMonth")}</Badge> : null}
                    {row.id === toClose?.id ? <Badge tone="warning">{t("closeNext")}</Badge> : null}
                  </span>
                ),
              },
              { key: "fy", header: t("fiscalYear"), hideOnPhone: true, cell: (row) => row.fiscalYear },
              { key: "n", header: t("entries"), align: "end", cell: (row) => format.number(row.entries) },
              { key: "s", header: tc("status"), cell: (row) => <StatusChip map={PERIOD_STATUS} value={row.status} /> },
              {
                key: "c",
                header: t("checklist"),
                hideOnPhone: true,
                cell: () => <span className="text-primary text-sm font-medium">{t("checklist")}</span>,
              },
            ]}
          />
        ) : (
          <PageError error={periods.error} />
        )}
      </PartnerSection>
      <PartnerSection title={t("tax")} description={t("taxBody")}>
        {filings.data ? (
          <PartnerTable
            caption={t("tax")}
            rows={filings.data}
            rowKey={(row) => `${row.form}-${row.month}`}
            rowTone={(row) =>
              !row.filed && row.dueOn < new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)
                ? "danger"
                : undefined
            }
            empty={
              <EmptyState
                icon="stamp"
                title={t("noFilings")}
                action={
                  <Button asChild variant="secondary" iconEnd="arrow-right">
                    <Link href="/tax">{tTax("title")}</Link>
                  </Button>
                }
              />
            }
            columns={[
              {
                key: "f",
                header: t("form"),
                primary: true,
                cell: (row) => (
                  <Link className="text-primary underline-offset-4 hover:underline" href={taxHref(row.form, row.month)}>
                    {t(`forms.${row.form}` as never)}
                  </Link>
                ),
              },
              {
                key: "m",
                header: tc("month"),
                cell: (row) => <span className="whitespace-nowrap">{monthLabel(row.month)}</span>,
              },
              { key: "d", header: t("dueOn"), hideOnPhone: true, cell: (row) => format.date(row.dueOn) },
              { key: "l", header: t("ledgerAmount"), align: "end", cell: (row) => format.thb(row.ledgerAmount) },
              {
                key: "doc",
                header: t("documentsAmount"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => format.thb(row.documentsAmount),
              },
              {
                key: "r",
                header: t("reconciled"),
                cell: (row) => (
                  <Badge tone={row.reconciled ? "success" : "warning"}>
                    {row.reconciled ? t("reconciled") : t("notReconciled")}
                  </Badge>
                ),
              },
              {
                key: "s",
                header: tc("status"),
                cell: (row) =>
                  row.filed ? (
                    <Badge tone="success">{t("filed", { date: format.date(row.filedOn) })}</Badge>
                  ) : row.nextActions.some((a) => a.key === "erp_tax.mark_filed") ? (
                    <MarkFiled filing={row} />
                  ) : (
                    <Badge tone="neutral">{t("notFiled")}</Badge>
                  ),
              },
            ]}
          />
        ) : (
          <PageError error={filings.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
