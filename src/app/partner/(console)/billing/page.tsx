import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BILLING_STATEMENT_STATUS, VENDOR_INVOICE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling"))("title") };
}

/**
 * The factory's billing statements (F5 5.3, D-090, `partner.payables.listStatements`): what Packio
 * owes for each period, generated from PO + POD, waiting for the factory to confirm — then for its
 * own tax invoice. Token-scoped (D-044); `factoryId` picks the factory a user of several acts for.
 */
export default async function BillingPage() {
  const t = await getTranslations("partnerBilling");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const statements = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/billing-statements", {
          params: { query: { factoryId: context.factoryId, perPage: 50 } },
        })
      ).data!,
  );

  return (
    <PartnerPage
      wide
      title={t("title")}
      description={t("body")}
      actions={
        canAt(context, "factory_payables.read") ? (
          <Button asChild variant="secondary" size="md" iconStart="coins">
            <Link href="/payouts">{t("payoutsLink")}</Link>
          </Button>
        ) : null
      }
    >
      {statements.data ? (
        statements.data.data.length ? (
          <PartnerTable
            caption={t("title")}
            rows={statements.data.data}
            rowKey={(statement) => statement.id}
            rowHref={(statement) => `/billing/${statement.id}`}
            rowTone={(statement) => (statement.status === "sent" ? "warning" : undefined)}
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (statement) => <span className="font-mono whitespace-nowrap">{statement.bsNumber}</span>,
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
                key: "gross",
                header: t("table.gross"),
                align: "end",
                cell: (statement) => <span className="font-semibold">{format.thb(statement.totals.gross)}</span>,
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
                  ) : (
                    <span className="text-muted">{t("table.noInvoice")}</span>
                  ),
              },
            ]}
          />
        ) : (
          <EmptyState icon="receipt" title={t("empty")} description={t("emptyBody")} />
        )
      ) : (
        <PageError error={statements.error} />
      )}
    </PartnerPage>
  );
}
