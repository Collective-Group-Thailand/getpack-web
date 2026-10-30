import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ERP_PURCHASE_REQUEST_STATUS } from "@/domain/status";
import { attempt, canAt, factoryContext, partnerServerApis } from "@/features/partner/context/server";
import { viewTotals } from "@/features/partner/erp/server";
import { Pager, pageOf, queryOf, SearchBar } from "@/features/partner/erp/ui";
import { PageError, PartnerPage } from "@/features/partner/frame";
import { ListToolbar, ViewTabs } from "@/features/partner/rows";
import { StatusChip } from "@/features/partner/status";
import { PartnerTable } from "@/features/partner/table";
import { getFormat } from "@/features/shared/format/server";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("partnerFactory.requests"))("title") };
}

const VIEWS = ["open", "draft", "all"] as const;
type View = (typeof VIEWS)[number];
const PER_PAGE = 50;

/** Purchase requests (D-336): waiting or approved first, drafts, everything. */
export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const query = await searchParams;
  const view: View = VIEWS.includes(query.view as View) ? (query.view as View) : "open";
  const page = pageOf(query.page);
  const q = query.q?.trim() || undefined;
  const [t, tPo, tCommon, format, context] = await Promise.all([
    getTranslations("partnerFactory.requests"),
    getTranslations("partnerErp.purchasing"),
    getTranslations("partnerErp.common"),
    getFormat(),
    factoryContext(),
  ]);
  const { contract } = await partnerServerApis();
  const read = (view: View, perPage: number) =>
    contract.GET("/v1/partner/factories/{factoryId}/erp/purchase-requests", {
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
  const href = (next: View, extra: Record<string, string | number | undefined> = {}) =>
    `/purchasing/requests${queryOf({ view: next === "open" ? undefined : next, ...extra })}`;

  return (
    <PartnerPage
      full
      title={t("title")}
      description={t("body")}
      back={{ href: "/purchasing", label: tPo("title") }}
      actions={
        canAt(context, "factory_procurement.request") ? (
          <Button asChild size="lg" iconStart="plus">
            <Link href="/purchasing/requests/new">{t("new")}</Link>
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
          id="pr-q"
          action="/purchasing/requests"
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
            rowKey={(pr) => pr.id}
            rowHref={(pr) => `/purchasing/requests/${pr.id}`}
            empty={
              <EmptyState
                icon="checklist"
                title={t("empty")}
                description={t("emptyBody")}
                action={
                  canAt(context, "factory_procurement.request") ? (
                    <Button asChild variant="secondary" iconStart="plus">
                      <Link href="/purchasing/requests/new">{t("new")}</Link>
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
                cell: (pr) => <span className="whitespace-nowrap tabular-nums">{pr.prNo}</span>,
              },
              { key: "by", header: t("table.by"), cell: (pr) => pr.requestedBy },
              {
                key: "source",
                header: t("table.source"),
                hideOnPhone: true,
                cell: (pr) => t(`sources.${pr.source}` as never),
              },
              {
                key: "needed",
                header: t("table.neededBy"),
                className: "whitespace-nowrap",
                cell: (pr) => format.date(pr.neededBy),
              },
              { key: "lines", header: t("table.lines"), align: "end", hideOnPhone: true, cell: (pr) => pr.lineCount },
              { key: "total", header: t("table.estimate"), align: "end", cell: (pr) => format.thb(pr.estimatedTotal) },
              {
                key: "status",
                header: t("table.status"),
                cell: (pr) => <StatusChip map={ERP_PURCHASE_REQUEST_STATUS} value={pr.status} />,
              },
            ]}
          />
          <Pager
            page={page}
            perPage={PER_PAGE}
            total={list.data.meta.total}
            hrefFor={(n) => href(view, { q, page: n > 1 ? n : undefined })}
            labels={{
              nav: tCommon("pagination.nav"),
              previous: tCommon("pagination.previous"),
              next: tCommon("pagination.next"),
              page: (n: number) => tCommon("pagination.page", { n }),
            }}
          />
        </>
      ) : (
        <PageError error={list.error} />
      )}
    </PartnerPage>
  );
}
