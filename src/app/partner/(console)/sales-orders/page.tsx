import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_SALES_ORDER_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain } from "@/features/partner/erp/format";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { pagerLabels } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.salesOrders"))("title") };
}

const VIEWS = ["open", "draft", "delivered", "all"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** The factory's sales orders (D-361): open first (confirmed, not yet delivered in full), drafts, delivered, everything. */
export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, locale, context] = await Promise.all([
    getTranslations("partnerSales.salesOrders"),
    getTranslations("partnerSales.common"),
    getFormat(),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = (view: View, perPage: number) =>
    contract.GET("/v1/partner/factories/{factoryId}/erp/sales-orders", {
      params: {
        path: { factoryId: context.factoryId },
        query: {
          perPage,
          page: perPage === 1 ? 1 : page,
          ...(view === "all" ? {} : { status: view }),
          ...(q ? { q } : {}),
        },
      },
    });
  // Every tab's count with the same search, so a tab says exactly how many rows it opens.
  const [list, counts] = await Promise.all([
    attempt(async () => (await read(view, PER_PAGE)).data!),
    viewTotals(VIEWS, async (key) => (await read(key, 1)).data),
  ]);
  const manage = canAt(context, "factory_sales.manage");
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/sales-orders${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      actions={
        manage ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/sales-orders/new">{t("new")}</Link>
          </Button>
        ) : undefined
      }
    >
      <ListToolbar>
        <ViewTabs
          label={t("views.label")}
          current={view}
          items={VIEWS.map((key) => ({ key, href: href(key, { q }), label: t(`views.${key}`), count: counts[key] }))}
        />
        <SearchBar
          id="so-q"
          action="/sales-orders"
          hidden={{ view: view === "open" ? undefined : view }}
          q={q}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          button={tCommon("search")}
        />
      </ListToolbar>
      {list.data ? (
        <>
          <PartnerTable
            caption={t(`views.${view}`)}
            rows={list.data.data}
            rowKey={(row) => row.id}
            rowHref={(row) => `/sales-orders/${row.id}`}
            rowTone={(row) => (row.late ? "danger" : undefined)}
            empty={
              <EmptyState
                icon="cart"
                title={t("empty")}
                description={manage ? t("emptyBody") : undefined}
                action={
                  manage ? (
                    <Button asChild iconStart="plus">
                      <Link href="/sales-orders/new">{t("new")}</Link>
                    </Button>
                  ) : view !== "all" ? (
                    <Button asChild variant="secondary" iconEnd="arrow-right">
                      <Link href={href("all")}>{t("views.all")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (row) => <span className="whitespace-nowrap tabular-nums">{row.soNo}</span>,
              },
              { key: "customer", header: tCommon("customer"), cell: (row) => row.customer.name },
              {
                key: "date",
                header: tCommon("date"),
                hideOnPhone: true,
                className: "whitespace-nowrap",
                cell: (row) => format.date(row.orderDate),
              },
              {
                key: "delivery",
                header: t("table.deliveryDate"),
                className: "whitespace-nowrap",
                cell: (row) => (
                  <span className="flex flex-wrap items-center gap-1">
                    {row.deliveryDate ? format.date(row.deliveryDate) : "—"}
                    {row.late ? <Badge tone="danger">{tCommon("late")}</Badge> : null}
                  </span>
                ),
              },
              {
                key: "salesperson",
                header: tCommon("salesperson"),
                hideOnPhone: true,
                cell: (row) => row.salesperson?.name ?? tCommon("noSalesperson"),
              },
              {
                key: "delivered",
                header: t("table.delivered"),
                align: "end",
                hideOnPhone: true,
                cell: (row) => `${formatPlain(row.deliveredPct, locale, 0)}%`,
              },
              { key: "total", header: tCommon("amount"), align: "end", cell: (row) => format.thb(row.total) },
              {
                key: "status",
                header: tCommon("status"),
                cell: (row) => <StatusChip map={ERP_SALES_ORDER_STATUS} value={row.status} />,
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
