import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BILLING_STATEMENT_STATUS, INPUT_VAT_STATUS, VENDOR_INVOICE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { Code, Row, RowList } from "@/features/partner/rows";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
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
          <RowList label={t("title")}>
            {statements.data.data.map((statement) => (
              <Row
                key={statement.id}
                href={`/billing/${statement.id}`}
                icon="receipt"
                tone={statement.status === "sent" ? "warning" : "neutral"}
                title={
                  <>
                    <Code>{statement.bsNumber}</Code>
                    <StatusChip map={BILLING_STATEMENT_STATUS} value={statement.status} />
                    {statement.taxInvoiceStatus !== "none" ? (
                      <StatusChip map={VENDOR_INVOICE_STATUS} value={statement.taxInvoiceStatus} />
                    ) : null}
                    {statement.inputVatStatus ? (
                      <StatusChip map={INPUT_VAT_STATUS} value={statement.inputVatStatus} />
                    ) : null}
                  </>
                }
                meta={t("period", { from: format.date(statement.periodFrom), to: format.date(statement.periodTo) })}
                aside={<span className="text-lg font-semibold">{format.thb(statement.totals.gross)}</span>}
              />
            ))}
          </RowList>
        ) : (
          <EmptyState icon="receipt" title={t("empty")} description={t("emptyBody")} />
        )
      ) : (
        <PageError error={statements.error} />
      )}
    </PartnerPage>
  );
}
