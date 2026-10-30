import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { JOURNAL_STATUS } from "@/domain/status";
import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { ActionPanel, PageError, PartnerDetail, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { JournalActions } from "@/features/partner/ledger/LedgerActions";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";

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
  billing_statement: (id) => `/billing/${id}`,
  payout_item: (id) => `/payouts/${id}`,
};

/** One journal entry (D-389): its lines and dimensions, the document it came from, and what may be done to it. */
export default async function JournalPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const [t, tc, tf, tSales, format, context] = await Promise.all([
    getTranslations("partnerLedger.journal"),
    getTranslations("partnerLedger.common"),
    getTranslations("partnerLedger.journals"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = await attempt(async () => {
    const { data, response } = await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/journals/{entryId}", {
      params: { path: { factoryId: context.factoryId, entryId } },
    });
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
  // An account opens its general ledger for the entry's month.
  const [y, m] = j.entryDate.split("-").map(Number) as [number, number];
  const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const glHref = (code: string) =>
    `/ledger/reports?tab=gl&account=${code}&from=${j.entryDate.slice(0, 7)}-01&to=${monthEnd}`;
  // The rule that posted it opens its versions (D-398).
  const ruleId = j.ruleKey
    ? (
        await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/rules", {
                params: { path: { factoryId: context.factoryId } },
              })
            ).data!,
        )
      ).data?.find((r) => r.key === j.ruleKey)?.id
    : undefined;
  const doc = (d: { type: string; id: string; number: string | null } | null) => {
    if (!d) return null;
    const label = `${tc.has(`sources.${d.type}` as never) ? tc(`sources.${d.type}` as never) : d.type} ${d.number ?? ""}`;
    const href = SOURCE_HREF[d.type]?.(d.id);
    return href ? (
      <Link href={href} className="text-primary underline-offset-4 hover:underline">
        {label}
      </Link>
    ) : (
      label
    );
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
    ...(j.ruleKey
      ? ([
          [
            tf("rule"),
            ruleId ? (
              <Link
                key="rule"
                href={`/ledger/accounts/rules/${ruleId}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {j.ruleKey}
              </Link>
            ) : (
              j.ruleKey
            ),
          ],
        ] as [string, React.ReactNode][])
      : []),
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
      full
      title={j.entryNo ? t("title", { no: j.entryNo }) : t("draftTitle")}
      description={j.description}
      back={back}
      status={<StatusChip map={JOURNAL_STATUS} value={j.status} size="md" />}
    >
      {/* The entry as a voucher on the left; its totals and what may be done to it on the right. */}
      <PartnerDetail
        aside={
          <ActionPanel
            id="journal-next"
            tone={j.nextActions.some((a) => !a.disabledReason && /submit|approve/.test(a.key)) ? "primary" : "neutral"}
            title={tSales("nextSteps")}
          >
            <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
              <dt className="text-sm">{tc("debit")}</dt>
              <dd className="text-end text-lg font-semibold tabular-nums">{format.thb(j.totalDebit)}</dd>
              <dt className="text-sm">{tc("credit")}</dt>
              <dd className="text-end text-lg font-semibold tabular-nums">{format.thb(j.totalCredit)}</dd>
            </dl>
            <JournalActions journal={j} etag={etag} layout="panel" />
          </ActionPanel>
        }
      >
        <Card padding="md">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col">
                <dt className="text-muted">{k}</dt>
                <dd className="[overflow-wrap:anywhere]">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <PartnerSection title={t("lines")}>
          <PartnerTable
            caption={t("lines")}
            rows={j.lines}
            rowKey={(row) => String(row.lineNo)}
            columns={[
              {
                key: "a",
                header: tc("account"),
                primary: true,
                cell: (row) => (
                  <Link
                    href={glHref(row.account.code)}
                    className="text-primary underline-offset-4 hover:underline"
                    title={t("accountMonth")}
                  >
                    <span className="tabular-nums">{row.account.code}</span> {row.account.name}
                  </Link>
                ),
              },
              {
                key: "d",
                header: tc("description"),
                hideOnPhone: true,
                cell: (row) => (
                  <span className="text-sm">{[row.description, dims(row)].filter(Boolean).join(" — ") || "—"}</span>
                ),
              },
              {
                key: "dr",
                header: tc("debit"),
                align: "end",
                cell: (row) => (row.debit === "0.00" ? "" : format.thb(row.debit)),
              },
              {
                key: "cr",
                header: tc("credit"),
                align: "end",
                cell: (row) => (row.credit === "0.00" ? "" : format.thb(row.credit)),
              },
            ]}
          />
          <dl className="border-border ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t pt-3 tabular-nums">
            <dt className="text-muted">{tc("debit")}</dt>
            <dd className="text-end font-semibold">{format.thb(j.totalDebit)}</dd>
            <dt className="text-muted">{tc("credit")}</dt>
            <dd className="text-end font-semibold">{format.thb(j.totalCredit)}</dd>
          </dl>
        </PartnerSection>
      </PartnerDetail>
    </PartnerPage>
  );
}
