import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ERP_GL_BANK_LINE_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { BankAccountButton, ImportStatement } from "@/features/partner/ledger/AssetBankForms";
import { BankLineActions } from "@/features/partner/ledger/LedgerActions";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.bank"))("title") };
}

const VIEWS = ["open", "matched", "ignored", "all"] as const;
type View = (typeof VIEWS)[number];

/** Bank and reconciliation (D-394): the cash position, the accounts, the statement lines to match. */
export default async function BankPage({ searchParams }: { searchParams: Promise<{ view?: string; bank?: string; page?: string }> }) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const [t, tc, format, context] = await Promise.all([getTranslations("partnerLedger.bank"), getTranslations("partnerLedger.common"), getFormat(), factoryContext()]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const canPost = canAt(context, "factory_ledger.post");
  const canConfigure = canAt(context, "factory_ledger.configure");
  const [position, lines] = await Promise.all([
    attempt(async () => (await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/cash-position", { params: { path } })).data!),
    attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/ledger/bank-lines", {
            params: { path, query: { page, perPage: 25, ...(view === "all" ? {} : { status: view }), ...(query.bank ? { bankAccountId: query.bank } : {}) } },
          })
        ).data!,
    ),
  ]);
  const href = (next: Record<string, string | number | undefined>) => `/ledger/bank${queryOf({ view: view === "open" ? undefined : view, bank: query.bank, ...next })}`;
  return (
    <PartnerPage full title={t("title")} description={t("body")} actions={canConfigure ? <BankAccountButton /> : null}>
      {position.data ? (
        <>
          <StatStrip
            label={t("position")}
            items={[
              { key: "t", label: t("total"), value: format.thb(position.data.total), tone: "success" },
              {
                key: "c",
                label: t("cashOnHand"),
                value: format.thb(position.data.cashOnHand),
                // Cash in hand below zero is always a missing or wrong entry.
                ...(position.data.cashOnHand.startsWith("-")
                  ? { tone: "danger" as const, hint: t("cashNegative"), href: "/ledger/reports?tab=gl&account=1110" }
                  : {}),
              },
              { key: "p", label: t("payables7d"), value: format.thb(position.data.payablesDue7d), href: "/payables" },
              { key: "r", label: t("receivables7d"), value: format.thb(position.data.receivablesDue7d), href: "/receivables" },
            ]}
          />
          <PartnerSection title={t("accounts")}>
            <PartnerTable
              caption={t("accounts")}
              rows={position.data.banks}
              rowKey={(row) => row.account.id}
              rowHref={(row) => href({ bank: row.account.id, page: undefined })}
              empty={<EmptyState icon="credit-card" title={t("noAccounts")} description={t("noAccountsBody")} />}
              columns={[
                {
                  key: "n",
                  header: t("name"),
                  primary: true,
                  cell: (row) => (
                    <span>
                      {row.account.bankName} {row.account.name} <span className="font-mono">{t("masked", { last4: row.account.accountNoLast4 })}</span>
                    </span>
                  ),
                },
                { key: "d", header: "", hideOnPhone: true, cell: (row) => (row.account.isDefault ? <Badge tone="info">{t("default")}</Badge> : null) },
                { key: "gl", header: tc("account"), hideOnPhone: true, cell: (row) => <span className="font-mono">{row.account.glAccount.code}</span> },
                { key: "b", header: t("ledgerBalance"), align: "end", cell: (row) => format.thb(row.account.ledgerBalance) },
                { key: "u", header: t("unreconciled"), align: "end", cell: (row) => format.thb(row.unreconciled) },
                { key: "o", header: t("openLines"), align: "end", hideOnPhone: true, cell: (row) => format.number(row.account.openLines) },
                { key: "l", header: t("lastStatement"), hideOnPhone: true, cell: (row) => (row.account.lastStatementDate ? format.date(row.account.lastStatementDate) : "—") },
                {
                  key: "x",
                  header: "",
                  cell: (row) => (
                    <div className="relative z-10 flex flex-wrap gap-2">
                      {canPost && row.account.nextActions.some((a) => a.key === "erp_bank.import") ? <ImportStatement bank={row.account} /> : null}
                      {canConfigure ? <BankAccountButton bank={row.account} /> : null}
                    </div>
                  ),
                },
              ]}
            />
          </PartnerSection>
        </>
      ) : (
        <PageError error={position.error} />
      )}
      <PartnerSection title={t("lines")}>
        <ViewTabs label={t("views.label")} current={view} items={VIEWS.map((key) => ({ key, href: `/ledger/bank${queryOf({ view: key === "open" ? undefined : key, bank: query.bank })}`, label: t(`views.${key}`) }))} />
        {lines.data ? (
          <>
            <PartnerTable
              caption={t("lines")}
              rows={lines.data.data}
              rowKey={(row) => row.id}
              empty={<EmptyState icon="credit-card" title={t("noLines")} description={t("noLinesBody")} />}
              columns={[
                { key: "d", header: tc("date"), primary: true, cell: (row) => format.date(row.txnDate) },
                { key: "ds", header: tc("description"), cell: (row) => row.description },
                { key: "r", header: t("reference"), hideOnPhone: true, cell: (row) => <span className="font-mono text-xs">{row.reference ?? "—"}</span> },
                { key: "a", header: tc("amount"), align: "end", cell: (row) => <span className={row.amount.startsWith("-") ? "text-danger" : "text-success"}>{format.thb(row.amount)}</span> },
                { key: "s", header: tc("status"), cell: (row) => <StatusChip map={ERP_GL_BANK_LINE_STATUS} value={row.status} /> },
                {
                  key: "m",
                  header: t("matchedTo"),
                  hideOnPhone: true,
                  cell: (row) =>
                    row.status === "ignored"
                      ? row.ignoreReason
                      : row.matches.map((m) => `${t(`targets.${m.targetType}` as never)} ${m.targetNo ?? m.entry?.number ?? ""}`).join(", ") || "—",
                },
                {
                  key: "x",
                  header: "",
                  cell: (row) => (
                    <BankLineActions line={row} />
                  ),
                },
              ]}
            />
            <Pager page={page} perPage={lines.data.meta.perPage} total={lines.data.meta.total} hrefFor={(p) => href({ page: p })} labels={{ nav: tc("pages"), previous: tc("previous"), next: tc("next"), page: (n) => tc("page", { n }) }} />
          </>
        ) : (
          <PageError error={lines.error} />
        )}
      </PartnerSection>
    </PartnerPage>
  );
}
