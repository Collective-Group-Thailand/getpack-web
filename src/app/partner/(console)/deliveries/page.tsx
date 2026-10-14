import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ERP_DELIVERY_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage, PartnerSection } from "@/features/partner/frame";
import { Row, RowList, ViewTabs } from "@/features/partner/rows";
import { pagerLabels } from "@/features/partner/sales/view";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerSales.deliveries"))("title") };
}

const VIEWS = ["draft", "issued", "uninvoiced", "all"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/**
 * Delivery notes (D-362): drafts to load and issue, issued ones on the road, delivered but not yet invoiced,
 * everything. A new one starts from its sales order.
 */
export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "draft";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, context] = await Promise.all([
    getTranslations("partnerSales.deliveries"),
    getTranslations("partnerSales.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const list = await attempt(
    async () =>
      (
        await contract.GET("/v1/partner/factories/{factoryId}/erp/delivery-notes", {
          params: {
            path: { factoryId: context.factoryId },
            query: { perPage: PER_PAGE, page, ...(view === "all" ? {} : { status: view }), ...(q ? { q } : {}) },
          },
        })
      ).data!,
  );
  // What is still to deliver: confirmed orders not fully delivered — where a new delivery note starts.
  const toDeliver =
    view === "draft" && canAt(context, "factory_delivery.manage")
      ? (
          await attempt(
            async () =>
              (
                await contract.GET("/v1/partner/factories/{factoryId}/erp/sales-orders", {
                  params: { path: { factoryId: context.factoryId }, query: { status: "open", perPage: 20 } },
                })
              ).data!.data.filter((so) => so.status === "confirmed" || so.status === "partially_delivered"),
          )
        ).data ?? []
      : [];
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/deliveries${queryOf({ view: next === "draft" ? undefined : next, ...extra })}`;

  return (
    <PartnerPage full title={t("title")} description={t("body")}>
      {toDeliver.length ? (
        <PartnerSection title={t("toDeliver.title")} description={t("toDeliver.body")}>
          <RowList label={t("toDeliver.title")}>
            {toDeliver.map((so) => (
              <Row
                key={so.id}
                href={`/deliveries/new?so=${so.id}`}
                icon="truck"
                tone={so.late ? "danger" : "neutral"}
                title={`${so.soNo} · ${so.customer.name}`}
                meta={[
                  t("toDeliver.delivered", { pct: Math.round(Number(so.deliveredPct)) }),
                  so.deliveryDate ? t("toDeliver.due", { date: format.date(so.deliveryDate) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                aside={t("toDeliver.make")}
              />
            ))}
          </RowList>
        </PartnerSection>
      ) : null}
      <ViewTabs
        label={t("views.label")}
        current={view}
        items={VIEWS.map((key) => ({ key, href: href(key), label: t(`views.${key}`) }))}
      />
      <SearchBar
        id="do-q"
        action="/deliveries"
        hidden={{ view: view === "draft" ? undefined : view }}
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
            rowHref={(row) => `/deliveries/${row.id}`}
            empty={<EmptyState icon="truck" title={t("empty")} description={t("emptyBody")} />}
            columns={[
              {
                key: "no",
                header: t("table.no"),
                primary: true,
                cell: (row) => <span className="font-mono whitespace-nowrap">{row.doNo}</span>,
              },
              { key: "customer", header: tCommon("customer"), cell: (row) => row.customer.name },
              {
                key: "date",
                header: t("table.deliverOn"),
                className: "whitespace-nowrap",
                cell: (row) => format.date(row.deliverOn),
              },
              {
                key: "so",
                header: t("table.salesOrder"),
                hideOnPhone: true,
                cell: (row) => <span className="font-mono">{row.salesOrder.code}</span>,
              },
              {
                key: "status",
                header: tCommon("status"),
                cell: (row) => (
                  <span className="flex flex-wrap items-center gap-1">
                    <StatusChip map={ERP_DELIVERY_STATUS} value={row.status} />
                    {row.invoiced ? <Badge tone="success">{t("invoiced")}</Badge> : null}
                  </span>
                ),
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
