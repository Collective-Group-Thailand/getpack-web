import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { JOURNAL_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { JournalActions } from "@/features/partner/ledger/LedgerActions";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.journals"))("title") };
}

type Line = Schemas["ErpGlJournalLineDto"];

/** Where a source document opens in the ERP screens (drill-down, D-391). */
const SOURCE_HREF: Record<string, (id: string) => string> = {
  erp_goods_receipt: (id) => `/purchasing/receipts/${id}`,
  erp_supplier_invoice: (id) => `/payables/invoices/${id}`,
  erp_supplier_payment: (id) => `/payables/payments/${id}`,
  erp_production_order: (id) => `/planning/orders/${id}`,
  erp_sales_invoice: (id) => `/invoices/${id}`,
  erp_delivery_note: (id) => `/deliveries/${id}`,
  erp_customer_receipt: (id) => `/receivables/receipts/${id}`,
  erp_sales_note: (id) => `/invoices/notes/${id}`,
  erp_ncr: (id) => `/quality/ncrs/${id}`,
  erp_gl_journal_entry: (id) => `/ledger/journals/${id}`,
  erp_gl_fixed_asset: () => `/ledger/assets`,
  erp_gl_depreciation_run: () => `/ledger/assets`,
  erp_gl_bank_statement_line: () => `/ledger/bank`,
};

/** One journal entry (D-389): its lines and dimensions, the document it came from, and what may be done to it. */
export default async function JournalPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const [t, tc, tf, format, context] = await Promise.all([
    getTranslations("partnerLedger.journal"),
    getTranslations("partnerLedger.common"),
    getTranslations("partnerLedger.journals"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/journals/{entryId}", { params: { path: { factoryId: context.factoryId, entryId } } });
    return { journal: data!, etag: response.headers.get("etag") };
  });
  const back = { href: "/ledger/journals", label: t("back") };
  if (!read.data)
    return (
      <PartnerPage title={tf("title")} back={back}>
        <PageError error={read.error} />
      </PartnerPage>
    );
  const { journal: j, etag } = read.data;
  const doc = (d: { type: string; id: string; number: string | null } | null) => {
    if (!d) return null;
    const label = `${tc.has(`sources.${d.type}` as never) ? tc(`sources.${d.type}` as never) : d.type} ${d.number ?? ""}`;
    const href = SOURCE_HREF[d.type]?.(d.id);
    return href ? <Link href={href} className="text-link">{label}</Link> : label;
  };
  const dims = (l: Line) =>
    [
      l.item ? `${t("dims.item")}: ${l.item.name}` : null,
      l.partner ? `${t("dims.partner")}: ${l.partner.name}` : null,
      l.warehouse ? `${t("dims.warehouse")}: ${l.warehouse.name}` : null,
      l.productionOrder ? `${t("dims.productionOrder")}: ${l.productionOrder.code}` : null,
      l.machine ? `${t("dims.machine")}: ${l.machine.name}` : null,
      l.bankAccount ? `${t("dims.bankAccount")}: ${l.bankAccount.name}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const facts: [string, React.ReactNode][] = [
    [t("documentDate"), format.date(j.documentDate)],
    [t("entryDate"), format.date(j.entryDate)],
    [tf("kind"), tc(`kinds.${j.kind}` as never)],
    ...(j.source ? ([[tf("source"), doc(j.source)]] as [string, React.ReactNode][]) : []),
    ...(j.ruleKey ? ([[tf("rule"), j.ruleKey]] as [string, React.ReactNode][]) : []),
    ...(j.reverses ? ([[t("reverses"), doc(j.reverses)]] as [string, React.ReactNode][]) : []),
    ...(j.reversedBy ? ([[t("reversedBy"), doc(j.reversedBy)]] as [string, React.ReactNode][]) : []),
    ...(j.autoReverseOn ? ([[t("autoReverseOn"), format.date(j.autoReverseOn)]] as [string, React.ReactNode][]) : []),
    [t("createdBy"), j.createdBy ?? "—"],
    ...(j.approvedBy ? ([[t("approvedBy"), j.approvedBy]] as [string, React.ReactNode][]) : []),
    ...(j.postedAt ? ([[t("postedAt"), format.dateTime(j.postedAt)]] as [string, React.ReactNode][]) : []),
    ...(j.rejectionReason ? ([[t("rejection"), j.rejectionReason]] as [string, React.ReactNode][]) : []),
  ];
  return (
    <PartnerPage
      wide
      title={j.entryNo ? t("title", { no: j.entryNo }) : t("draftTitle")}
      description={j.description}
      back={back}
      meta={<StatusChip map={JOURNAL_STATUS} value={j.status} size="md" />}
    >
      <JournalActions journal={j} etag={etag} />
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <PartnerSection title={t("lines")}>
        <PartnerTable
          caption={t("lines")}
          rows={j.lines}
          rowKey={(row) => String(row.lineNo)}
          columns={[
            { key: "a", header: tc("account"), primary: true, cell: (row) => <span><span className="font-mono">{row.account.code}</span> {row.account.name}</span> },
            { key: "d", header: tc("description"), hideOnPhone: true, cell: (row) => <span className="text-sm">{[row.description, dims(row)].filter(Boolean).join(" — ") || "—"}</span> },
            { key: "dr", header: tc("debit"), align: "end", cell: (row) => (row.debit === "0.00" ? "" : format.thb(row.debit)) },
            { key: "cr", header: tc("credit"), align: "end", cell: (row) => (row.credit === "0.00" ? "" : format.thb(row.credit)) },
          ]}
        />
        <p className="text-end text-sm font-medium">
          {tc("total")} {format.thb(j.totalDebit)} / {format.thb(j.totalCredit)}
        </p>
      </PartnerSection>
    </PartnerPage>
  );
}
