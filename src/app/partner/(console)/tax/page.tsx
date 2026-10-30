import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_WHT_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain } from "@/features/partner/erp/format";
import { queryOf } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection, PartnerStats } from "@/features/partner/frame";
import { PeriodPicker, stepLabel } from "@/features/partner/period";
import { FilterLinks, ListToolbar, ViewTabs } from "@/features/partner/rows";
import { Statement } from "@/features/partner/statement";
import { TaxExports } from "@/features/partner/sales/TaxForms";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.tax"))("title") };
}

const VIEWS = ["vat", "vat30", "wht", "certificates", "exports"] as const;
type View = (typeof VIEWS)[number];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const thisMonth = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};
/** Where a register line's document lives. */
const SOURCE_HREF: Record<string, (id: string) => string> = {
  tax_invoice: (id) => `/invoices/${id}`,
  credit_note: (id) => `/invoices/notes/${id}`,
  debit_note: (id) => `/invoices/notes/${id}`,
  supplier_tax_invoice: (id) => `/payables/invoices/${id}`,
  getpack_statement: (id) => `/billing/${id}`,
};

/**
 * The factory's tax for a month (D-366, D-367): the output and input VAT reports, the ภ.พ.30 summary, the
 * ภ.ง.ด.3 / 53 lines and the 50 ทวิ issued, and files for its accountant.
 */
export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; form?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "vat";
  const month = query.month && MONTH.test(query.month) ? query.month : thisMonth();
  const form = query.form === "pnd3" ? "pnd3" : "pnd53";
  const [t, tCommon, tIncome, format, context] = await Promise.all([
    getTranslations("partnerSales.tax"),
    getTranslations("partnerSales.common"),
    getTranslations("partnerSales.tax.income"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const href = (next: View, extra: Record<string, string | undefined> = {}) =>
    `/tax${queryOf({ view: next === "vat" ? undefined : next, month, ...extra })}`;
  const monthLabel = format.date(`${month}-01`, { style: "month" });
  // An empty month offers the month before — the usual reason a register is empty is the month not being over.
  const earlier = (
    <Button asChild variant="secondary" iconStart="chevron-left">
      <Link href={href(view, { month: shift(month, -1), form: view === "wht" ? form : undefined })}>
        {stepLabel(t("prevMonth"))}
      </Link>
    </Button>
  );

  let body: React.ReactNode;
  if (view === "vat") {
    const both = await attempt(async () => {
      const [sales, purchase] = await Promise.all([
        contract.GET("/v1/partner/factories/{factoryId}/erp/tax/sales-vat", { params: { path, query: { month } } }),
        contract.GET("/v1/partner/factories/{factoryId}/erp/tax/purchase-vat", { params: { path, query: { month } } }),
      ]);
      return { sales: sales.data!, purchase: purchase.data! };
    });
    body = both.data ? (
      <>
        <PartnerStats
          label={t("views.vat")}
          columns={4}
          items={[
            { key: "sn", label: t("vat30.salesNet"), value: format.thb(both.data.sales.net) },
            { key: "sv", label: t("vat30.outputVat"), value: format.thb(both.data.sales.vat) },
            { key: "pn", label: t("vat30.purchaseNet"), value: format.thb(both.data.purchase.net) },
            { key: "pv", label: t("vat30.inputVat"), value: format.thb(both.data.purchase.vat) },
          ]}
        />
        {(["sales", "purchase"] as const).map((kind) => {
          const report = both.data![kind];
          return (
            <PartnerSection key={kind} title={t(`vat.${kind}`)} description={monthLabel}>
              <PartnerTable
                caption={t(`vat.${kind}`)}
                rows={report.rows}
                rowKey={(row) => `${row.kind}-${row.sourceId}`}
                rowHref={(row) => SOURCE_HREF[row.kind]?.(row.sourceId) ?? `/tax${queryOf({ month })}`}
                empty={<EmptyState icon="receipt" title={t("vat.empty")} action={earlier} />}
                columns={[
                  {
                    key: "d",
                    header: tCommon("date"),
                    className: "whitespace-nowrap",
                    cell: (row) => format.date(row.date),
                  },
                  {
                    key: "no",
                    header: t("vat.docNo"),
                    primary: true,
                    cell: (row) => (
                      <span className="flex flex-wrap items-center gap-1 tabular-nums">
                        <span className="whitespace-nowrap">{row.docNo}</span>
                        {row.voided ? <Badge tone="danger">{t("vat.voided")}</Badge> : null}
                      </span>
                    ),
                  },
                  { key: "k", header: t("vat.kind"), hideOnPhone: true, cell: (row) => t(`vat.kinds.${row.kind}`) },
                  { key: "p", header: t("vat.party"), cell: (row) => row.partyName },
                  { key: "tax", header: t("vat.taxId"), hideOnPhone: true, cell: (row) => row.partyTaxId ?? "—" },
                  { key: "net", header: t("vat.net"), align: "end", cell: (row) => format.thb(row.net) },
                  { key: "vat", header: t("vat.vat"), align: "end", cell: (row) => format.thb(row.vat) },
                ]}
              />
            </PartnerSection>
          );
        })}
      </>
    ) : (
      <PageError error={both.error} />
    );
  } else if (view === "vat30") {
    const v = await attempt(
      async () =>
        (await contract.GET("/v1/partner/factories/{factoryId}/erp/tax/vat30", { params: { path, query: { month } } }))
          .data!,
    );
    body = v.data ? (
      <>
        {!v.data.vatRegistered ? <Callout tone="info" title={t("vat30.notRegistered")} /> : null}
        {/* The ภ.พ.30 as the form reads: sales and their tax, purchases and theirs, then what is paid or carried. */}
        <div className="max-w-3xl">
          <Statement
            caption={t("vat30.title")}
            title={t("vat30.title")}
            period={`${monthLabel} · ${t("vat30.due", { date: format.date(v.data.dueOn) })}`}
            headers={{ label: t("vat.kind"), amount: tCommon("amount") }}
            rows={[
              { key: "s", kind: "heading", label: t("vat.sales") },
              { key: "sn", label: t("vat30.salesNet"), amount: format.thb(v.data.salesNet) },
              { key: "ov", label: t("vat30.outputVat"), amount: format.thb(v.data.outputVat) },
              { key: "p", kind: "heading", label: t("vat.purchase") },
              { key: "pn", label: t("vat30.purchaseNet"), amount: format.thb(v.data.purchaseNet) },
              { key: "iv", label: t("vat30.inputVat"), amount: format.thb(v.data.inputVat) },
              {
                key: "pay",
                kind: "total",
                label: v.data.vatPayable.startsWith("-") ? t("vat30.credit") : t("vat30.payable"),
                amount: format.thb(v.data.vatPayable.replace(/^-/, "")),
              },
            ]}
          />
        </div>
        <p className="text-muted text-sm">{t("vat30.note")}</p>
      </>
    ) : (
      <PageError error={v.error} />
    );
  } else if (view === "wht") {
    const w = await attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/tax/wht", {
            params: { path, query: { month, form } },
          })
        ).data!,
    );
    body = (
      <>
        <FilterLinks
          label={t("wht.forms")}
          current={form}
          items={(["pnd53", "pnd3"] as const).map((f) => ({
            key: f,
            href: href("wht", { form: f }),
            label: t(`wht.${f}`),
          }))}
        />
        {w.data ? (
          <PartnerStats
            label={t(`wht.${form}`)}
            columns={2}
            items={[
              { key: "b", label: t("wht.base"), value: format.thb(w.data.baseAmount) },
              {
                key: "w",
                label: t("wht.wht"),
                value: format.thb(w.data.whtAmount),
                hint: t("vat30.due", { date: format.date(w.data.dueOn) }),
                highlight: true,
              },
            ]}
          />
        ) : null}
        {w.data ? (
          <PartnerSection title={t(`wht.${form}`)} description={monthLabel}>
            <PartnerTable
              caption={t(`wht.${form}`)}
              rows={w.data.rows}
              rowKey={(row) => `${row.certNo}-${row.incomeType}-${row.ratePct}`}
              empty={<EmptyState icon="stamp" title={t("wht.empty")} action={earlier} />}
              columns={[
                {
                  key: "no",
                  header: t("wht.certNo"),
                  primary: true,
                  cell: (row) => <span className="tabular-nums">{row.certNo}</span>,
                },
                { key: "d", header: tCommon("date"), cell: (row) => format.date(row.paidOn) },
                { key: "p", header: t("wht.payee"), cell: (row) => row.payeeName },
                { key: "tax", header: t("vat.taxId"), hideOnPhone: true, cell: (row) => row.payeeTaxId ?? "—" },
                {
                  key: "i",
                  header: t("wht.income"),
                  hideOnPhone: true,
                  cell: (row) => `${tIncome(row.incomeType)} ${formatPlain(row.ratePct, "th")}%`,
                },
                { key: "b", header: t("wht.base"), align: "end", cell: (row) => format.thb(row.baseAmount) },
                { key: "w", header: t("wht.wht"), align: "end", cell: (row) => format.thb(row.whtAmount) },
              ]}
            />
          </PartnerSection>
        ) : (
          <PageError error={w.error} />
        )}
      </>
    );
  } else if (view === "certificates") {
    const list = await attempt(
      async () =>
        (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/wht-certificates", {
            params: { path, query: { month, perPage: 100 } },
          })
        ).data!,
    );
    body = list.data ? (
      <PartnerTable
        caption={t("views.certificates")}
        rows={list.data.data}
        rowKey={(row) => row.id}
        rowHref={(row) => `/tax/certificates/${row.id}`}
        empty={
          <EmptyState
            icon="stamp"
            title={t("certificates.empty")}
            description={t("certificates.emptyBody")}
            action={
              <Button asChild variant="secondary" iconEnd="arrow-right">
                <Link href="/payables?view=payments">{t("certificates.fromPayments")}</Link>
              </Button>
            }
          />
        }
        columns={[
          {
            key: "no",
            header: t("wht.certNo"),
            primary: true,
            cell: (row) => <span className="tabular-nums">{row.certNo}</span>,
          },
          { key: "d", header: tCommon("date"), cell: (row) => format.date(row.paidOn) },
          { key: "s", header: t("wht.payee"), cell: (row) => row.supplier.name },
          { key: "f", header: t("certificates.formLabel"), hideOnPhone: true, cell: (row) => t(`wht.${row.form}`) },
          { key: "w", header: t("wht.wht"), align: "end", cell: (row) => format.thb(row.whtAmount) },
          {
            key: "st",
            header: tCommon("status"),
            cell: (row) => <StatusChip map={ERP_WHT_STATUS} value={row.status} />,
          },
        ]}
      />
    ) : (
      <PageError error={list.error} />
    );
  } else if (canAt(context, "factory_tax.read")) {
    body = <TaxExports month={month} />;
  } else {
    const tErrors = await getTranslations("common.errors");
    body = <EmptyState icon="lock" title={tErrors("forbiddenTitle")} description={tErrors("forbiddenBody")} />;
  }

  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
        />
        <PeriodPicker
          action="/tax"
          label={t("monthNav")}
          hidden={{ view: view === "vat" ? undefined : view, form: view === "wht" ? form : undefined }}
          fields={[{ name: "month", label: t("month"), value: month, type: "month" }]}
          submit={t("show")}
          prev={{
            href: href(view, { month: shift(month, -1), form: view === "wht" ? form : undefined }),
            label: stepLabel(t("prevMonth")),
          }}
          {...(month < thisMonth()
            ? {
                next: {
                  href: href(view, { month: shift(month, 1), form: view === "wht" ? form : undefined }),
                  label: stepLabel(t("nextMonth")),
                },
              }
            : {})}
        />
      </ListToolbar>
      {body}
    </PartnerPage>
  );
}
