import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerStats } from "@/features/partner/frame";
import { PeriodPicker } from "@/features/partner/period";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { Statement, type StatementRow } from "@/features/partner/statement";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";
import { cn } from "@/ui/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.reports"))("title") };
}

const TABS = ["tb", "gl", "pl", "bs", "cf", "stock"] as const;
type Tab = (typeof TABS)[number];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
type Section = Schemas["ErpGlStatementSectionDto"];
type Query = {
  tab?: string;
  month?: string;
  from?: string;
  to?: string;
  asOf?: string;
  account?: string;
  detail?: string;
};

/** Financial statements (D-391): one report per tab, each from the same posted lines. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const q = await searchParams;
  const tab: Tab = TABS.includes(q.tab as Tab) ? (q.tab as Tab) : "tb";
  const day = today();
  const month = q.month && MONTH.test(q.month) ? q.month : day.slice(0, 7);
  const from = q.from && DAY.test(q.from) ? q.from : `${day.slice(0, 7)}-01`;
  const to = q.to && DAY.test(q.to) ? q.to : day;
  const asOf = q.asOf && DAY.test(q.asOf) ? q.asOf : day;
  const account = q.account && /^[0-9A-Z][0-9A-Z.-]*$/.test(q.account) ? q.account : "1110";
  const [t, tc, tJournals, format, context] = await Promise.all([
    getTranslations("partnerLedger.reports"),
    getTranslations("partnerLedger.common"),
    getTranslations("partnerLedger.journals"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const base = "/v1/partner/factories/{factoryId}/erp/ledger/reports" as const;
  const read =
    tab === "tb"
      ? await attempt(async () => ({
          tb: (await contract.GET(`${base}/trial-balance`, { params: { path, query: { from, to } } })).data!,
        }))
      : tab === "gl"
        ? await attempt(async () => ({
            gl: (
              await contract.GET(`${base}/general-ledger`, {
                params: { path, query: { accountCode: account, from, to } },
              })
            ).data!,
          }))
        : tab === "pl"
          ? await attempt(async () => ({
              pl: (await contract.GET(`${base}/profit-and-loss`, { params: { path, query: { month } } })).data!,
            }))
          : tab === "bs"
            ? await attempt(async () => ({
                bs: (await contract.GET(`${base}/balance-sheet`, { params: { path, query: { asOf } } })).data!,
              }))
            : tab === "cf"
              ? await attempt(async () => ({
                  cf: (await contract.GET(`${base}/cash-flow`, { params: { path, query: { from, to } } })).data!,
                }))
              : await attempt(async () => ({
                  stock: (await contract.GET(`${base}/stock-valuation`, { params: { path, query: { asOf } } })).data!,
                }));
  const href = (extra: Record<string, string | undefined>) =>
    `/ledger/reports${queryOf({ tab: tab === "tb" ? undefined : tab, ...extra })}`;
  const detail = q.detail === "1";
  const range = `${format.date(from)} – ${format.date(to)}`;
  const sectionRows = (sections: Section[], after: Record<string, StatementRow[]> = {}): StatementRow[] =>
    sections.flatMap((s) => {
      const name = t(`sections.${s.key}` as never);
      const lines = s.lines.filter((l) => l.accounts.length);
      return [
        { key: `${s.key}-h`, label: name, kind: "heading" as const },
        ...lines.flatMap((l): StatementRow[] => [
          {
            key: `${s.key}-${l.key}`,
            label: t(`lines.${l.key}` as never),
            amount: format.thb(l.amount),
            comparative: l.comparative === null ? "—" : format.thb(l.comparative),
          },
          ...(detail
            ? l.accounts.map((a) => ({
                key: `${s.key}-${l.key}-${a.account.code}`,
                level: 2 as const,
                label: `${a.account.code} ${a.account.name}`,
                amount: format.thb(a.amount),
                href: `/ledger/reports${queryOf({ tab: "gl", account: a.account.code })}`,
              }))
            : []),
        ]),
        ...(lines.length ? [] : [{ key: `${s.key}-none`, label: t("noRows"), level: 1 as const }]),
        {
          key: `${s.key}-t`,
          kind: "subtotal" as const,
          label: t("sectionTotal", { section: name }),
          amount: format.thb(s.amount),
          comparative: s.comparative === null ? "—" : format.thb(s.comparative),
        },
        ...(after[s.key] ?? []),
      ];
    });
  const byAccount = (
    <Link
      href={href({ month: q.month, asOf: q.asOf, from: q.from, to: q.to, detail: detail ? undefined : "1" })}
      aria-pressed={detail}
      className={cn(
        "focus-visible:ring-focus-ring inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg px-2.5 text-sm font-medium outline-none focus-visible:ring-2 md:min-h-8",
        detail ? "bg-primary-subtle text-primary-subtle-fg" : "text-muted hover:bg-surface-subtle hover:text-fg",
      )}
    >
      <Icon name={detail ? "check" : "list-bullet"} size={16} aria-hidden />
      {t("byAccount")}
    </Link>
  );
  const fields =
    tab === "pl"
      ? [{ name: "month", label: tc("month"), value: month, type: "month" as const }]
      : tab === "bs" || tab === "stock"
        ? [{ name: "asOf", label: tc("asOf"), value: asOf, type: "date" as const }]
        : [
            ...(tab === "gl"
              ? [{ name: "account", label: t("glAccount"), value: account, type: "text" as const }]
              : []),
            { name: "from", label: tc("from"), value: from, type: "date" as const },
            { name: "to", label: tc("to"), value: to, type: "date" as const },
          ];
  const tbEmpty = (
    <EmptyState
      icon="chart"
      title={t("noRows")}
      action={
        <Button asChild variant="secondary" iconStart="list-ordered">
          <Link href="/ledger/journals">{tJournals("title")}</Link>
        </Button>
      }
    />
  );

  let body: React.ReactNode;
  if (!read.data) body = <PageError error={read.error} />;
  else if ("tb" in read.data) {
    const tb = read.data.tb;
    body = (
      <section className="flex flex-col gap-3" aria-label={t("tabs.tb")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted text-sm tabular-nums">{range}</p>
          <Badge tone={tb.balanced ? "success" : "danger"}>{tb.balanced ? t("balanced") : t("unbalanced")}</Badge>
        </div>
        <PartnerTable
          caption={t("tabs.tb")}
          rows={tb.rows}
          rowKey={(row) => row.account.code}
          rowHref={(row) => `/ledger/reports${queryOf({ tab: "gl", account: row.account.code, from, to })}`}
          empty={tbEmpty}
          columns={[
            {
              key: "c",
              header: t("code"),
              primary: true,
              cell: (row) => <span className="tabular-nums">{row.account.code}</span>,
            },
            { key: "n", header: tc("account"), cell: (row) => row.account.name },
            {
              key: "o",
              header: t("opening"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.thb(row.opening),
            },
            { key: "d", header: tc("debit"), align: "end", cell: (row) => format.thb(row.debit) },
            { key: "cr", header: tc("credit"), align: "end", cell: (row) => format.thb(row.credit) },
            { key: "cl", header: t("closing"), align: "end", cell: (row) => format.thb(row.closing) },
          ]}
        />
        {tb.rows.length ? (
          <dl className="border-border ms-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t pt-3 tabular-nums">
            <dt className="text-muted">{tc("debit")}</dt>
            <dd className="text-end font-semibold">{format.thb(tb.totalDebit)}</dd>
            <dt className="text-muted">{tc("credit")}</dt>
            <dd className="text-end font-semibold">{format.thb(tb.totalCredit)}</dd>
          </dl>
        ) : null}
      </section>
    );
  } else if ("gl" in read.data) {
    const gl = read.data.gl;
    body = (
      <>
        <PartnerStats
          label={t("tabs.gl")}
          columns={3}
          items={[
            { key: "a", label: tc("account"), value: `${gl.account.code} ${gl.account.name}` },
            { key: "o", label: t("opening"), value: format.thb(gl.opening) },
            { key: "c", label: t("closing"), value: format.thb(gl.closing), highlight: true },
          ]}
        />
        <PartnerTable
          caption={t("tabs.gl")}
          rows={gl.rows}
          rowKey={(row) => `${row.entryId}-${row.debit}-${row.credit}-${row.balance}`}
          rowHref={(row) => `/ledger/journals/${row.entryId}`}
          empty={tbEmpty}
          columns={[
            { key: "d", header: tc("date"), primary: true, cell: (row) => format.date(row.entryDate) },
            { key: "n", header: t("entryNo"), cell: (row) => <span className="tabular-nums">{row.entryNo}</span> },
            { key: "ds", header: tc("description"), hideOnPhone: true, cell: (row) => row.description },
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
            { key: "b", header: t("balance"), align: "end", cell: (row) => format.thb(row.balance) },
          ]}
        />
      </>
    );
  } else if ("pl" in read.data) {
    const pl = read.data.pl;
    // Gross profit sits under the cost of sales (and the factory overhead, when the statement has it).
    const costKeys = pl.sections
      .map((s) => s.key)
      .filter((k) => k === "cost_of_sales" || k === "manufacturing_overhead");
    const grossAfter = costKeys[costKeys.length - 1];
    body = (
      <>
        {byAccount}
        <Statement
          caption={t("tabs.pl")}
          title={t("tabs.pl")}
          period={format.date(`${pl.month.slice(0, 7)}-01`, { style: "month" })}
          headers={{ label: tc("account"), amount: t("thisMonth"), comparative: t("ytd") }}
          rows={[
            ...sectionRows(
              pl.sections,
              grossAfter
                ? {
                    [grossAfter]: [
                      { key: "gross", kind: "subtotal", label: t("grossProfit"), amount: format.thb(pl.grossProfit) },
                    ],
                  }
                : {},
            ),
            {
              key: "net",
              kind: "total",
              label: t("netProfit"),
              amount: format.thb(pl.netProfit),
              comparative: format.thb(pl.netProfitYtd),
            },
          ]}
        />
      </>
    );
  } else if ("bs" in read.data) {
    const bs = read.data.bs;
    body = (
      <>
        {byAccount}
        <Statement
          caption={t("tabs.bs")}
          title={t("tabs.bs")}
          period={`${tc("asOf")} ${format.date(bs.asOf)}`}
          status={
            <Badge tone={bs.balanced ? "success" : "danger"}>{bs.balanced ? t("inBalance") : t("bsUnbalanced")}</Badge>
          }
          headers={{
            label: tc("account"),
            amount: format.date(bs.asOf),
            comparative: `${t("comparative")} ${format.date(bs.comparativeAsOf)}`,
          }}
          rows={sectionRows(bs.sections)}
        />
      </>
    );
  } else if ("cf" in read.data) {
    const cf = read.data.cf;
    body = (
      <Statement
        caption={t("tabs.cf")}
        title={t("tabs.cf")}
        period={range}
        headers={{ label: tc("account"), amount: tc("amount") }}
        rows={[
          ...cf.sections.flatMap((s): StatementRow[] => {
            const name = t(`sections.${s.key}` as never);
            return [
              { key: `${s.key}-h`, kind: "heading", label: name },
              ...s.accounts.map((a) => ({
                key: `${s.key}-${a.account.code}`,
                label: `${a.account.code} ${a.account.name}`,
                amount: format.thb(a.amount),
                href: `/ledger/reports${queryOf({ tab: "gl", account: a.account.code, from, to })}`,
              })),
              ...(s.accounts.length ? [] : [{ key: `${s.key}-none`, label: t("noRows") }]),
              {
                key: `${s.key}-t`,
                kind: "subtotal",
                label: t("sectionTotal", { section: name }),
                amount: format.thb(s.amount),
              },
            ];
          }),
          { key: "net", kind: "subtotal", label: t("netChange"), amount: format.thb(cf.netChange) },
          { key: "open", level: 0, label: t("openingCash"), amount: format.thb(cf.openingCash) },
          { key: "close", kind: "total", label: t("closingCash"), amount: format.thb(cf.closingCash) },
        ]}
      />
    );
  } else {
    const stock = read.data.stock;
    body = (
      <>
        <PartnerStats
          label={t("tabs.stock")}
          columns={3}
          items={[
            { key: "s", label: t("stockValue"), value: format.thb(stock.stockValue) },
            { key: "l", label: t("ledgerBalance"), value: format.thb(stock.ledgerBalance) },
            {
              key: "d",
              label: t("difference"),
              value: format.thb(stock.difference),
              ...(stock.difference === "0.00" ? {} : { tone: "warning" as const, hint: t("stockHint") }),
            },
          ]}
        />
        <PartnerTable
          caption={t("tabs.stock")}
          rows={stock.rows}
          rowKey={(row) => row.kind}
          empty={tbEmpty}
          columns={[
            { key: "k", header: t("kind"), primary: true, cell: (row) => t(`itemKinds.${row.kind}` as never) },
            {
              key: "a",
              header: tc("account"),
              hideOnPhone: true,
              cell: (row) => <span className="tabular-nums">{row.account.code}</span>,
            },
            {
              key: "i",
              header: t("items"),
              align: "end",
              hideOnPhone: true,
              cell: (row) => format.number(row.items),
            },
            { key: "s", header: t("stockValue"), align: "end", cell: (row) => format.thb(row.stockValue) },
            { key: "l", header: t("ledgerBalance"), align: "end", cell: (row) => format.thb(row.ledgerBalance) },
            { key: "d", header: t("difference"), align: "end", cell: (row) => format.thb(row.difference) },
          ]}
        />
      </>
    );
  }

  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <ListToolbar>
        <ViewTabs
          label={t("tabs.label")}
          current={tab}
          items={TABS.map((key) => ({
            key,
            href: `/ledger/reports${queryOf({ tab: key === "tb" ? undefined : key })}`,
            label: t(`tabs.${key}`),
          }))}
        />
        <PeriodPicker
          action="/ledger/reports"
          label={tc("show")}
          hidden={{ tab, detail: detail ? "1" : undefined }}
          fields={fields}
          submit={tc("show")}
        />
      </ListToolbar>
      {body}
    </PartnerPage>
  );
}
