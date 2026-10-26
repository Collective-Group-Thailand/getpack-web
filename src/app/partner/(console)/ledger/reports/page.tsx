import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { attempt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { StatStrip, ViewTabs } from "@/features/partner/rows";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Input } from "@/ui/components/Input";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerLedger.reports"))("title") };
}

const TABS = ["tb", "gl", "pl", "bs", "cf", "stock"] as const;
type Tab = (typeof TABS)[number];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
type Section = Schemas["ErpGlStatementSectionDto"];
type Query = { tab?: string; month?: string; from?: string; to?: string; asOf?: string; account?: string };

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
  const [t, tc, format, context] = await Promise.all([
    getTranslations("partnerLedger.reports"),
    getTranslations("partnerLedger.common"),
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
  const field = (name: string, label: string, value: string, type: "date" | "month" | "text") => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input type={type} name={name} defaultValue={value} className="w-44" />
    </label>
  );
  const sectionTable = (sections: Section[], comparative: string) => (
    <div className="flex flex-col gap-4">
      {sections.map((s) => (
        <PartnerSection key={s.key} title={t(`sections.${s.key}` as never)}>
          <PartnerTable
            caption={t(`sections.${s.key}` as never)}
            rows={s.lines.filter((l) => l.accounts.length)}
            rowKey={(row) => row.key}
            empty={<p className="text-muted text-sm">{t("noRows")}</p>}
            columns={[
              {
                key: "l",
                header: t(`sections.${s.key}` as never),
                primary: true,
                cell: (row) => t(`lines.${row.key}` as never),
              },
              {
                key: "a",
                header: tab === "pl" ? t("thisMonth") : tc("asOf"),
                align: "end",
                cell: (row) => format.thb(row.amount),
              },
              {
                key: "c",
                header: comparative,
                align: "end",
                hideOnPhone: true,
                cell: (row) => (row.comparative === null ? "—" : format.thb(row.comparative)),
              },
            ]}
          />
          <p className="text-end text-sm font-semibold">
            {tc("total")} {format.thb(s.amount)}
          </p>
          <details className="text-sm">
            <summary className="text-link cursor-pointer">{t("byAccount")}</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {s.lines
                .flatMap((l) => l.accounts)
                .map((a) => (
                  <li key={a.account.id + a.account.code} className="flex justify-between gap-4">
                    <Link
                      className="text-link"
                      href={`/ledger/reports${queryOf({ tab: "gl", account: a.account.code })}`}
                    >
                      <span className="tabular-nums">{a.account.code}</span> {a.account.name}
                    </Link>
                    <span>{format.thb(a.amount)}</span>
                  </li>
                ))}
            </ul>
          </details>
        </PartnerSection>
      ))}
    </div>
  );

  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <ViewTabs
        label={t("tabs.label")}
        current={tab}
        items={TABS.map((key) => ({
          key,
          href: `/ledger/reports${queryOf({ tab: key === "tb" ? undefined : key })}`,
          label: t(`tabs.${key}`),
        }))}
      />
      <form className="flex flex-wrap items-end gap-2" action="/ledger/reports">
        <input type="hidden" name="tab" value={tab} />
        {tab === "pl" ? field("month", tc("month"), month, "month") : null}
        {tab === "bs" || tab === "stock" ? field("asOf", tc("asOf"), asOf, "date") : null}
        {tab === "tb" || tab === "gl" || tab === "cf" ? (
          <>
            {tab === "gl" ? field("account", t("glAccount"), account, "text") : null}
            {field("from", tc("from"), from, "date")}
            {field("to", tc("to"), to, "date")}
          </>
        ) : null}
        <Button type="submit" variant="secondary">
          {tc("show")}
        </Button>
      </form>
      {!read.data ? (
        <PageError error={read.error} />
      ) : "tb" in read.data ? (
        <>
          <Badge tone={read.data.tb.balanced ? "success" : "danger"}>
            {read.data.tb.balanced ? t("balanced") : t("unbalanced")}
          </Badge>
          <PartnerTable
            caption={t("tabs.tb")}
            rows={read.data.tb.rows}
            rowKey={(row) => row.account.code}
            rowHref={(row) => `/ledger/reports${queryOf({ tab: "gl", account: row.account.code, from, to })}`}
            empty={<EmptyState icon="chart" title={t("noRows")} />}
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
          <p className="text-end text-sm font-semibold">
            {tc("debit")} {format.thb(read.data.tb.totalDebit)} · {tc("credit")} {format.thb(read.data.tb.totalCredit)}
          </p>
        </>
      ) : "gl" in read.data ? (
        <>
          <StatStrip
            label={t("tabs.gl")}
            items={[
              { key: "a", label: tc("account"), value: `${read.data.gl.account.code} ${read.data.gl.account.name}` },
              { key: "o", label: t("opening"), value: format.thb(read.data.gl.opening) },
              { key: "c", label: t("closing"), value: format.thb(read.data.gl.closing) },
            ]}
          />
          <PartnerTable
            caption={t("tabs.gl")}
            rows={read.data.gl.rows}
            rowKey={(row) => `${row.entryId}-${row.debit}-${row.credit}-${row.balance}`}
            rowHref={(row) => `/ledger/journals/${row.entryId}`}
            empty={<EmptyState icon="list-ordered" title={t("noRows")} />}
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
      ) : "pl" in read.data ? (
        <>
          <StatStrip
            label={t("tabs.pl")}
            items={[
              { key: "r", label: t("sections.revenue"), value: format.thb(read.data.pl.revenue) },
              { key: "g", label: t("grossProfit"), value: format.thb(read.data.pl.grossProfit) },
              { key: "e", label: t("expenses"), value: format.thb(read.data.pl.expenses) },
              {
                key: "n",
                label: t("netProfit"),
                value: format.thb(read.data.pl.netProfit),
                tone: read.data.pl.netProfit.startsWith("-") ? "danger" : "success",
              },
              { key: "y", label: t("ytd"), value: format.thb(read.data.pl.netProfitYtd) },
            ]}
          />
          {sectionTable(read.data.pl.sections, t("ytd"))}
        </>
      ) : "bs" in read.data ? (
        <>
          <StatStrip
            label={t("tabs.bs")}
            items={[
              { key: "a", label: t("totalAssets"), value: format.thb(read.data.bs.totalAssets) },
              { key: "l", label: t("totalLiabilities"), value: format.thb(read.data.bs.totalLiabilities) },
              { key: "e", label: t("totalEquity"), value: format.thb(read.data.bs.totalEquity) },
              {
                key: "b",
                label: t("bsBalanced"),
                value: read.data.bs.balanced ? t("inBalance") : t("bsUnbalanced"),
                tone: read.data.bs.balanced ? "success" : "danger",
              },
            ]}
          />
          {sectionTable(read.data.bs.sections, `${t("comparative")} ${format.date(read.data.bs.comparativeAsOf)}`)}
        </>
      ) : "cf" in read.data ? (
        <>
          <StatStrip
            label={t("tabs.cf")}
            items={[
              { key: "o", label: t("openingCash"), value: format.thb(read.data.cf.openingCash) },
              { key: "n", label: t("netChange"), value: format.thb(read.data.cf.netChange) },
              { key: "c", label: t("closingCash"), value: format.thb(read.data.cf.closingCash) },
            ]}
          />
          {read.data.cf.sections.map((s) => (
            <PartnerSection key={s.key} title={t(`sections.${s.key}` as never)}>
              <PartnerTable
                caption={t(`sections.${s.key}` as never)}
                rows={s.accounts}
                rowKey={(row) => row.account.code}
                empty={<p className="text-muted text-sm">{t("noRows")}</p>}
                columns={[
                  {
                    key: "a",
                    header: tc("account"),
                    primary: true,
                    cell: (row) => (
                      <span>
                        <span className="tabular-nums">{row.account.code}</span> {row.account.name}
                      </span>
                    ),
                  },
                  { key: "v", header: tc("amount"), align: "end", cell: (row) => format.thb(row.amount) },
                ]}
              />
              <p className="text-end text-sm font-semibold">
                {tc("total")} {format.thb(s.amount)}
              </p>
            </PartnerSection>
          ))}
        </>
      ) : (
        <>
          <StatStrip
            label={t("tabs.stock")}
            items={[
              { key: "s", label: t("stockValue"), value: format.thb(read.data.stock.stockValue) },
              { key: "l", label: t("ledgerBalance"), value: format.thb(read.data.stock.ledgerBalance) },
              {
                key: "d",
                label: t("difference"),
                value: format.thb(read.data.stock.difference),
                tone: read.data.stock.difference === "0.00" ? "success" : "warning",
              },
            ]}
          />
          <PartnerTable
            caption={t("tabs.stock")}
            rows={read.data.stock.rows}
            rowKey={(row) => row.kind}
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
          {read.data.stock.difference !== "0.00" ? <p className="text-muted text-sm">{t("stockHint")}</p> : null}
        </>
      )}
    </PartnerPage>
  );
}
