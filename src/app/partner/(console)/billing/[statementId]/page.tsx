import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BILLING_STATEMENT_STATUS, INPUT_VAT_STATUS, VENDOR_INVOICE_STATUS } from "@/domain/status";
import { ConfirmStatement, DisputeStatement, TaxInvoiceForm } from "@/features/partner/billing/actions";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/shared/status/StatusChip";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";

type Props = { params: Promise<{ statementId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.detail"))("metaTitle") };
}

const KINDS = ["production", "shipping", "deduction", "advance_offset"] as const;

/**
 * One billing statement (D-090): its lines by kind — goods received at the PO's price
 * (min(delivered, shipped), D-165), shipping, claim deductions, the advance already paid — the
 * totals with VAT, confirm or dispute, then the factory's own tax invoice; input VAT is Packio's to
 * claim only once that invoice is validated (accounting-design §2).
 */
export default async function StatementPage({ params }: Props) {
  const { statementId } = await params;
  const t = await getTranslations("partnerBilling.detail");
  const format = await getFormat();
  const context = await factoryContext();
  const { requests } = await partnerServerApis();
  const found = await attempt(() =>
    requests.call("GET /v1/partner/factories/{factoryId}/billing-statements/{statementId}", {
      path: { factoryId: context.factoryId, statementId },
    }),
  );
  const back = { href: "/billing", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const statement = found.data;

  return (
    <PartnerPage
      title={statement.bsNumber}
      back={back}
      meta={
        <>
          <StatusChip map={BILLING_STATEMENT_STATUS} value={statement.status} size="md" />
          <StatusChip map={INPUT_VAT_STATUS} value={statement.inputVatStatus} size="md" />
        </>
      }
      description={t("period", { from: format.date(statement.periodFrom), to: format.date(statement.periodTo) })}
      wide
    >
      {statement.status === "disputed" && statement.disputeNote ? (
        <Callout tone="warning" icon="flag" title={t("disputedTitle")}>
          {statement.disputeNote}
        </Callout>
      ) : null}
      {statement.confirmedAt && statement.confirmedBy ? (
        <Callout tone="success" icon="check">
          {t("confirmedBy", { name: statement.confirmedBy.displayName, date: format.dateTime(statement.confirmedAt) })}
        </Callout>
      ) : null}

      <PartnerSection title={t("totals")}>
        <Card padding="md">
          <DescriptionList
            columns={1}
            items={[
              {
                term: t("production"),
                description: <span className="tabular-nums">{format.thb(statement.totals.production)}</span>,
              },
              {
                term: t("shipping"),
                description: <span className="tabular-nums">{format.thb(statement.totals.shipping)}</span>,
              },
              {
                term: t("deductions"),
                description: <span className="tabular-nums">{format.thb(statement.totals.deductions)}</span>,
              },
              { term: t("net"), description: <span className="tabular-nums">{format.thb(statement.totals.net)}</span> },
              { term: t("vat"), description: <span className="tabular-nums">{format.thb(statement.totals.vat)}</span> },
              {
                term: t("gross"),
                description: (
                  <span className="text-lg font-semibold tabular-nums">{format.thb(statement.totals.gross)}</span>
                ),
              },
              {
                term: t("alreadyPaid"),
                description: <span className="tabular-nums">{format.thb(statement.totals.alreadyPaid)}</span>,
              },
              {
                term: t("remaining"),
                description: (
                  <span className="font-semibold tabular-nums">{format.thb(statement.totals.remaining)}</span>
                ),
              },
            ]}
          />
        </Card>
      </PartnerSection>

      {statement.nextActions.includes("confirm") ? (
        <PartnerSection title={t("checkTitle")} description={t("checkBody")}>
          <div className="grid gap-3 md:grid-cols-2">
            <ConfirmStatement
              statementId={statement.id}
              bsNumber={statement.bsNumber}
              gross={format.thb(statement.totals.gross)}
            />
            <DisputeStatement statementId={statement.id} bsNumber={statement.bsNumber} />
          </div>
        </PartnerSection>
      ) : null}

      {statement.nextActions.includes("submit_tax_invoice") ? (
        <PartnerSection title={t("invoiceTitle")} description={t("invoiceBody")}>
          <Card padding="lg">
            <TaxInvoiceForm
              statementId={statement.id}
              taxId={context.factory?.taxId ?? ""}
              branchCode={context.factory?.branchCode ?? "00000"}
            />
          </Card>
        </PartnerSection>
      ) : null}

      {statement.taxInvoices.length ? (
        <PartnerSection title={t("invoices")}>
          <ul className="flex flex-col gap-2">
            {statement.taxInvoices.map((invoice) => (
              <li key={invoice.id}>
                <Card padding="md" className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {t("invoiceLine", { no: invoice.invoiceNo, date: format.date(invoice.invoiceDate) })}
                    </span>
                    <span className="text-muted text-sm">
                      {invoice.source === "e_tax"
                        ? t("eTaxRef", { ref: invoice.eTaxReference ?? "" })
                        : (invoice.file?.originalName ?? "")}
                    </span>
                    {invoice.rejectReason ? (
                      <span className="text-danger block text-sm">{invoice.rejectReason}</span>
                    ) : null}
                  </span>
                  <StatusChip map={VENDOR_INVOICE_STATUS} value={invoice.status} />
                  {invoice.file?.url ? (
                    <a
                      href={invoice.file.url}
                      download={invoice.file.originalName}
                      className="text-primary inline-flex min-h-12 items-center underline"
                    >
                      {t("download")}
                    </a>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </PartnerSection>
      ) : null}

      {KINDS.map((kind) => {
        const lines = statement.lines.filter((line) => line.kind === kind);
        if (!lines.length) return null;
        return (
          <PartnerSection key={kind} title={t(`kinds.${kind}`)}>
            <ul className="border-border divide-border divide-y rounded-xl border">
              {lines.map((line) => (
                <li key={line.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block">{line.description}</span>
                    <span className="text-muted text-sm">
                      {[
                        line.reference,
                        line.quantity !== null ? t("qty", { quantity: format.number(line.quantity) }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{format.thb(line.amount)}</span>
                </li>
              ))}
            </ul>
          </PartnerSection>
        );
      })}
    </PartnerPage>
  );
}
