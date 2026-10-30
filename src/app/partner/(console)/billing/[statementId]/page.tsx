import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BILLING_STATEMENT_STATUS, INPUT_VAT_STATUS, VENDOR_INVOICE_STATUS } from "@/domain/status";
import { blockedReason, offered } from "@/features/partner/account/offered";
import { PartnerFileButton } from "@/features/partner/account/files";
import { ConfirmStatement, DisputeStatement, ErpTaxInvoice, TaxInvoiceForm } from "@/features/partner/billing/actions";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PostedEntries } from "@/features/partner/ledger/PostedEntries";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { StatusChip } from "@/features/partner/status";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

type Props = { params: Promise<{ statementId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerBilling.detail"))("metaTitle") };
}

const KINDS = [
  "production",
  "shipping",
  "mockup",
  "design",
  "reproduction",
  "deduction",
] as const satisfies readonly Schemas["BillingStatementLineKind"][];

/**
 * One billing statement (D-090, `partner.payables.getStatement`): its lines by kind — goods received
 * at the PO's price (min(delivered, ordered), D-165), shipping, claim deductions — the totals with VAT
 * and the advance already paid, then confirm or dispute and the factory's own tax invoice, each shown
 * only when the API offers it (`nextActions`). Input VAT is getpack's to claim once that invoice is
 * validated (accounting-design §2).
 */
export default async function StatementPage({ params }: Props) {
  const { statementId } = await params;
  const t = await getTranslations("partnerBilling.detail");
  const tSales = await getTranslations("partnerSales.common");
  const tProblems = await getTranslations("problems");
  const format = await getFormat();
  const context = await factoryContext();
  const { contract } = await partnerServerApis();
  const found = await attempt(
    async () =>
      (await contract.GET("/v1/partner/billing-statements/{statementId}", { params: { path: { statementId } } })).data!,
  );
  const back = { href: "/billing", label: t("back") };
  if (!found.data)
    return (
      <PartnerPage title={t("metaTitle")} back={back}>
        <PageError error={found.error} />
      </PartnerPage>
    );
  const statement = found.data;
  const confirm = offered(statement.nextActions, "billing_statement.confirm");
  const dispute = offered(statement.nextActions, "billing_statement.dispute");
  const invoice = offered(statement.nextActions, "billing_statement.submit_tax_invoice");
  const blocked = [confirm, dispute, invoice]
    .map((action) => blockedReason(action, tProblems))
    .filter((reason): reason is string => reason !== null);
  const open = (action: typeof confirm) => Boolean(action && !action.disabledReason);
  // D-433: a factory on getpack's ERP issues (or hands over) its invoice to getpack from there.
  const fromErp =
    statement.status === "confirmed" &&
    canAt(context, "factory_payables.manage") &&
    canAt(context, "factory_receivables.read");

  return (
    <PartnerPage
      title={statement.bsNumber}
      back={back}
      status={
        <>
          <StatusChip map={BILLING_STATEMENT_STATUS} value={statement.status} size="md" />
          {statement.taxInvoiceStatus !== "none" ? (
            <StatusChip map={VENDOR_INVOICE_STATUS} value={statement.taxInvoiceStatus} size="md" />
          ) : null}
          {statement.inputVatStatus ? (
            <StatusChip map={INPUT_VAT_STATUS} value={statement.inputVatStatus} size="md" />
          ) : null}
        </>
      }
      description={
        statement.periodFrom === statement.periodTo
          ? t("periodDay", { date: format.date(statement.periodFrom) })
          : t("period", { from: format.date(statement.periodFrom), to: format.date(statement.periodTo) })
      }
      meta={<p className="text-muted text-sm">{t("generatedAt", { date: format.dateTime(statement.generatedAt) })}</p>}
      full
    >
      {/* The statement as a document on the left; what it comes to and the one thing to do now on the right. */}
      <PartnerDetail
        aside={
          <ActionPanel
            id="bs-next"
            tone={open(confirm) || open(dispute) || open(invoice) ? "primary" : "neutral"}
            title={
              open(confirm) || open(dispute) ? t("checkTitle") : open(invoice) ? t("invoiceTitle") : tSales("nextSteps")
            }
            description={open(confirm) || open(dispute) ? t("checkBody") : open(invoice) ? t("invoiceBody") : undefined}
          >
            <dl
              className={cn(
                "grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 border-b pb-3",
                open(confirm) || open(dispute) || open(invoice) ? "border-primary-subtle-fg/20" : "border-border",
              )}
            >
              <dt className="text-sm">{t("gross")}</dt>
              <dd className="text-end text-xl font-semibold tabular-nums">{format.thb(statement.totals.gross)}</dd>
              <dt className="text-sm">{t("remaining")}</dt>
              <dd className="text-end font-semibold tabular-nums">{format.thb(statement.totals.remaining)}</dd>
            </dl>
            {open(confirm) || open(dispute) ? (
              <div data-fill="row" className="flex flex-col gap-2">
                {open(confirm) ? (
                  <ConfirmStatement
                    statementId={statement.id}
                    bsNumber={statement.bsNumber}
                    gross={format.thb(statement.totals.gross)}
                  />
                ) : null}
                {open(dispute) ? (
                  <DisputeStatement
                    statementId={statement.id}
                    bsNumber={statement.bsNumber}
                    lines={statement.lines.map((line) => ({
                      lineNo: line.lineNo,
                      label: t("lineLabel", { no: line.lineNo, description: line.description }),
                    }))}
                  />
                ) : null}
              </div>
            ) : open(invoice) ? (
              <div data-fill="row" className="flex flex-col gap-2">
                <Button asChild size="xl" iconStart="receipt">
                  <a href="#bs-invoice">{t("invoiceTitle")}</a>
                </Button>
              </div>
            ) : null}
          </ActionPanel>
        }
      >
        {statement.status === "disputed" && statement.disputeNote ? (
          <Callout tone="warning" icon="flag" title={t("disputedTitle")}>
            {statement.disputeNote}
            {statement.disputedLineNos.length ? (
              <span className="mt-1 block text-sm">
                {t("disputedLines", { lines: statement.disputedLineNos.map((no) => `#${no}`).join(", ") })}
              </span>
            ) : null}
          </Callout>
        ) : null}
        {statement.confirmedAt && statement.confirmedBy ? (
          <Callout tone="success" icon="check">
            {t("confirmedBy", {
              name: statement.confirmedBy.displayName,
              date: format.dateTime(statement.confirmedAt),
            })}
          </Callout>
        ) : null}
        {blocked.length ? (
          <Callout tone="warning" icon="warning">
            {blocked.join(" · ")}
          </Callout>
        ) : null}

        <PartnerSection title={t("linesTitle")}>
          <PartnerTable
            caption={t("linesTitle")}
            rows={KINDS.flatMap((kind) => statement.lines.filter((line) => line.kind === kind))}
            rowKey={(line) => String(line.lineNo)}
            rowTone={(line) => (statement.disputedLineNos.includes(line.lineNo) ? "warning" : undefined)}
            columns={[
              {
                key: "no",
                header: "#",
                cell: (line) => <span className="text-muted text-sm tabular-nums">{line.lineNo}</span>,
                className: "w-[1%]",
              },
              {
                key: "item",
                header: t("table.item"),
                primary: true,
                cell: (line) => (
                  <span className="flex flex-col">
                    <span>
                      {line.description}
                      {statement.disputedLineNos.includes(line.lineNo) ? (
                        <Badge size="sm" tone="warning" className="ms-2">
                          {t("disputedBadge")}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-muted text-sm">{t(`kinds.${line.kind}`)}</span>
                  </span>
                ),
              },
              {
                key: "ref",
                header: t("table.ref"),
                cell: (line) => <span className="text-sm tabular-nums">{line.reference ?? "—"}</span>,
              },
              {
                key: "qty",
                header: t("table.qty"),
                align: "end",
                cell: (line) => (line.quantity !== null ? format.number(line.quantity) : "—"),
              },
              { key: "vat", header: t("table.vat"), align: "end", cell: (line) => format.thb(line.vatAmount) },
              {
                key: "net",
                header: t("table.net"),
                align: "end",
                cell: (line) => <span className="font-semibold">{format.thb(line.netAmount)}</span>,
              },
            ]}
          />
          {/* Under the lines, as on an invoice: amounts right-aligned, subtotals ruled off. */}
          <section aria-label={t("totals")} className="ms-auto w-full max-w-md">
            <dl className="flex flex-col tabular-nums">
              {[
                { term: t("production"), amount: statement.totals.production },
                { term: t("shipping"), amount: statement.totals.shipping },
                ...(statement.totals.other !== "0.00" ? [{ term: t("other"), amount: statement.totals.other }] : []),
                { term: t("deductions"), amount: statement.totals.deductions },
                { term: t("net"), amount: statement.totals.net, rule: true },
                { term: t("vat"), amount: statement.totals.vat },
                { term: t("gross"), amount: statement.totals.gross, rule: true, strong: true },
                { term: t("alreadyPaid"), amount: statement.totals.alreadyPaid },
                { term: t("remaining"), amount: statement.totals.remaining, rule: true, strong: true },
              ].map((row) => (
                <div
                  key={row.term}
                  className={cn(
                    "flex items-baseline justify-between gap-4 py-1.5",
                    row.rule && "border-border mt-1 border-t pt-2.5",
                    row.strong && "text-lg font-semibold",
                  )}
                >
                  <dt className={row.strong ? undefined : "text-muted"}>{row.term}</dt>
                  <dd>{format.thb(row.amount)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </PartnerSection>
        {open(invoice) ? (
          <PartnerSection id="bs-invoice" title={t("invoiceTitle")} description={t("invoiceBody")}>
            {open(confirm) ? (
              // Usually after the amounts are confirmed: folded until then so the page asks one thing.
              <details className="border-border bg-surface rounded-xl border">
                <summary className="hover:bg-surface-subtle flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 font-medium md:min-h-10">
                  <Icon name="receipt" size={18} />
                  {t("invoiceAfterConfirm")}
                </summary>
                <div className="border-border border-t p-4">
                  <TaxInvoiceForm
                    statementId={statement.id}
                    taxId={context.factory?.taxId ?? ""}
                    branchCode={context.factory?.branchCode ?? "00000"}
                    expected={{ net: statement.totals.net, vat: statement.totals.vat }}
                  />
                </div>
              </details>
            ) : (
              <>
                {fromErp ? (
                  <Card padding="md" className="flex flex-col gap-3">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <Icon name="receipt" size={18} />
                      {t("erpTitle")}
                    </h3>
                    <ErpTaxInvoice
                      statementId={statement.id}
                      bsNumber={statement.bsNumber}
                      gross={format.thb(statement.totals.gross)}
                      grossAmount={statement.totals.gross}
                      canIssue={canAt(context, "factory_receivables.manage")}
                    />
                  </Card>
                ) : null}
                {fromErp ? <p className="text-muted text-sm">{t("orUpload")}</p> : null}
                <Card padding="md">
                  <TaxInvoiceForm
                    statementId={statement.id}
                    taxId={context.factory?.taxId ?? ""}
                    branchCode={context.factory?.branchCode ?? "00000"}
                    expected={{ net: statement.totals.net, vat: statement.totals.vat }}
                  />
                </Card>
              </>
            )}
          </PartnerSection>
        ) : null}

        {statement.taxInvoices.length ? (
          <PartnerSection title={t("invoices")}>
            <ul className="flex flex-col gap-2">
              {statement.taxInvoices.map((item) => (
                <li key={item.id}>
                  <Card padding="md" className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {t("invoiceLine", { no: item.vendorInvoiceNo, date: format.date(item.invoiceDate) })}
                      </span>
                      <span className="text-muted text-sm">
                        {t(`sources.${item.source}`)} ·{" "}
                        {t("invoiceAmounts", {
                          net: format.thb(item.netAmount),
                          vat: format.thb(item.vatAmount),
                          gross: format.thb(item.grossAmount),
                        })}
                      </span>
                      {item.rejectionReason ? (
                        <span className="text-danger block text-sm">{item.rejectionReason}</span>
                      ) : null}
                    </span>
                    <StatusChip map={VENDOR_INVOICE_STATUS} value={item.status} />
                    {item.fileId ? <PartnerFileButton fileId={item.fileId} label={t("download")} /> : null}
                  </Card>
                </li>
              ))}
            </ul>
          </PartnerSection>
        ) : null}
        <PostedEntries sourceId={statement.id} />
      </PartnerDetail>
    </PartnerPage>
  );
}
