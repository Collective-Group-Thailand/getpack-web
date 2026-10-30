import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BILLING_STATEMENT_STATUS, VENDOR_INVOICE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling"))("title") };
}

const VIEWS = ["all", "sent", "confirmed", "disputed"] as const;
type View = (typeof VIEWS)[number];

/**
 * The factory's billing statements (F5 5.3, D-090, `partner.payables.listStatements`): what getpack
 * owes for each period, generated from PO + POD, waiting for the factory to confirm — then for its
 * own tax invoice. Token-scoped (D-044); `factoryId` picks the factory a user of several acts for. Tabs by status,
 * each with the API's count, so a tab says how many statements it opens.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "all";
  const [t, tStatus, tFactoryStatus, format, context] = await Promise.all([
    getTranslations("partnerBilling"),
    getTranslations("status"),
    getTranslations("partner.status"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = (status: View, perPage: number) =>
    contract.GET("/v1/partner/billing-statements", {
      params: { query: { factoryId: context.factoryId, perPage, ...(status === "all" ? {} : { status }) } },
    });
  const [statements, counts] = await Promise.all([
    attempt(async () => (await list(view, 50)).data!),
    viewTotals(VIEWS, async (key) => (await list(key, 1)).data),
  ]);
  type Statement = NonNullable<typeof statements.data>["data"][number];
  // A confirmed statement is paid only once the factory's own tax invoice is attached (D-090).
  const needsInvoice = (s: Statement) => s.status === "confirmed" && s.taxInvoiceStatus === "none";
  const statusLabel = (key: string) => (tFactoryStatus.has(key) ? tFactoryStatus(key) : tStatus(key as never));
  const label: Record<View, string> = {
    all: t("views.all"),
    sent: t("summary.toCheck"),
    confirmed: statusLabel("billingStatement.confirmed"),
    disputed: t("summary.disputed"),
  };
  const href = (next: View) => `/billing${queryOf({ view: next === "all" ? undefined : next })}`;

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canAt(context, "factory_payables.read") ? (
          <Button asChild variant="secondary" size="lg" iconStart="coins">
            <Link href="/payouts">{t("payoutsLink")}</Link>
          </Button>
        ) : null
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({ key, href: href(key), label: label[key], count: counts[key] }))}
        />
      </ListToolbar>
      {statements.data ? (
        <PartnerTable
          caption={label[view]}
          rows={statements.data.data}
          rowKey={(statement) => statement.id}
          rowHref={(statement) => `/billing/${statement.id}`}
          // No coloured edge: every statement waiting on the factory already says so in its status, and a stripe on
          // most rows would be alarm noise.
          empty={
            <EmptyState
              icon="receipt"
              title={t("empty")}
              description={t("emptyBody")}
              action={
                view !== "all" ? (
                  <Button asChild variant="secondary" iconEnd="arrow-right">
                    <Link href={href("all")}>{label.all}</Link>
                  </Button>
                ) : canAt(context, "factory_payables.read") ? (
                  <Button asChild variant="secondary" iconStart="coins">
                    <Link href="/payouts">{t("payoutsLink")}</Link>
                  </Button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: "no",
              header: t("table.no"),
              primary: true,
              cell: (statement) => <span className="whitespace-nowrap tabular-nums">{statement.bsNumber}</span>,
            },
            {
              key: "period",
              header: t("table.period"),
              className: "whitespace-nowrap",
              // A one-day run reads as that day; a longer one as "1 ต.ค. – 9 ต.ค. 2569".
              cell: (statement) =>
                statement.periodFrom === statement.periodTo
                  ? format.date(statement.periodFrom)
                  : `${format.date(statement.periodFrom, { style: "dayMonth" })} – ${format.date(statement.periodTo)}`,
            },
            {
              key: "status",
              header: t("table.status"),
              className: "whitespace-nowrap",
              cell: (statement) => <StatusChip map={BILLING_STATEMENT_STATUS} value={statement.status} />,
            },
            {
              key: "invoice",
              header: t("table.invoice"),
              cell: (statement) =>
                statement.taxInvoiceStatus !== "none" ? (
                  <StatusChip map={VENDOR_INVOICE_STATUS} value={statement.taxInvoiceStatus} />
                ) : needsInvoice(statement) ? (
                  <Badge tone="warning">{t("table.attachNow")}</Badge>
                ) : (
                  <span className="text-muted">{t("table.noInvoice")}</span>
                ),
            },
            {
              key: "gross",
              header: t("table.gross"),
              align: "end",
              cell: (statement) => <span className="font-semibold">{format.thb(statement.totals.gross)}</span>,
            },
          ]}
        />
      ) : (
        <PageError error={statements.error} />
      )}
    </PartnerPage>
  );
}
