import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_QUOTATION_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ViewTabs } from "@/features/partner/rows";
import { pagerLabels } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.quotations"))("title") };
}

const VIEWS = ["open", "draft", "accepted", "all"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** The factory's quotations to its own customers (D-360): open first (draft or sent), accepted, everything. */
export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerSales.quotations"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/quotations", {
          params: {
            path: { factoryId: context.factoryId },
            query: { perPage: PER_PAGE, page, ...(view === "all" ? {} : { status: view }), ...(q ? { q } : {}) },
          },
        })
      ).data!,
  );
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/quotations${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        canAt(context, "factory_sales.manage") ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/quotations/new">{t("new")}</Link>
          </Button>
        ) : undefined
      }
    >
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
      />
      <SearchBar
        id="qt-q"
        action="/quotations"
        hidden={{ view: view === "open" ? undefined : view }}
        q={q}
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        button={tCommon("search")}
      />
      {list.data ? (
        <>
          <PartnerTable
            caption={t(`views.${view}`)}
            rows={list.data.data}
            rowKey={(row) => row.id}
            rowHref={(row) => `/quotations/${row.id}`}
            empty={<EmptyState icon="document" title={t("empty")} description={t("emptyBody")} />}
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (row) => (
                  <span className="whitespace-nowrap tabular-nums">
                    {row.quoteNo}
                    {row.revision > 1 ? ` (${t("revision", { n: row.revision })})` : ""}
                  </span>
                ),
              },
              { key: "customer", header: tCommon("customer"), cell: (row) => row.customer.name },
              {
                key: "date",
                header: tCommon("date"),
                hideOnPhone: true,
                className: "whitespace-nowrap",
                cell: (row) => format.date(row.quoteDate),
              },
              {
                key: "valid",
                header: t("table.validUntil"),
                className: "whitespace-nowrap",
                cell: (row) => format.date(row.validUntil),
              },
              {
                key: "salesperson",
                header: tCommon("salesperson"),
                hideOnPhone: true,
                cell: (row) => row.salesperson?.name ?? tCommon("noSalesperson"),
              },
              { key: "total", header: tCommon("amount"), align: "end", cell: (row) => format.thb(row.total) },
              {
                key: "status",
                header: tCommon("status"),
                cell: (row) => <StatusChip map={ERP_QUOTATION_STATUS} value={row.status} />,
              },
            ]}
          />
          <Pager
            page={page}
            perPage={PER_PAGE}
            total={list.data.meta.total}
            hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
            labels={await pagerLabels()}
          />
        </>
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
