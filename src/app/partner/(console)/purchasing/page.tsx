import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ERP_PURCHASE_ORDER_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { formatPlain } from "@/features/partner/erp/format";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { Icon } from "@/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerErp.purchasing"))("title") };
}

const VIEWS = ["open", "draft", "all", "receipts"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** The factory's purchase orders (D-325): waiting for goods first, drafts, everything, and what came in. */
export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tCommon, format, tStock, locale, context] = await Promise.all([
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerErp.common"),
    getFormat(),
    getTranslations("partnerErp.stock"),
    getLocale(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const path = { factoryId: context.factoryId };
  const orders =
    view === "receipts"
      ? null
      : await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders", {
                params: {
                  path,
                  query: { perPage: PER_PAGE, page, ...(view === "all" ? {} : { status: view }), ...(q ? { q } : {}) },
                },
              })
            ).data!,
        );
  const receipts =
    view === "receipts"
      ? await attempt(
          async () =>
            (
              await contract.GET("/v1/partner/factories/{factoryId}/erp/goods-receipts", {
                params: { path, query: { perPage: PER_PAGE, page, ...(q ? { q } : {}) } },
              })
            ).data!,
        )
      : null;
  // Every tab's count with the same search, so a tab says exactly how many rows it opens.
  const counts = await viewTotals(VIEWS, async (key) =>
    key === "receipts"
      ? (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/goods-receipts", {
            params: { path, query: { perPage: 1, ...(q ? { q } : {}) } },
          })
        ).data
      : (
          await contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-orders", {
            params: { path, query: { perPage: 1, ...(key === "all" ? {} : { status: key }), ...(q ? { q } : {}) } },
          })
        ).data,
  );
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/purchasing${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;
  const pagination = {
    nav: tCommon("pagination.nav"),
    previous: tCommon("pagination.previous"),
    next: tCommon("pagination.next"),
    page: (n: number) => tCommon("pagination.page", { n }),
  };
  const canDraft = canAt(context, "factory_procurement.manage");

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      // The steps before an order — requests and quotes from suppliers — are their own lists, one link away.
      meta={
        <nav aria-label={t("views.label")} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            className="text-primary inline-flex min-h-11 items-center gap-1.5 font-medium underline-offset-4 hover:underline md:min-h-8"
            href="/purchasing/requests"
          >
            <Icon name="checklist" size={16} aria-hidden />
            {t("views.requests")}
          </Link>
          <Link
            className="text-primary inline-flex min-h-11 items-center gap-1.5 font-medium underline-offset-4 hover:underline md:min-h-8"
            href="/purchasing/rfqs"
          >
            <Icon name="scale" size={16} aria-hidden />
            {t("views.rfqs")}
          </Link>
        </nav>
      }
      actions={
        canDraft ? (
          <>
            <Button asChild size="lg" iconStart="plus">
              <Link href="/purchasing/new">{t("new")}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" iconStart="warehouse">
              <Link href="/stock?view=low">{t("fromLow")}</Link>
            </Button>
          </>
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
          id="po-q"
          action="/purchasing"
          hidden={{ view: view === "open" ? undefined : view }}
          q={q}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          button={tCommon("search")}
        />
      </ListToolbar>
      {orders ? (
        orders.data ? (
          <>
            <PartnerTable
              caption={t(`views.${view}`)}
              rows={orders.data.data}
              rowKey={(po) => po.id}
              rowHref={(po) => `/purchasing/${po.id}`}
              rowTone={(po) => (po.late ? "danger" : undefined)}
              empty={
                <EmptyState
                  icon="cart"
                  title={t("empty")}
                  description={t("emptyBody")}
                  action={
                    canDraft ? (
                      <Button asChild variant="secondary" iconStart="plus">
                        <Link href="/purchasing/new">{t("new")}</Link>
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
                  cell: (po) =>
                    po.poNo ? (
                      <span className="whitespace-nowrap tabular-nums">{po.poNo}</span>
                    ) : (
                      <span className="text-muted">{t("draftNo")}</span>
                    ),
                },
                { key: "supplier", header: t("table.supplier"), cell: (po) => po.supplier.name },
                {
                  key: "ordered",
                  header: t("table.ordered"),
                  hideOnPhone: true,
                  className: "whitespace-nowrap",
                  cell: (po) => format.date(po.orderedOn),
                },
                {
                  key: "expected",
                  header: t("table.expected"),
                  className: "whitespace-nowrap",
                  cell: (po) => (
                    <span className="flex flex-wrap items-center gap-1">
                      {format.date(po.expectedOn)}
                      {po.late ? <Badge tone="danger">{t("late")}</Badge> : null}
                    </span>
                  ),
                },
                {
                  key: "received",
                  header: t("table.received"),
                  align: "end",
                  hideOnPhone: true,
                  cell: (po) => `${formatPlain(po.receivedPct, locale, 0)}%`,
                },
                { key: "total", header: t("table.total"), align: "end", cell: (po) => format.thb(po.total) },
                {
                  key: "status",
                  header: t("table.status"),
                  cell: (po) => <StatusChip map={ERP_PURCHASE_ORDER_STATUS} value={po.status} />,
                },
              ]}
            />
            <Pager
              page={page}
              perPage={PER_PAGE}
              total={orders.data.meta.total}
              hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
              labels={pagination}
            />
          </>
        ) : (
          <PageError error={orders.error} />
        )
      ) : receipts?.data ? (
        <>
          <PartnerTable
            caption={t("views.receipts")}
            rows={receipts.data.data}
            rowKey={(gr) => gr.id}
            rowHref={(gr) => `/purchasing/receipts/${gr.id}`}
            empty={
              <EmptyState
                icon="package-check"
                title={t("emptyReceipts")}
                action={
                  <Button asChild variant="secondary" iconStart="package-check">
                    <Link href="/stock/receive">{tStock("actions.receive")}</Link>
                  </Button>
                }
              />
            }
            columns={[
              {
                key: "no",
                header: t("table.grNo"),
                primary: true,
                cell: (gr) => <span className="whitespace-nowrap tabular-nums">{gr.grNo}</span>,
              },
              {
                key: "date",
                header: t("table.receivedOn"),
                className: "whitespace-nowrap",
                cell: (gr) => format.date(gr.receivedOn),
              },
              { key: "supplier", header: t("table.supplier"), cell: (gr) => gr.supplier.name },
              { key: "po", header: t("table.po"), hideOnPhone: true, cell: (gr) => gr.purchaseOrder?.code ?? "—" },
              { key: "dn", header: t("table.deliveryNote"), hideOnPhone: true, cell: (gr) => gr.deliveryNoteNo ?? "—" },
              { key: "total", header: t("table.total"), align: "end", cell: (gr) => format.thb(gr.total) },
            ]}
          />
          <Pager
            page={page}
            perPage={PER_PAGE}
            total={receipts.data.meta.total}
            hrefFor={(n) => href("receipts", { q, page: n > 1 ? n : undefined })}
            labels={pagination}
          />
        </>
      ) : (
        <PageError error={receipts?.error} />
      )}
    </PartnerPage>
  );
}
